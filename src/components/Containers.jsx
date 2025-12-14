import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ThinSidebar from "../components/ThinSidebar";
import Sidebar from "../components/Sidebar";
import ProjectManager from "./ProjectManager";
import "./Containers.css";

export default function Containers({ containerIdDaUrl }) {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [containerAtual, setContainerAtual] = useState(null);
  const [nomeContainer, setNomeContainer] = useState("");
  const [loading, setLoading] = useState(true);

  const [sidebarProps, setSidebarProps] = useState({
    projects: [],
    selectedProject: null,
    onCreateProject: () => {},
    onProjectSelect: () => {},
    onDeleteProject: () => {},
    onOpenSetoresManager: () => {},
    currentUserId: null,
    containerOwnerId: null,
    gerenteContainerId: null,
    currentContainerId: null,
  });

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

  // Define containerAtual com base no containerIdDaUrl, localStorage ou user.id
  useEffect(() => {
    const idParaUsar = containerIdDaUrl || localStorage.getItem("containerAtual") || user?.id;
    setContainerAtual(idParaUsar);
  }, [user, containerIdDaUrl]);

  // Busca nome do dono do container
  useEffect(() => {
    const fetchNomeDono = async () => {
      if (!containerAtual) {
        setNomeContainer("");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", containerAtual);

        if (error) {
          console.error("Erro ao buscar perfil:", error);
          setNomeContainer("Erro");
        } else if (!data || data.length === 0) {
          setNomeContainer("Desconhecido");
        } else {
          setNomeContainer(data[0].nome || "Sem nome");
        }
      } catch (err) {
        console.error("Exceção inesperada:", err);
        setNomeContainer("Erro");
      }
    };

    fetchNomeDono();
  }, [containerAtual]);

  // Atualiza containerAtual no localStorage e na sidebarProps sempre que mudar
  useEffect(() => {
    if (containerAtual) {
      localStorage.setItem("containerAtual", containerAtual); // Salva o container atual no localStorage
      setSidebarProps(prev => ({
        ...prev,
        currentContainerId: containerAtual,
      }));
    }
  }, [containerAtual]);

  if (loading) return <Loading />;

  return (
    <div className="containers-page">
      <div className="containers-content">
        <ThinSidebar
          containerAtual={containerAtual}
          setContainerAtual={setContainerAtual}
          user={user}
        />

        <Sidebar {...sidebarProps} currentContainerId={containerAtual} />

        <div className="containers-main-with-title">
          <h1 className="tittle-cont">
            Container {nomeContainer ? `- ${nomeContainer}` : ""}
          </h1>

          <ProjectManager
            containerAtual={containerAtual}
            user={user}
            onSidebarUpdate={setSidebarProps}
          />
        </div>
      </div>
    </div>
  );
}
