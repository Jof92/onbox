// src/pages/Containers.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ThinSidebar from "./ThinSidebar";
import ProjectManager from "../components/ProjectManager"; // ajuste o caminho conforme sua estrutura
import "./Containers.css";

export default function Containers() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [containerAtual, setContainerAtual] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUser(data.user);
        setContainerAtual(data.user.id);
        await fetchProfile(data.user.id);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("container")
      .eq("id", userId)
      .single();
    if (!error) setProfile(data);
  };

  if (loading) return <Loading />;

  return (
    <div className="containers-page">
      <header className="containers-header">
        <h1 className="tittle-cont">Container {profile?.container ? `- ${profile.container}` : ""}</h1>
      </header>

      <div className="containers-content">
        <ThinSidebar
          containerAtual={containerAtual}
          setContainerAtual={setContainerAtual}
          user={user}
        />

        {/* Componente isolado para gerenciar projetos */}
        <ProjectManager
          containerAtual={containerAtual}
          onProjectSelect={(proj) => console.log("Projeto selecionado:", proj)}
          onProjectDeleted={() => console.log("Projeto deletado")}
        />
      </div>
    </div>
  );
}