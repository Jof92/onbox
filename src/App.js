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
  const [hasOverdueToday, setHasOverdueToday] = useState(false);
  const [glowDismissed, setGlowDismissed] = useState(false); // Controle para descartar glow

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

  // === Verificar se há itens atrasados na agenda ===
  useEffect(() => {
    const checkOverdueItems = async () => {
      if (!session?.user?.id) {
        setHasOverdueToday(false);
        return;
      }

      try {
        const { data: responsaveis, error: err1 } = await supabase
          .from("ata_objetivos_responsaveis_enriquecidos")
          .select("ata_objetivo_id")
          .eq("usuario_id", session.user.id);

        if (err1) throw err1;

        let objetivoIds = [];
        if (responsaveis?.length) {
          objetivoIds = responsaveis.map(r => r.ata_objetivo_id).filter(Boolean);
        }

        let allItems = [];

        if (objetivoIds.length > 0) {
          const { data: objetivos, error: err2 } = await supabase
            .from("ata_objetivos")
            .select("data_entrega, concluido")
            .in("id", objetivoIds);
          if (err2) throw err2;
          allItems.push(...(objetivos || []));
        }

        const { data: comentarios, error: err3 } = await supabase
          .from("comentarios")
          .select("data_entrega")
          .eq("agendado_por", session.user.id);
        if (err3) console.warn("Erro ao buscar comentários:", err3);
        if (comentarios?.length) {
          allItems.push(...comentarios);
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const hasOverdue = allItems.some(item => {
          if (!item.data_entrega || item.concluido) return false;
          const [y, m, d] = item.data_entrega.split('-').map(Number);
          const dataItem = new Date(y, m - 1, d);
          dataItem.setHours(0, 0, 0, 0);
          return dataItem < hoje;
        });

        setHasOverdueToday(hasOverdue);
      } catch (err) {
        console.error("Erro ao verificar agenda:", err);
        setHasOverdueToday(false);
      }
    };

    checkOverdueItems();
  }, [session?.user?.id]);

  // === Fechar painel de login com ESC ===
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

  // Glow só aparece se não foi descartado
  const showGlow = session && !glowDismissed;

  return (
    <Router>
      <div className="App">
        <Header
          session={session}
          profile={profile}
          onLoginClick={handleLoginClick}
          onLogout={handleLogout}
          onProfileUpdate={setProfile}
          hasOverdueToday={hasOverdueToday}
          showGlow={showGlow}
          onGlowDismiss={() => setGlowDismissed(true)}
        />

        {showLoginPanel && !session && (
          <div className="login-panel-container show">
            <LoginPanel onLogin={() => setShowLoginPanel(false)} />
          </div>
        )}

        <main className="app-main">
          <Routes>
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
            <Route
              path="/containers/:containerId?"
              element={
                session ? <Containers /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="/cards/:projectName"
              element={
                session ? <Cards projects={projects} /> : <Navigate to="/" replace />
              }
            />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}