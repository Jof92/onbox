// src/pages/Containers.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom"; // ✅ useParams + useNavigate
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ThinSidebar from "../components/ThinSidebar";
import ProjectManager from "./ProjectManager";
import "./Containers.css";

export default function Containers() {
  const { containerId: containerIdDaUrl } = useParams(); // ✅ Pega da URL
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [containerAtual, setContainerAtual] = useState(null);
  const [nomeContainer, setNomeContainer] = useState("");
  const [loading, setLoading] = useState(true);

  // Carrega usuário logado
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUser(data.user);
      } else {
        navigate("/login", { replace: true });
      }
      setLoading(false);
    };
    loadUser();
  }, [navigate]);

  // Define containerAtual com base na URL ou no usuário
  useEffect(() => {
    if (user) {
      const idParaUsar = containerIdDaUrl || user.id;
      setContainerAtual(idParaUsar);
    }
  }, [user, containerIdDaUrl]);

  // Busca nome do dono do container (para exibição)
  useEffect(() => {
    const fetchNomeDono = async () => {
      if (!containerAtual) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", containerAtual)
          .single();

        if (error || !data) {
          setNomeContainer("Desconhecido");
        } else {
          setNomeContainer(data.nome || "Sem nome");
        }
      } catch (err) {
        setNomeContainer("Erro");
      }
    };

    fetchNomeDono();
  }, [containerAtual]);

  if (loading) return <Loading />;

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
          onProjectSelect={() => {}}
          onProjectDeleted={() => {}}
        />
      </div>
    </div>
  );
}