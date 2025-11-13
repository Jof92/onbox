// src/components/ThinSidebar.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaCog, FaUpload, FaUserFriends, FaHome } from "react-icons/fa";
import "./ThinSidebar.css";
import Collab from "./Collab";
import ContainerSettings from "./ContainerSettings";
import { supabase } from "../supabaseClient";

export default function ThinSidebar({ containerAtual, setContainerAtual, user }) {
  const [showCollab, setShowCollab] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState(0);
  const [colaboradores, setColaboradores] = useState([]);
  const realtimeRef = useRef(null);

  // ✅ Busca total de notificações não lidas (convites pendentes + menções não lidas)
  const fetchNotificacoesNaoLidas = useCallback(async () => {
    if (!user?.id || !user?.email) {
      setNotificacoesNaoLidas(0);
      return;
    }

    try {
      // Convites pendentes
      const { data: convitesPendentes } = await supabase
        .from("convites")
        .select("id", { count: "exact" })
        .eq("email", user.email)
        .eq("status", "pendente");

      // Menções não lidas
      const { data: mencoesNaoLidas } = await supabase
        .from("notificacoes")
        .select("id", { count: "exact" })
        .eq("user_id", user.id)
        .eq("lido", false)

      const totalConvites = convitesPendentes?.length || 0;
      const totalMencoes = mencoesNaoLidas?.length || 0;
      setNotificacoesNaoLidas(totalConvites + totalMencoes);
    } catch (err) {
      console.error("Erro ao buscar notificações não lidas:", err);
      setNotificacoesNaoLidas(0);
    }
  }, [user?.id, user?.email]);

  const fetchColaboradores = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: convitesAceitos } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .eq("status", "aceito");

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
    } catch (err) {
      console.error("Erro ao buscar colaboradores:", err);
      setColaboradores([]);
    }
  }, [user?.id]);

  // ✅ Configurar Realtime
  useEffect(() => {
    if (!user?.id || !user?.email) return;

    fetchNotificacoesNaoLidas();
    fetchColaboradores();

    // Canal para convites (quando alguém te convida)
    const convitesChannel = supabase
      .channel("convites-pendentes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "convites",
          filter: `email=eq.${user.email},status=eq.pendente`
        },
        () => fetchNotificacoesNaoLidas()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "convites",
          filter: `email=eq.${user.email}`
        },
        (payload) => {
          // Atualiza se o status mudar (ex: aceito ou rejeitado)
          if (payload.new.status === "pendente" || payload.old?.status === "pendente") {
            fetchNotificacoesNaoLidas();
          }
        }
      )
      .subscribe();

    // Canal para menções
    const mencaoChannel = supabase
      .channel("mencoes-nao-lidas")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${user.id},tipo=eq.menção`
        },
        () => fetchNotificacoesNaoLidas()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${user.id},tipo=eq.menção`
        },
        (payload) => {
          if (payload.old?.lido !== payload.new.lido) {
            fetchNotificacoesNaoLidas();
          }
        }
      )
      .subscribe();

    realtimeRef.current = { convitesChannel, mencaoChannel };

    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current.convitesChannel);
        supabase.removeChannel(realtimeRef.current.mencaoChannel);
      }
    };
  }, [user?.id, user?.email, fetchNotificacoesNaoLidas, fetchColaboradores]);

  const handleOpenCollab = () => {
    setShowCollab(true);
    // O Collab vai marcar menções como lidas e aceitar convites
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
          {notificacoesNaoLidas > 0 && (
            <span className="badge">
              {notificacoesNaoLidas > 9 ? "9+" : notificacoesNaoLidas}
            </span>
          )}
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
            fetchNotificacoesNaoLidas(); // Para atualizar se algo foi lido/removido
          }}
          user={user}
          onOpenTask={() => {
            fetchNotificacoesNaoLidas(); // Atualiza ao abrir uma tarefa
          }}
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