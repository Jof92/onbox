// src/pages/Containers.jsx
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom"; // 👈 Adicionado
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ThinSidebar from "../components/ThinSidebar";
import ProjectManager from "./ProjectManager";
import "./Containers.css";

export default function Containers() {
  const location = useLocation(); // 👈 Para acessar o state

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

  // 👇 Define containerAtual com base no state OU no usuário logado
  useEffect(() => {
    if (user) {
      // Se houver targetContainerId no state, use-o; senão, use o do usuário logado
      const idParaUsar = location.state?.targetContainerId || user.id;
      setContainerAtual(idParaUsar);
    }
  }, [user, location.state?.targetContainerId]);

  // 👇 Busca o nome do container (agora pode ser de outra pessoa)
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
          {location.state?.targetContainerId && location.state.targetContainerId !== user.id }
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