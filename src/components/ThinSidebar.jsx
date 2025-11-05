// src/components/ThinSidebar.jsx
import React, { useState, useEffect } from "react";
import { FaCog, FaUpload, FaUserFriends, FaHome } from "react-icons/fa";
import "./ThinSidebar.css";
import Collab from "./Collab";
import ContainerSettings from "./ContainerSettings"; // 👈 Import do novo componente
import { supabase } from "../supabaseClient";

export default function ThinSidebar({ containerAtual, setContainerAtual, user }) {
  const [showCollab, setShowCollab] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // 👈 Estado para configurações
  const [notificacoesPendentes, setNotificacoesPendentes] = useState(0);
  const [colaboradores, setColaboradores] = useState([]);

  useEffect(() => {
    if (user?.email) {
      fetchNotificacoes();
      fetchColaboradores();
    }
  }, [user?.email]);

  const fetchNotificacoes = async () => {
    try {
      const { data: convites, error } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .eq("status", "pendente");
      if (error) throw error;
      setNotificacoesPendentes(convites.length);
    } catch {
      setNotificacoesPendentes(0);
    }
  };

  const fetchColaboradores = async () => {
    try {
      const { data: convitesAceitos, error } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .eq("status", "aceito");
      if (error) throw error;

      const colaboradoresComPerfil = await Promise.all(
        convitesAceitos.map(async (c) => {
          const { data: remetente } = await supabase
            .from("profiles")
            .select("id,nome,email,avatar_url,container")
            .eq("id", c.remetente_id)
            .maybeSingle();
          return { ...c, remetente };
        })
      );

      setColaboradores(colaboradoresComPerfil);
    } catch {
      setColaboradores([]);
    }
  };

  const handleOpenCollab = () => {
    setShowCollab(true);
    setNotificacoesPendentes(0);
  };

  const handleTrocarContainer = (colaborador) => {
    if (!colaborador?.remetente?.id) return;
    setContainerAtual(colaborador.remetente.id);
  };

  const handleVoltarHome = () => {
    if (user?.id) setContainerAtual(user.id);
  };

  return (
    <>
      <aside className="thin-sidebar">
        {/* Botões principais */}
        <button
          className="thin-btn"
          title="Voltar ao meu container"
          onClick={handleVoltarHome}
        >
          <FaHome />
        </button>

        <button
          className="thin-btn"
          title="Configurações"
          onClick={() => setShowSettings(true)} // 👈 Abre as configurações
        >
          <FaCog />
        </button>

        <button className="thin-btn" title="Enviar / Carregar XML">
          <FaUpload />
        </button>

        <button
          className="thin-btn thin-btn-collab"
          title="Colaboração"
          onClick={handleOpenCollab}
        >
          <FaUserFriends />
          {notificacoesPendentes > 0 && <span className="badge"></span>}
        </button>

        {/* 🔹 Grupo de colaboradores */}
        <div className="thin-collab-group">
          {colaboradores.map((c) => (
            <button
              key={c.id}
              className={`thin-btn thin-btn-avatar ${
                containerAtual === c.remetente?.id ? "active" : ""
              }`}
              title={c.remetente?.nome || "Colaborador"}
              onClick={() => handleTrocarContainer(c)}
            >
              {c.remetente?.avatar_url ? (
                <img
                  src={c.remetente.avatar_url}
                  alt={c.remetente.nome}
                  className="avatar-btn"
                />
              ) : (
                <span className="avatar-placeholder">
                  {c.remetente?.nome?.charAt(0) || "?"}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Modal de Colaboração */}
      {showCollab && (
        <Collab
          onClose={() => {
            setShowCollab(false);
            fetchColaboradores();
          }}
          containerAtual={containerAtual}
          user={user}
          onAtualizarNotificacoes={fetchNotificacoes}
        />
      )}

      {/* Modal de Configurações do Container */}
      {showSettings && (
        <ContainerSettings
          onClose={() => setShowSettings(false)}
          containerId={containerAtual}
          user={user}
        />
      )}
    </>
  );
}