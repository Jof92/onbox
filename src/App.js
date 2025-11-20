// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LoginPanel from "./components/Login";
import Containers from "./components/Containers";
import Cards from "./components/Cards";
import Home from "./components/Home";
import { supabase } from "./supabaseClient";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showLoginPanel, setShowLoginPanel] = useState(false);

  // === Monitorar sessão do usuário ===
  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
    };
    fetchSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setShowLoginPanel(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // === Buscar perfil do usuário ===
    useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) {
        setProfile(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nome, empresa, funcao, container, avatar_url")
          .eq("id", session.user.id)
          .single();
        if (error && error.code !== "PGRST116") throw error;
        setProfile(data || null);
      } catch (err) {
        console.error("Erro ao buscar perfil:", err.message);
      }
    };
    fetchProfile();
  }, [session, session?.user?.id]);

  // === Fechar painel de login com a tecla ESC ===
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape" && showLoginPanel) {
        setShowLoginPanel(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showLoginPanel]);

  // === Controle de login/logout ===
  const handleLoginClick = () => setShowLoginPanel((prev) => !prev);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <Router>
      <div className="App">
        <Header
          session={session}
          profile={profile}
          onLoginClick={handleLoginClick}
          onLogout={handleLogout}
          onProfileUpdate={setProfile} // 👈 Linha adicionada
        />

        {/* Painel de login suspenso */}
        {showLoginPanel && !session && (
          <div className="login-panel-container show">
            <LoginPanel onLogin={() => setShowLoginPanel(false)} />
          </div>
        )}

        <main className="app-main">
          <Routes>
            {/* Home pública */}
            <Route
              path="/"
              element={
                !session ? (
                  <Home onOpenLogin={handleLoginClick} />
                ) : (
                  <Navigate to="/containers" replace />
                )
              }
            />

            {/* Páginas protegidas */}
            <Route
              path="/containers/:containerId?"
              element={
                session ? (
                  <Containers />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/cards/:projectName"
              element={
                session ? (
                  <Cards projects={projects} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}