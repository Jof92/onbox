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
  const [glowDismissed, setGlowDismissed] = useState(false);

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
  }, [session]);

  // === Verificar se existe ALGUMA tarefa que venceu ONTEM (-1 dia) ===
  useEffect(() => {
    const checkIfOverdueYesterday = async () => {
      if (!session?.user?.id) {
        setHasOverdueToday(false);
        return;
      }

      try {
        // Calcular a data de ONTEM no formato YYYY-MM-DD
        const hoje = new Date();
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        const ontemStr = ontem.toISOString().split('T')[0]; // Ex: "2025-12-01"

        let hasOverdue = false;

        // === 1. Verificar objetivos com data_entrega = ontemStr ===
        const { data: responsaveis, error: err1 } = await supabase
          .from("ata_objetivos_responsaveis_enriquecidos")
          .select("ata_objetivo_id")
          .eq("usuario_id", session.user.id);

        if (err1) throw err1;

        if (responsaveis?.length) {
          const objetivoIds = responsaveis
            .map(r => r.ata_objetivo_id)
            .filter(Boolean);

          if (objetivoIds.length > 0) {
            const { data: objetivos, error: err2 } = await supabase
              .from("ata_objetivos")
              .select("data_entrega, concluido, texto")
              .in("id", objetivoIds)
              .eq("data_entrega", ontemStr); // 🔍 Filtra só os de ONTEM

            if (err2) throw err2;

            // Verifica se há algum objetivo NÃO concluído e NÃO excluído
            const hasActiveOverdueObjetivo = objetivos?.some(obj =>
              !obj.concluido && 
              obj.texto && 
              !obj.texto.startsWith("[EXCLUIDO]")
            );

            if (hasActiveOverdueObjetivo) {
              hasOverdue = true;
            }
          }
        }

        // === 2. Verificar comentários com data_entrega = ontemStr (se ainda não encontrou) ===
        if (!hasOverdue) {
          const { data: comentarios, error: err3 } = await supabase
            .from("comentarios")
            .select("id") // só precisamos saber se existe
            .eq("agendado_por", session.user.id)
            .eq("data_entrega", ontemStr); // 🔍 Só os de ONTEM

          if (err3) {
            console.warn("Erro ao buscar comentários de ontem:", err3);
          } else if (comentarios?.length > 0) {
            hasOverdue = true; // comentários não têm "exclusão lógica" além de remover o agendado_por
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