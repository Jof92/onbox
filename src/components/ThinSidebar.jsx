// src/components/ThinSidebar.jsx
import React, { useState, useEffect, useCallback } from "react";
import { FaCog, FaUpload, FaUserFriends, FaHome } from "react-icons/fa";
import "./ThinSidebar.css";
import Collab from "./Collab";
import ContainerSettings from "./ContainerSettings";
import { supabase } from "../supabaseClient";

export default function ThinSidebar({ containerAtual, setContainerAtual, user }) {
  const [showCollab, setShowCollab] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificacoesPendentes, setNotificacoesPendentes] = useState(0);
  const [colaboradores, setColaboradores] = useState([]);

  // ✅ Envolver fetchNotificacoes com useCallback
  const fetchNotificacoes = useCallback(async () => {
    if (!user?.email) return;
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
  }, [user?.email]);

  // ✅ Envolver fetchColaboradores com useCallback
  const fetchColaboradores = useCallback(async () => {
    if (!user?.email) return;
    try {
      const { data: convitesAceitos, error } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .eq("status", "aceito");
      if (error) throw error;

      const colaboradoresComPerfil = await Promise.all(
        (convitesAceitos || []).map(async (c) => {
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
  }, [user?.email]);

  // ✅ Agora as funções estão nas dependências
  useEffect(() => {
    fetchNotificacoes();
    fetchColaboradores();
  }, [user?.email, fetchNotificacoes, fetchColaboradores]);

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

  const meuContainerId = user?.id;

  return (
    <>
      <aside className="thin-sidebar">
        <button
          className="thin-btn"
          title="Voltar ao meu container"
          onClick={handleVoltarHome}
        >
          <FaHome />
        </button>

        <button
          className="thin-btn"
          title="Minhas configurações"
          onClick={() => setShowSettings(true)}
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

      {showCollab && (
        <Collab
          onClose={() => {
            setShowCollab(false);
            fetchColaboradores();
          }}
          user={user}
          onOpenTask={() => {}}
        />
      )}

      {showSettings && (
        <ContainerSettings
          onClose={() => setShowSettings(false)}
          containerId={meuContainerId}
          user={user}
        />
      )}
    </>
  );
}