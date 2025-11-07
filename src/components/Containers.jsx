// src/pages/Containers.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ThinSidebar from "../components/ThinSidebar";
import ProjectManager from "./ProjectManager";
import "./Containers.css";

export default function Containers() {
  const [user, setUser] = useState(null);
  const [containerAtual, setContainerAtual] = useState(null);
  const [nomeContainer, setNomeContainer] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUser(data.user);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (user && containerAtual === null) {
      setContainerAtual(user.id);
    }
  }, [user, containerAtual]);

  useEffect(() => {
    const fetchContainerNome = async () => {
      if (!containerAtual) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("container")
          .eq("id", containerAtual)
          .single();

        if (error) {
          setNomeContainer("Desconhecido");
          return;
        }
        setNomeContainer(data.container || "Sem nome");
      } catch (err) {
        setNomeContainer("Erro");
      }
    };

    fetchContainerNome();
  }, [containerAtual]);

  if (loading) return <Loading />;

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="containers-page">
      <header className="containers-header">
        <h1 className="tittle-cont">
          Container {nomeContainer ? `- ${nomeContainer}` : ""}
        </h1>
      </header>

      <div className="containers-content">
        <ThinSidebar
          containerAtual={containerAtual}
          setContainerAtual={setContainerAtual}
          user={user}
        />

        <ProjectManager
          containerAtual={containerAtual}
          onProjectSelect={(proj) => {}}
          onProjectDeleted={() => {}}
        />
      </div>
    </div>
  );
}