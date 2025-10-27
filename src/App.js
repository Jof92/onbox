import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LoginPanel from "./components/Login";
import LoginFull from "./components/LoginFull";
import Containers from "./components/Containers";
import Cards from "./components/Cards";
import { supabase } from "./supabaseClient";
import img1 from "./assets/1.png";
import img2 from "./assets/2.png";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [showLoginFull, setShowLoginFull] = useState(false);

  const images = [img1, img2];
  const [currentIndex, setCurrentIndex] = useState(0);

  // Carrossel de imagens
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Monitorar sessão
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
        setShowLoginFull(false);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  // Buscar perfil do usuário
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
  }, [session]);

  const handleLoginClick = () => setShowLoginPanel((prev) => !prev);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };
  const handleOpenLoginFull = () => setShowLoginFull(true);
  const handleCloseLoginFull = () => setShowLoginFull(false);

  return (
    <Router>
      <div className="App">
        <Header
          session={session}
          profile={profile}
          onLoginClick={handleLoginClick}
          onLogout={handleLogout}
          onEditProfile={handleOpenLoginFull} // opcional: botão de editar perfil
        />

        {/* Painel de login flutuante */}
        {showLoginPanel && !session && (
          <div className="login-panel-container show">
            <LoginPanel onLogin={() => setShowLoginPanel(false)} />
          </div>
        )}

        {/* Modal LoginFull */}
        {showLoginFull && session && profile && (
          <LoginFull profile={profile} session={session} onClose={handleCloseLoginFull} />
        )}

        <main className="app-main">
          {/* Carrossel para usuários não logados */}
          {!session && (
            <div className="carousel-container">
              <img
                src={images[currentIndex]}
                alt={`Slide ${currentIndex + 1}`}
                className="carousel-image"
              />
            </div>
          )}

          {/* Rotas */}
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
            <Route path="/cards/:projectName" element={<Cards projects={projects} />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}
