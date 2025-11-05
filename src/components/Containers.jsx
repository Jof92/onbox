// src/pages/Containers.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ThinSidebar from "./ThinSidebar";
import ProjectManager from "./ProjectManager";
import "./Containers.css";

export default function Containers() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [containerAtual, setContainerAtual] = useState(null); // pode ser user.id ou outro
  const [nomeContainer, setNomeContainer] = useState("");
  const [loading, setLoading] = useState(true);

  // Carrega usuário logado
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

  // ✅ Inicializa containerAtual com user.id SOMENTE se ainda não definido
      useEffect(() => {
      if (user && containerAtual === null) {
        setContainerAtual(user.id);
      }
    }, [user, containerAtual]);

  // Busca nome do container (perfil) sempre que containerAtual mudar
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
          console.error("Erro ao buscar nome do container:", error.message);
          setNomeContainer("Desconhecido");
          return;
        }
        setNomeContainer(data.container || "Sem nome");
      } catch (err) {
        console.error("Erro ao buscar nome do container:", err.message);
        setNomeContainer("Erro");
      }
    };

    fetchContainerNome();
  }, [containerAtual]);

  if (loading) return <Loading />;

  if (!user) {
    // Opcional: redirecionar para login
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
          onProjectSelect={(proj) => console.log("Projeto selecionado:", proj)}
          onProjectDeleted={() => console.log("Projeto deletado")}
        />
      </div>
    </div>
  );
}