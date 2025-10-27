import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Header from "./components/Header";
import Containers from "./components/Containers";
import Cards from "./components/Cards";
import LoginFull from "./components/LoginFull";
import Footer from "./components/Footer";
import LoadingScreen from "./components/LoadingScreen";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasFullProfile, setHasFullProfile] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("Erro ao obter sessão:", error);
      setSession(data?.session || null);
      setLoading(false);
    }

    fetchSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription?.subscription.unsubscribe();
  }, []);

  // Busca o perfil do usuário
  useEffect(() => {
    async function fetchProfile() {
      if (!session?.user) {
        setProfile(null);
        setHasFullProfile(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nome, empresa, funcao, avatar_url")
          .eq("id", session.user.id)
          .single();

        if (error && error.code !== "PGRST116") throw error; // ignora erro "no rows found"

        setProfile(data || null);

        const completo = !!(data?.nome && data?.empresa && data?.funcao);
        setHasFullProfile(completo);
      } catch (err) {
        console.error("Erro ao buscar perfil:", err.message);
        setHasFullProfile(false);
      }
    }

    fetchProfile();
  }, [session]);

  if (loading) return <LoadingScreen />;

  return (
    <Router>
      <MainContent
        session={session}
        profile={profile}
        hasFullProfile={hasFullProfile}
        projects={projects}
        setProjects={setProjects}
      />
    </Router>
  );
}

function MainContent({ session, profile, hasFullProfile, projects, setProjects }) {
  const navigate = useNavigate();

  // Redirecionamento automático baseado no estado do perfil
  useEffect(() => {
    if (!session) return; // usuário deslogado
    if (hasFullProfile) {
      navigate("/containers");
    } else {
      navigate("/loginfull");
    }
  }, [session, hasFullProfile, navigate]);

  return (
    <div className="App">
      <Header session={session} profile={profile} />

      <main>
        <Routes>
          {/* Página inicial */}
          <Route
            path="/"
            element={
              !session ? (
                <p className="login-msg">Faça login para acessar seus projetos.</p>
              ) : hasFullProfile ? (
                <Containers projects={projects} setProjects={setProjects} />
              ) : (
                <LoginFull />
              )
            }
          />

          {/* Containers só se perfil completo */}
          <Route
            path="/containers"
            element={
              hasFullProfile ? (
                <Containers projects={projects} setProjects={setProjects} />
              ) : (
                <LoginFull />
              )
            }
          />

          {/* Página de cards */}
          <Route path="/cards/:projectName" element={<Cards projects={projects} />} />

          {/* Página para completar cadastro */}
          <Route path="/loginfull" element={<LoginFull />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
