import React, { useState, useEffect, useCallback } from "react";
import "./Collab.css";
import "./loader.css";
import { FaPaperPlane, FaUserPlus, FaEllipsisV, FaBell, FaArchive, FaTimes } from "react-icons/fa";
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
  const [activeTab, setActiveTab] = useState("notificacoes");

  // Função para mapear o tipo da nota para classe de estilo
  const getTipoClasse = (tipoNota) => {
    if (!tipoNota) return "";
    const mapa = {
      "Lista": "tipo-lista",
      "Atas": "tipo-atas",
      "Tarefas": "tipo-tarefas",
      "Nota rápida": "tipo-nota-rapida",
      "RDO": "tipo-rdo",
    };
    return mapa[tipoNota] || "tipo-lista";
  };

  // ✅ Fechar com ESC ou clique fora
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (e.target.classList.contains("collab-modal-overlay")) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // 🔔 Buscar notificações — COM CAMINHO HIERÁRQUICO E TIPO DA NOTA
  const fetchNotificacoes = useCallback(async () => {
    if (!user?.id || !user?.email) {
      setConvitesRecebidos([]);
      setMencoes([]);
      setLoadingNotificacoes(false);
      return;
    }

    setLoadingNotificacoes(true);
    try {
      // Convites recebidos
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

      // Buscar notificações com tipo da nota incluso
      const { data: notificacoesMencoes, error: mencaoError } = await supabase
        .from("notificacoes")
        .select(`
          id,
          user_id,
          remetente_id,
          nota_id,
          pilha_id,
          container_id,
          projeto_id,
          setor_id,
          mensagem,
          lido,
          tipo,
          created_at,
          remetente:profiles!notificacoes_remetente_id_fkey(id, nome, avatar_url),
          nota:notas(id, nome, tipo)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      let mencoesFormatadas = [];

      if (!mencaoError && notificacoesMencoes?.length) {
        // Coletar IDs únicos
        const pilhaIds = [...new Set(notificacoesMencoes.map(n => n.pilha_id).filter(Boolean))];
        const containerIds = [...new Set(notificacoesMencoes.map(n => n.container_id).filter(Boolean))];
        const unidadeIds = [...new Set(
          notificacoesMencoes
            .map(n => n.projeto_id || n.setor_id)
            .filter(Boolean)
        )];

        // Buscar nomes: container vem de PROFILES, pilhas usam "title"
        const [pilhasRes, containersRes, unidadesRes] = await Promise.all([
          pilhaIds.length
            ? supabase.from("pilhas").select("id, title").in("id", pilhaIds)
            : Promise.resolve({ data: [] }),
          containerIds.length
            ? supabase.from("profiles").select("id, nickname, nome").in("id", containerIds)
            : Promise.resolve({ data: [] }),
          unidadeIds.length
            ? supabase.from("projects").select("id, name").in("id", unidadeIds)
            : Promise.resolve({ data: [] })
        ]);

        const pilhaMap = new Map(pilhasRes.data?.map(p => [p.id, p]) || []);
        const containerMap = new Map(containersRes.data?.map(c => [c.id, c]) || []);
        const unidadeMap = new Map(unidadesRes.data?.map(u => [u.id, u]) || []);

        mencoesFormatadas = notificacoesMencoes.map((n) => {
          const container = containerMap.get(n.container_id);
          const pilha = pilhaMap.get(n.pilha_id);
          const unidade = unidadeMap.get(n.projeto_id) || unidadeMap.get(n.setor_id);

          const containerNome = container?.nickname || container?.nome || "Container";

          const caminho = [
            containerNome,
            unidade?.name || "Unidade",
            pilha?.title || "Pilha",
            n.nota?.nome || "Tarefa"
          ].join(" / ");

          return {
            ...n,
            tipo: n.tipo || "menção",
            caminho
          };
        });
      }

      setConvitesRecebidos(convitesFormatados);
      setMencoes(mencoesFormatadas);
    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
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

  // ✉️ Enviar convite
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

  // ✅ Aceitar convite
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

  // 🎯 Navegar para parte específica do caminho
  const navegarParaCaminho = async (notificacao, nivel) => {
    try {
      if (!notificacao.lido) {
        await supabase.from("notificacoes").update({ lido: true }).eq("id", notificacao.id);
        fetchNotificacoes();
      }

      onClose();

      if (!onOpenTask) return;

      if (nivel === 0) {
        onOpenTask({ container_id: notificacao.container_id, tipo_navegacao: 'container' });
      } else if (nivel === 1) {
        onOpenTask({ container_id: notificacao.container_id, projeto_id: notificacao.projeto_id, setor_id: notificacao.setor_id, tipo_navegacao: 'unidade' });
      } else if (nivel === 2) {
        onOpenTask({ container_id: notificacao.container_id, projeto_id: notificacao.projeto_id, setor_id: notificacao.setor_id, pilha_id: notificacao.pilha_id, tipo_navegacao: 'pilha' });
      } else {
        onOpenTask({
          container_id: notificacao.container_id,
          projeto_id: notificacao.projeto_id,
          setor_id: notificacao.setor_id,
          pilha_id: notificacao.pilha_id,
          nota_id: notificacao.nota_id,
          tipo_navegacao: 'nota'
        });
      }
    } catch (err) {
      console.error("Erro ao navegar:", err);
    }
  };

  // ❌ Remover integrante
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
        <div className="collab-header">
          <h2>Colaborações</h2>
          <div className="collab-header-actions">
            <div className="collab-tabs">
              <button
                className={`tab-btn ${activeTab === "notificacoes" ? "active" : ""}`}
                onClick={() => setActiveTab("notificacoes")}
                aria-label="Menções"
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
              <button
                className={`tab-btn ${activeTab === "convites-recebidos" ? "active" : ""}`}
                onClick={() => setActiveTab("convites-recebidos")}
                aria-label="Convites recebidos"
              >
                <FaArchive className="icon" />
              </button>
            </div>
            <button
              className="collab-close-btn"
              onClick={onClose}
              aria-label="Fechar"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Aba: Convites Recebidos */}
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

        {/* Aba: Menções — COM CAMINHO HIERÁRQUICO E BOTÃO ABRIR NO CANTO DIREITO */}
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
              mencoes.map((n) => {
                const partesCaminho = n.caminho ? n.caminho.split(" / ") : [];
                const tipoClasse = getTipoClasse(n.nota?.tipo);

                return (
                  <div
                    key={n.id}
                    className={`notificacao-item ${n.lido ? "lida" : "nao-lida"} ${tipoClasse}`}
                  >
                    <div className="notificacao-mensagem">
                      {n.mensagem || "Você foi mencionado em uma tarefa."}
                    
                      <div className="notificacao-caminho">
                        {partesCaminho.map((parte, index) => (
                          <React.Fragment key={index}>
                            <span
                              className="caminho-parte"
                              onClick={() => navegarParaCaminho(n, index)}
                              title={`Ir para ${parte}`}
                            >
                              {parte}
                            </span>
                            {index < partesCaminho.length - 1 && (
                              <span className="caminho-separador"> / </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    <button
                      className="btn-abrir-notificacao"
                      onClick={() => navegarParaCaminho(n, partesCaminho.length - 1)}
                      title="Abrir tarefa"
                    >
                      Abrir
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Aba: Enviar + Integrantes */}
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