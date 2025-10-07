import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import LoginPanel from './components/Login';
import Containers from './components/Containers';
import { supabase } from './supabaseClient';
import './App.css';

function AppContent() {
  const [session, setSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  // 🔹 Monitora sessão do usuário (login/logout)
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        navigate('/containers');
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLoginClick = () => {
    setShowLogin((prev) => !prev);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    navigate('/');
  };

  return (
    <div className="App">
      <Header onLoginClick={handleLoginClick} onLogout={handleLogout} session={session} />

      {/* Painel de login animado */}
      {showLogin && !session && (
        <div className={`login-panel-container ${showLogin ? 'show' : ''}`}>
          <LoginPanel onLogin={() => setShowLogin(false)} />
        </div>
      )}

      <main className='app-main'>
        <Routes>
          <Route
            path="/"
            element={
              !session ? (
                <div className="welcome">
                  <h2>Bem-vindo ao <span className="brand">ONBOX</span></h2>
                  <p>Faça login para acessar seus projetos.</p>
                </div>
              ) : (
                <Containers />
              )
            }
          />
          <Route path="/containers" element={<Containers />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
