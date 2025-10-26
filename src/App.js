import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LoginPanel from "./components/Login";
import LoginFull from "./components/LoginFull"; // ✅ Import do LoginFull
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
  const [showLogin, setShowLogin] = useState(false);

  // Carrossel de imagens
  const images = [img1, img2];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Carregar sessão e monitorar alterações
  useEffect(() => {
    async function fetchSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("Erro ao obter sessão:", error);
      setSession(data?.session || null);
    }

    fetchSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setShowLogin(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Buscar perfil do usuário logado
  useEffect(() => {
    async function fetchProfile() {
      if (!session?.user) {
        setProfile(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .eq("id", session.user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (err) {
        console.error("Erro ao buscar perfil:", err.message);
      }
    }

    fetchProfile();
  }, [session]);

  const handleLoginClick = () => setShowLogin((prev) => !prev);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <Router>
      <div className="App">
        {/* Header sempre mostra o usuário logado */}
        <Header
          session={session}
          profile={profile}
          onLoginClick={handleLoginClick}
          onLogout={handleLogout}
        />

        {/* Painel de login flutuante */}
        {showLogin && !session && (
          <div className={`login-panel-container ${showLogin ? "show" : ""}`}>
            <LoginPanel onLogin={() => setShowLogin(false)} />
          </div>
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

            {/* Rota para o cadastro completo via link de email */}
            <Route path="/loginfull" element={<LoginFull />} />
          </Routes>
        </main>

        {/* Footer global */}
        <Footer />
      </div>
    </Router>
  );
}
