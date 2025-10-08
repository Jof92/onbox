import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import LoginPanel from './components/Login';
import Containers from './components/Containers';
import Cards from './components/Cards';
import { supabase } from './supabaseClient';
import './App.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]); // ✅ estado global de projetos
  const [showLogin, setShowLogin] = useState(false);

  const handleLoginClick = () => setShowLogin(prev => !prev);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <Router>
      <div className="App">
        <Header onLoginClick={handleLoginClick} onLogout={handleLogout} session={session} />

        {showLogin && !session && (
          <div className={`login-panel-container ${showLogin ? 'show' : ''}`}>
            <LoginPanel onLogin={() => setShowLogin(false)} />
          </div>
        )}

        <main className="app-main">
          <Routes>
            <Route
              path="/"
              element={!session ? <p>Faça login para acessar seus projetos.</p> : <Containers projects={projects} setProjects={setProjects} />}
            />
            <Route path="/containers" element={<Containers projects={projects} setProjects={setProjects} />} />
            <Route path="/cards/:projectName" element={<Cards projects={projects} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
