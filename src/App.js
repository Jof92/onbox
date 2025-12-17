// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LoginPanel from "./components/Login";
import Containers from "./components/Containers";
import Cards from "./components/Cards";
import Home from "./components/Home";
import ResetSenha from "./components/ResetSenha";
import { supabase } from "./supabaseClient";
import "./App.css";

const ContainersWrapper = () => {
  const { containerId } = useParams();
  const validContainerId = containerId && /^[0-9a-fA-F-]{36}$/.test(containerId)
    ? containerId
    : null;
  return <Containers currentContainerId={validContainerId} />;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [hasOverdueToday, setHasOverdueToday] = useState(false);
  const [glowDismissed, setGlowDismissed] = useState(false);

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

  useEffect(() => {
    const checkIfOverdueYesterday = async () => {
      if (!session?.user?.id) {
        setHasOverdueToday(false);
        return;
      }

      try {
        const hoje = new Date();
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        const ontemStr = ontem.toISOString().split('T')[0];

        let hasOverdue = false;

        const { data: responsaveis, error: err1 } = await supabase
          .from("ata_objetivos_responsaveis_enriquecidos")
          .select("ata_objetivo_id")
          .eq("usuario_id", session.user.id);

        if (err1) throw err1;

        if (responsaveis?.length) {
          const objetivoIds = responsaveis.map(r => r.ata_objetivo_id).filter(Boolean);
          if (objetivoIds.length > 0) {
            const { data: objetivos, error: err2 } = await supabase
              .from("ata_objetivos")
              .select("data_entrega, concluido, texto")
              .in("id", objetivoIds)
              .eq("data_entrega", ontemStr);

            if (err2) throw err2;

            const hasActiveOverdue = objetivos?.some(obj =>
              !obj.concluido && obj.texto && !obj.texto.startsWith("[EXCLUIDO]")
            );
            if (hasActiveOverdue) hasOverdue = true;
          }
        }

        if (!hasOverdue) {
          const { data: comentarios, error: err3 } = await supabase
            .from("comentarios")
            .select("id")
            .eq("agendado_por", session.user.id)
            .eq("data_entrega", ontemStr);

          if (!err3 && comentarios?.length > 0) {
            hasOverdue = true;
          }
        }

        setHasOverdueToday(hasOverdue);
      } catch (err) {
        console.error("Erro ao verificar tarefas vencidas ontem:", err);
        setHasOverdueToday(false);
      }
    };

    checkIfOverdueYesterday();
  }, [session?.user?.id]);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape" && showLoginPanel) {
        setShowLoginPanel(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showLoginPanel]);

  const handleLoginClick = () => setShowLoginPanel((prev) => !prev);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setHasOverdueToday(false);
    setGlowDismissed(false);
  };

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
            <LoginPanel
              onLogin={() => setShowLoginPanel(false)}
              onClose={() => setShowLoginPanel(false)}
            />
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
                session ? <ContainersWrapper /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="/cards/:projectName"
              element={
                session ? <Cards projects={projects} /> : <Navigate to="/" replace />
              }
            />
            <Route
              path="/ResetSenha"
              element={<ResetSenha />}
            />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}