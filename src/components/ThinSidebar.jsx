// src/components/ThinSidebar.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaCog, FaUserFriends, FaHome, FaCalendar } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./ThinSidebar.css";
import Collab from "./Collab";
import ContainerSettings from "./ContainerSettings";
import Agenda from "./Agenda";
import { supabase } from "../supabaseClient";

export default function ThinSidebar({ containerAtual, setContainerAtual, user }) {
  const navigate = useNavigate();

  const [showCollab, setShowCollab] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState(0);
  const [colaboradores, setColaboradores] = useState([]);
  const realtimeRef = useRef(null);

  const fetchNotificacoesNaoLidas = useCallback(async () => {
    if (!user?.id || !user?.email) {
      setNotificacoesNaoLidas(0);
      return;
    }

    try {
      const { data: convitesPendentes } = await supabase
        .from("convites")
        .select("id", { count: "exact" })
        .eq("email", user.email)
        .eq("status", "pendente");

      const { data: mencoesNaoLidas } = await supabase
        .from("notificacoes")
        .select("id", { count: "exact" })
        .eq("user_id", user.id)
        .eq("lido", false);

      const totalConvites = convitesPendentes?.length || 0;
      const totalMencoes = mencoesNaoLidas?.length || 0;
      setNotificacoesNaoLidas(totalConvites + totalMencoes);
    } catch (err) {
      console.error("Erro ao buscar notificações não lidas:", err);
      setNotificacoesNaoLidas(0);
    }
  }, [user?.id, user?.email]);

  const fetchColaboradores = useCallback(async () => {
    if (!user?.id || !user?.email) return;
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
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!user?.id || !user?.email) return;

    fetchNotificacoesNaoLidas();
    fetchColaboradores();

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
          if (payload.new.status === "pendente" || payload.old?.status === "pendente") {
            fetchNotificacoesNaoLidas();
          }
        }
      )
      .subscribe();

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
  };

  const handleTrocarContainer = (colaborador) => {
    const containerId = colaborador?.remetente?.id;
    if (!containerId) return;
    setContainerAtual(containerId);
    navigate(`/containers/${containerId}`);
  };

  const handleVoltarHome = () => {
    if (user?.id) {
      setContainerAtual(user.id);
      navigate(`/containers/${user.id}`);
    }
  };

  const handleOpenAgenda = () => {
    setShowAgenda(true);
  };

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
          title="Agenda"
          onClick={handleOpenAgenda}
        >
          <FaCalendar />
        </button>

        <button
          className="thin-btn"
          title="Minhas configurações"
          onClick={() => setShowSettings(true)}
        >
          <FaCog />
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
      fetchNotificacoesNaoLidas();
    }}
    user={user}
    onOpenTask={(data) => {
      const { tipo_navegacao, container_id, projeto_id, setor_id, pilha_id, nota_id } = data;
      
      // Navegar para o container correto se necessário
      if (container_id && container_id !== containerAtual) {
        setContainerAtual(container_id);
        navigate(`/containers/${container_id}`);
      }
      
      // Navegar baseado no tipo
      if (tipo_navegacao === 'container') {
        // Apenas ir para o container (já feito acima)
        console.log('Navegando para container:', container_id);
      } else if (tipo_navegacao === 'unidade' && (projeto_id || setor_id)) {
        // Navegar para projeto/setor com query params
        const entityId = projeto_id || setor_id;
        const queryParams = new URLSearchParams({
          entityId: entityId,
          type: setor_id ? 'setor' : 'project',
          containerId: container_id
        });
        navigate(`/cards/${entityId}?${queryParams.toString()}`, {
          state: {
            projectId: projeto_id,
            setorId: setor_id,
            entityType: setor_id ? 'setor' : 'project',
            containerId: container_id,
          }
        });
      } else if (tipo_navegacao === 'pilha' && pilha_id) {
        // Navegar para pilha dentro do projeto/setor
        const entityId = projeto_id || setor_id;
        const queryParams = new URLSearchParams({
          entityId: entityId,
          type: setor_id ? 'setor' : 'project',
          containerId: container_id
        });
        navigate(`/cards/${entityId}?${queryParams.toString()}`, {
          state: {
            projectId: projeto_id,
            setorId: setor_id,
            pilhaId: pilha_id,
            entityType: setor_id ? 'setor' : 'project',
            containerId: container_id,
          }
        });
      } else if (tipo_navegacao === 'nota' && nota_id) {
        // Navegar para nota específica com query params incluindo nota
        const entityId = projeto_id || setor_id;
        const queryParams = new URLSearchParams({
          entityId: entityId,
          type: setor_id ? 'setor' : 'project',
          containerId: container_id,
          nota: nota_id
        });
        navigate(`/cards/${entityId}?${queryParams.toString()}`, {
          state: {
            projectId: projeto_id,
            setorId: setor_id,
            pilhaId: pilha_id,
            notaId: nota_id,
            entityType: setor_id ? 'setor' : 'project',
            containerId: container_id,
            openNota: true,
          }
        });
      }
      
      fetchNotificacoesNaoLidas();
      setShowCollab(false);
    }}
  />
)}

      {showSettings && (
        <ContainerSettings
          onClose={() => setShowSettings(false)}
          containerId={user?.id}
          user={user}
        />
      )}

      {showAgenda && (
        <Agenda
          user={user}
          currentContainerId={containerAtual} // ✅ CORREÇÃO AQUI
          onClose={() => setShowAgenda(false)}
        />
      )}
    </>
  );
}