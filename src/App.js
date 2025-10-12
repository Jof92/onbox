import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import LoginPanel from './components/Login';
import Containers from './components/Containers';
import Cards from './components/Cards';
import { supabase } from './supabaseClient';
import img1 from './assets/1.png';
import img2 from './assets/2.png';
import './App.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]); 
  const [showLogin, setShowLogin] = useState(false);

  // Carrossel
  const images = [img1, img2];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % images.length);
    }, 3000); // muda a cada 3s
    return () => clearInterval(interval);
  }, []);

  // ✅ Carregar sessão existente e monitorar alterações
  useEffect(() => {
    async function getSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error('Erro ao obter sessão:', error);
      setSession(data?.session || null);
    }

    getSession();

    // Escuta mudanças de login/logout
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setShowLogin(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleLoginClick = () => setShowLogin(prev => !prev);
  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); };

  return (
    <Router>
      <div className="App">
        <Header 
          onLoginClick={handleLoginClick} 
          onLogout={handleLogout} 
          session={session} 
        />

        {showLogin && !session && (
          <div className={`login-panel-container ${showLogin ? 'show' : ''}`}>
            <LoginPanel onLogin={() => setShowLogin(false)} />
          </div>
        )}

        <main className="app-main">
          {/* Carrossel */}
          {!session && (
            <div className="carousel-container">
              <img src={images[currentIndex]} alt={`Slide ${currentIndex + 1}`} className="carousel-image" />
            </div>
          )}

          <Routes>
            <Route
              path="/"
              element={
                !session ? (
                  <p>Faça login para acessar seus projetos.</p>
                ) : (
                  <Containers projects={projects} setProjects={setProjects} />
                )
              }
            />
            <Route 
              path="/containers" 
              element={<Containers projects={projects} setProjects={setProjects} />} 
            />
            <Route 
              path="/cards/:projectName" 
              element={<Cards projects={projects} />} 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
