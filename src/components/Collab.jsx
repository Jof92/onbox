// src/components/Collab.jsx
import React, { useState, useEffect } from "react";
import "./Collab.css";
import { FaPaperPlane, FaUserPlus, FaEllipsisV } from "react-icons/fa";
import { supabase } from "../supabaseClient";

export default function Collab({ onClose, user }) {
  const [emailConvite, setEmailConvite] = useState("");
  const [notificacoes, setNotificacoes] = useState([]);
  const [integrantes, setIntegrantes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [removendo, setRemovendo] = useState(null);

  // 🔍 Depuração: verifique quem está logado
  useEffect(() => {
    if (user?.id) {
      console.log("✅ Collab: buscando notificações para user.id =", user.id);
      fetchNotificacoes();
      fetchIntegrantes();
    } else {
      console.warn("⚠️ Collab: user.id não disponível");
    }
  }, [user?.id]);

  // ==============================
  // 🔔 BUSCAR NOTIFICAÇÕES (convites + menções)
  // ==============================
  const fetchNotificacoes = async () => {
    try {
      const allNotificacoes = [];

      // 🔸 Convites pendentes
      const { data: convites, error: convitesError } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .eq("status", "pendente");

      if (convitesError) {
        console.error("Erro ao buscar convites:", convitesError);
      } else if (convites?.length > 0) {
        const convitesComPerfil = await Promise.all(
          convites.map(async (c) => {
            const { data: remetente } = await supabase
              .from("profiles")
              .select("id, nome, email, avatar_url")
              .eq("id", c.remetente_id)
              .maybeSingle();
            return { ...c, remetente, tipo: "convite" };
          })
        );
        allNotificacoes.push(...convitesComPerfil);
      }

      // 🔸 Notificações de menção
      const { data: mencoes, error: mencaoError } = await supabase
      .from("notificacoes") // <-- schema explícito
      .select(`
        id,
        user_id,
        remetente_id,
        nota_id,
        projeto_id,
        mensagem,
        lido,
        tipo,
        created_at,
        remetente:profiles!notificacoes_remetente_id_fkey(id, nome, avatar_url),
        nota:notas(id, nome),
        projeto:projects(id, name)
      `)
      .eq("user_id", user.id)
      .eq("lido", false);

      if (mencaoError) {
        console.error("Erro ao buscar menções:", mencaoError);
      } else if (mencoes?.length > 0) {
        const mencoesFormatadas = mencoes.map(m => ({
          ...m,
          tipo: m.tipo || "menção"
        }));
        allNotificacoes.push(...mencoesFormatadas);
        console.log("✅ Menções encontradas:", mencoesFormatadas);
      } else {
        console.log("ℹ️ Nenhuma menção encontrada para user.id:", user.id);
      }

      setNotificacoes(allNotificacoes);
    } catch (err) {
      console.error("Erro geral ao buscar notificações:", err);
      setNotificacoes([]);
    }
  };

  // ==============================
  // 👥 BUSCAR INTEGRANTES
  // ==============================
  const fetchIntegrantes = async () => {
    try {
      const { data: convitesAceitos, error: convitesError } = await supabase
        .from("convites")
        .select("*")
        .eq("remetente_id", user.id)
        .eq("status", "aceito");

      if (convitesError) {
        console.error("Erro ao buscar integrantes:", convitesError);
        setIntegrantes([]);
        return;
      }

      const integrantesComPerfil = await Promise.all(
        (convitesAceitos || []).map(async (c) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, nome, email, avatar_url")
            .ilike("email", c.email)
            .maybeSingle();

          return {
            convite_id: c.id,
            invited_email: c.email,
            profile_id: profile?.id || null,
            nome: profile?.nome || c.email,
            email: profile?.email || c.email,
            avatar_url: profile?.avatar_url || null,
          };
        })
      );

      setIntegrantes(integrantesComPerfil);
    } catch (err) {
      console.error("Erro ao buscar integrantes:", err);
      setIntegrantes([]);
    }
  };

  // ==============================
  // ✉️ ENVIAR CONVITE
  // ==============================
  const enviarConvite = async () => {
    if (!emailConvite.trim()) return alert("Digite um e-mail válido.");
    setEnviando(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .ilike("email", emailConvite)
        .maybeSingle();

      if (!profile) {
        alert("Usuário não encontrado no OnBox.");
        setEnviando(false);
        return;
      }

      const { data: existingInvite } = await supabase
        .from("convites")
        .select("*")
        .eq("email", profile.email)
        .eq("status", "pendente")
        .maybeSingle();

      if (existingInvite) {
        alert("Convite já enviado.");
        setEnviando(false);
        return;
      }

      const { error: insertError } = await supabase.from("convites").insert([
        {
          email: profile.email,
          remetente_id: user.id,
          status: "pendente",
        },
      ]);

      if (insertError) throw insertError;

      alert(`Convite enviado para ${profile.nome}`);
      setEmailConvite("");
      fetchNotificacoes();
    } catch (err) {
      console.error("Erro ao enviar convite:", err);
      alert("Erro ao enviar convite.");
    } finally {
      setEnviando(false);
    }
  };

  // ==============================
  // ✅ ACEITAR CONVITE
  // ==============================
  const aceitarConvite = async (convite) => {
    try {
      await supabase.from("convites").update({ status: "aceito" }).eq("id", convite.id);
      alert("Convite aceito!");
      fetchNotificacoes();
    } catch (err) {
      console.error("Erro ao aceitar convite:", err);
      alert("Erro ao aceitar convite.");
    }
  };

  // ==============================
  // 🔗 LER NOTIFICAÇÃO DE MENÇÃO
  // ==============================
  const lerMensagemMencoes = async (notificacao) => {
    try {
      await supabase.from("notificacoes").update({ lido: true }).eq("id", notificacao.id);
      // Redirecionar para a tarefa — ajuste conforme sua rota
      const url = `/task?nota_id=${notificacao.nota_id}`;
      window.location.href = url;
    } catch (err) {
      console.error("Erro ao marcar notificação como lida:", err);
    }
  };

  // ==============================
  // ❌ REMOVER INTEGRANTE
  // ==============================
  const removerIntegrante = async (item) => {
    const ok = window.confirm(`Remover ${item.nome} do seu container?`);
    if (!ok) return;
    try {
      setRemovendo(item.convite_id);
      await supabase.from("convites").delete().eq("id", item.convite_id);
      setIntegrantes((prev) =>
        prev.filter((i) => i.convite_id !== item.convite_id)
      );
      setMenuAberto(null);
      setRemovendo(null);
    } catch (err) {
      console.error("Erro ao remover integrante:", err);
      alert("Erro ao remover integrante.");
    }
  };

  return (
    <div className="collab-modal-overlay">
      <div className="collab-modal">
        <button className="overlay-close-btn" onClick={onClose}>
          ×
        </button>

        <div className="collab-header">
          <h2>Colaborações</h2>
        </div>

        <div className="collab-section">
          <h3>
            <FaUserPlus className="icon" /> Enviar Convite
          </h3>
          <div className="convite-form">
            <input
              type="email"
              placeholder="Digite o e-mail do colaborador..."
              value={emailConvite}
              onChange={(e) => setEmailConvite(e.target.value)}
            />
            <button
              className={`btn-enviar ${enviando ? "plane-fly" : ""}`}
              onClick={!enviando ? enviarConvite : undefined}
              disabled={enviando}
            >
              <FaPaperPlane className="plane-icon" />
              {!enviando && " Enviar"}
            </button>
          </div>
        </div>

        <hr />

        <div className="collab-section">
          <h3>Notificações</h3>
          {notificacoes.length === 0 ? (
            <p className="empty">Nenhuma notificação no momento.</p>
          ) : (
            notificacoes.map((n) => {
              if (n.tipo === "convite") {
                return (
                  <div className="notificacao-item" key={n.id}>
                    <span>
                      <strong>{n.remetente?.nome || "Usuário"}</strong> te convidou
                    </span>
                    <button
                      className="btn-aceitar"
                      onClick={() => aceitarConvite(n)}
                    >
                      Aceitar
                    </button>
                  </div>
                );
              } else if (n.tipo === "menção") {
                return (
                  <div className="notificacao-item" key={n.id}>
                    <span>
                      <strong>{n.remetente?.nome || "Alguém"}</strong> marcou você em um comentário na tarefa{" "}
                      <strong>{n.nota?.nome || "Sem nome"}</strong> do projeto{" "}
                      <strong>{n.projeto?.name || "Sem projeto"}</strong>
                    </span>
                    <button
                      className="btn-ler"
                      onClick={() => lerMensagemMencoes(n)}
                    >
                      Abrir
                    </button>
                  </div>
                );
              }
              return null;
            })
          )}
        </div>

        <hr />

        <div className="collab-section">
          <h3>Integrantes</h3>
          {integrantes.length === 0 ? (
            <p className="empty">Nenhum integrante ainda.</p>
          ) : (
            <div className="integrantes-list">
              {integrantes.map((i) => (
                <div
                  key={i.convite_id}
                  className={`integrante-item ${
                    removendo === i.convite_id ? "fade-out" : ""
                  }`}
                >
                  <div className="integrante-info">
                    {i.avatar_url ? (
                      <img
                        src={i.avatar_url}
                        alt={i.nome}
                        className="integrante-avatar"
                      />
                    ) : (
                      <div className="integrante-avatar placeholder">
                        {i.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="integrante-texto">
                      <strong>{i.nome}</strong>
                      <span>{i.email}</span>
                    </div>
                  </div>

                  <div className="integrante-menu">
                    <button
                      className="menu-btn"
                      onClick={() =>
                        setMenuAberto(
                          menuAberto === i.convite_id ? null : i.convite_id
                        )
                      }
                    >
                      <FaEllipsisV />
                    </button>

                    {menuAberto === i.convite_id && (
                      <div className="menu-opcoes">
                        <button onClick={() => removerIntegrante(i)}>
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}