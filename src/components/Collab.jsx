// src/components/Collab.jsx
import React, { useState, useEffect, useCallback } from "react";
import "./Collab.css";
import { FaPaperPlane, FaUserPlus, FaEllipsisV } from "react-icons/fa";
import { supabase } from "../supabaseClient";

export default function Collab({ onClose, user, onOpenTask }) {
  const [emailConvite, setEmailConvite] = useState("");
  const [notificacoes, setNotificacoes] = useState([]);
  const [integrantes, setIntegrantes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [removendo, setRemovendo] = useState(null);

  // 🔔 Buscar notificações com useCallback
  const fetchNotificacoes = useCallback(async () => {
    if (!user?.id || !user?.email) return;

    try {
      const allNotificacoes = [];

      // Convites (pendentes + aceitos)
      const { data: convites, error: convitesError } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .in("status", ["pendente", "aceito"]);

      if (convitesError) {
        console.error("Erro ao buscar convites:", convitesError);
      } else if (convites?.length) {
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

      // Menções
      const { data: mencoes, error: mencaoError } = await supabase
        .from("notificacoes")
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
        .eq("user_id", user.id);

      if (mencaoError) {
        console.error("Erro ao buscar menções:", mencaoError);
      } else if (mencoes?.length) {
        const mencoesFormatadas = mencoes.map((m) => ({
          ...m,
          tipo: m.tipo || "menção",
        }));
        allNotificacoes.push(...mencoesFormatadas);
      }

      allNotificacoes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setNotificacoes(allNotificacoes);
    } catch (err) {
      console.error("Erro geral ao buscar notificações:", err);
      setNotificacoes([]);
    }
  }, [user?.id, user?.email]); // ✅ Dependências explícitas

  // 👥 Buscar integrantes com useCallback
  const fetchIntegrantes = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: convitesAceitos, error } = await supabase
        .from("convites")
        .select("*")
        .eq("remetente_id", user.id)
        .eq("status", "aceito");

      if (error) {
        console.error("Erro ao buscar integrantes:", error);
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
  }, [user?.id]); // ✅ Dependência explícita

  // ✅ Agora as funções estão estáveis e nas dependências corretas
  useEffect(() => {
    fetchNotificacoes();
    fetchIntegrantes();
  }, [fetchNotificacoes, fetchIntegrantes]); // ✅ Correto!

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

      const { error } = await supabase.from("convites").insert([
        {
          email: profile.email,
          remetente_id: user.id,
          status: "pendente",
        },
      ]);

      if (error) throw error;

      alert(`Convite enviado para ${profile.nome}`);
      setEmailConvite("");
      fetchNotificacoes(); // Atualiza as notificações
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
  // 🔗 LER MENÇÃO
  // ==============================
  const lerMensagemMencoes = async (notificacao) => {
    if (notificacao.lido) return;

    try {
      await supabase.from("notificacoes").update({ lido: true }).eq("id", notificacao.id);
      fetchNotificacoes();
      onClose();
      if (onOpenTask) {
        onOpenTask({
          nota_id: notificacao.nota_id,
          projeto_id: notificacao.projeto_id,
          projeto_nome: notificacao.projeto?.name || "Projeto",
          nota_nome: notificacao.nota?.nome || "Tarefa",
        });
      }
    } catch (err) {
      console.error("Erro ao marcar menção como lida:", err);
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
      setIntegrantes((prev) => prev.filter((i) => i.convite_id !== item.convite_id));
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
            <>
              {notificacoes.map((n, index) => {
                const tipo = n.tipo || (n.email ? "convite" : "menção");
                const isLido = tipo === "menção" ? n.lido : n.status === "aceito";

                let content = null;

                if (tipo === "convite") {
                  const remetenteNome = n.remetente?.nome || n.remetente_id?.substring(0, 8) || "Alguém";
                  content = (
                    <>
                      <span>
                        <strong>{remetenteNome}</strong> te convidou
                        {n.status === "aceito" && " (aceito)"}
                      </span>
                      {n.status === "pendente" && (
                        <button className="btn-aceitar" onClick={() => aceitarConvite(n)}>
                          Aceitar
                        </button>
                      )}
                    </>
                  );
                } else if (tipo === "menção") {
                  const remetenteNome = n.remetente?.nome || "Alguém";
                  const notaNome = n.nota?.nome || "uma tarefa";
                  const projetoNome = n.projeto?.name || "um projeto";

                  content = (
                    <>
                      <span>
                        <strong>{remetenteNome}</strong> marcou você na tarefa{" "}
                        <strong>{notaNome}</strong> do projeto <strong>{projetoNome}</strong>
                        {n.lido && " (lido)"}
                      </span>
                      <button
                        className="btn-ler"
                        onClick={() => lerMensagemMencoes(n)}
                        disabled={n.lido}
                      >
                        {n.lido ? "Aberto" : "Abrir"}
                      </button>
                    </>
                  );
                } else {
                  content = (
                    <span style={{ color: "#d9534f" }}>
                      <em>Notificação inválida (tipo: {String(n.tipo)})</em>
                    </span>
                  );
                }

                return (
                  <div
                    key={n.id || `fallback-${index}`}
                    className={`notificacao-item ${isLido ? "lida" : "nao-lida"}`}
                  >
                    {content}
                  </div>
                );
              })}
            </>
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
                  className={`integrante-item ${removendo === i.convite_id ? "fade-out" : ""}`}
                >
                  <div className="integrante-info">
                    {i.avatar_url ? (
                      <img src={i.avatar_url} alt={i.nome} className="integrante-avatar" />
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
                      onClick={() => setMenuAberto(menuAberto === i.convite_id ? null : i.convite_id)}
                    >
                      <FaEllipsisV />
                    </button>

                    {menuAberto === i.convite_id && (
                      <div className="menu-opcoes">
                        <button onClick={() => removerIntegrante(i)}>Remover</button>
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