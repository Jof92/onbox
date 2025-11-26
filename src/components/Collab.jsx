// src/components/Collab.jsx
import React, { useState, useEffect, useCallback } from "react";
import "./Collab.css";
import "./loader.css";
import { FaPaperPlane, FaUserPlus, FaEllipsisV, FaBell, FaArchive } from "react-icons/fa";
import { supabase } from "../supabaseClient";

export default function Collab({ onClose, user, onOpenTask }) {
  const [emailConvite, setEmailConvite] = useState("");
  const [convitesRecebidos, setConvitesRecebidos] = useState([]);
  const [mencoes, setMencoes] = useState([]);
  const [integrantes, setIntegrantes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [removendo, setRemovendo] = useState(null);
  const [loadingNotificacoes, setLoadingNotificacoes] = useState(true);
  const [loadingIntegrantes, setLoadingIntegrantes] = useState(true);
  const [activeTab, setActiveTab] = useState("convites-recebidos");

  // 🔔 Buscar convites recebidos e menções separadamente
  const fetchNotificacoes = useCallback(async () => {
    if (!user?.id || !user?.email) {
      setConvitesRecebidos([]);
      setMencoes([]);
      setLoadingNotificacoes(false);
      return;
    }

    setLoadingNotificacoes(true);
    try {
      // === Convites recebidos ===
      const { data: convites, error: convitesError } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .in("status", ["pendente", "aceito"]);

      let convitesFormatados = [];
      if (!convitesError && convites?.length) {
        convitesFormatados = await Promise.all(
          convites.map(async (c) => {
            const { data: remetente } = await supabase
              .from("profiles")
              .select("id, nome, email, avatar_url")
              .eq("id", c.remetente_id)
              .maybeSingle();
            return { ...c, remetente };
          })
        );
      }

      // === Menções ===
      const { data: notificacoesMencoes, error: mencaoError } = await supabase
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

      let mencoesFormatadas = [];
      if (!mencaoError && notificacoesMencoes?.length) {
        mencoesFormatadas = notificacoesMencoes.map((m) => ({
          ...m,
          tipo: m.tipo || "menção",
        }));
      }

      setConvitesRecebidos(convitesFormatados);
      setMencoes(mencoesFormatadas);
    } catch (err) {
      console.error("Erro geral ao buscar notificações:", err);
      setConvitesRecebidos([]);
      setMencoes([]);
    } finally {
      setLoadingNotificacoes(false);
    }
  }, [user?.id, user?.email]);

  // 👥 Buscar integrantes
  const fetchIntegrantes = useCallback(async () => {
    if (!user?.id) {
      setIntegrantes([]);
      setLoadingIntegrantes(false);
      return;
    }

    setLoadingIntegrantes(true);
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
    } finally {
      setLoadingIntegrantes(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotificacoes();
    fetchIntegrantes();
  }, [fetchNotificacoes, fetchIntegrantes]);

  // ✉️ ENVIAR CONVITE
  const enviarConvite = async () => {
    if (!emailConvite.trim()) return alert("Digite um e-mail válido.");
    setEnviando(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, nome, email, nickname")
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
          user_id: profile.id,
          nickname: profile.nickname,
          container_id: user.id,
          status: "pendente",
        },
      ]);

      if (error) throw error;

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

  // ✅ ACEITAR CONVITE
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

  // 🔗 ABRIR MENÇÃO
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

  // ❌ REMOVER INTEGRANTE
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
          <div className="collab-tabs">
            <button
              className={`tab-btn ${activeTab === "convites-recebidos" ? "active" : ""}`}
              onClick={() => setActiveTab("convites-recebidos")}
              aria-label="Convites recebidos"
            >
              <FaArchive className="icon" /> {/* ✅ Ícone válido no react-icons */}
            </button>
            <button
              className={`tab-btn ${activeTab === "notificacoes" ? "active" : ""}`}
              onClick={() => setActiveTab("notificacoes")}
              aria-label="Notificações"
            >
              <FaBell className="icon" />
            </button>
            <button
              className={`tab-btn ${activeTab === "enviar" ? "active" : ""}`}
              onClick={() => setActiveTab("enviar")}
              aria-label="Enviar convite"
            >
              <FaUserPlus className="icon" />
            </button>
          </div>
        </div>

        {/* Aba: Convites Recebidos — com avatar do remetente antes do nome */}
        {activeTab === "convites-recebidos" && (
          <div className="collab-section">
            <h3>Convites Recebidos</h3>
            {loadingNotificacoes ? (
              <div className="loader-container">
                <div className="loader"></div>
              </div>
            ) : convitesRecebidos.length === 0 ? (
              <p className="empty">Nenhum convite recebido.</p>
            ) : (
              convitesRecebidos.map((convite) => (
                <div
                  key={convite.id}
                  className={`notificacao-item ${convite.status === "aceito" ? "lida" : "nao-lida"}`}
                >
                  <div className="convite-remetente-info">
                    {convite.remetente?.avatar_url ? (
                      <img
                        src={convite.remetente.avatar_url}
                        alt={convite.remetente.nome || "Remetente"}
                        className="remetente-avatar"
                      />
                    ) : (
                      <div className="remetente-avatar placeholder">
                        {convite.remetente?.nome
                          ? convite.remetente.nome.charAt(0).toUpperCase()
                          : "?"}
                      </div>
                    )}
                    <span>
                      <strong>{convite.remetente?.nome || "Alguém"}</strong> te convidou
                      {convite.status === "aceito" && " (aceito)"}
                    </span>
                  </div>
                  {convite.status === "pendente" && (
                    <button className="btn-aceitar" onClick={() => aceitarConvite(convite)}>
                      Aceitar
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Aba: Notificações (Menções) */}
        {activeTab === "notificacoes" && (
          <div className="collab-section">
            <h3>Menções</h3>
            {loadingNotificacoes ? (
              <div className="loader-container">
                <div className="loader"></div>
              </div>
            ) : mencoes.length === 0 ? (
              <p className="empty">Nenhuma menção no momento.</p>
            ) : (
              mencoes.map((n) => (
                <div
                  key={n.id}
                  className={`notificacao-item ${n.lido ? "lida" : "nao-lida"}`}
                >
                  <span>{n.mensagem || "Você foi mencionado em uma tarefa."}</span>
                  <button
                    className="btn-ler"
                    onClick={() => lerMensagemMencoes(n)}
                    disabled={n.lido}
                  >
                    {n.lido ? "Aberto" : "Abrir"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Aba: Enviar Convite + Meus Integrantes */}
        {activeTab === "enviar" && (
          <>
            <div className="collab-section-convite">
              <h4>Enviar Convite</h4>
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

            <div className="collab-section1">
              <h3>Convidados do meu container</h3>
              {loadingIntegrantes ? (
                <div className="loader-container">
                  <div className="loader"></div>
                </div>
              ) : integrantes.length === 0 ? (
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
                          onClick={() =>
                            setMenuAberto(menuAberto === i.convite_id ? null : i.convite_id)
                          }
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
          </>
        )}
      </div>
    </div>
  );
}