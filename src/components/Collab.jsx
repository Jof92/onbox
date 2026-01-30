import React, { useState, useEffect, useCallback } from "react";
import "./Collab.css";
import "./loader.css";
import { FaPaperPlane, FaUserPlus, FaEllipsisV, FaBell, FaArchive, FaTimes, FaTrash } from "react-icons/fa";
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

  const [allProjects, setAllProjects] = useState([]);
  const [allSetores, setAllSetores] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState({ projetos: [], setores: [] });
  const [loadingProjectsSetores, setLoadingProjectsSetores] = useState(true);

  // 🆕 Contador de notificações por aba
  const [notifCounts, setNotifCounts] = useState({
    mencoes: 0,
    convitesRecebidos: 0
  });

  // 🆕 Função para formatar data de forma relativa
  const formatarDataRelativa = (dataString) => {
    if (!dataString) return "";
    
    const data = new Date(dataString);
    const agora = new Date();
    const diferencaMs = agora - data;
    const diferencaMinutos = Math.floor(diferencaMs / (1000 * 60));
    const diferencaHoras = Math.floor(diferencaMs / (1000 * 60 * 60));
    const diferencaDias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24));

    if (diferencaMinutos < 1) {
      return "Agora mesmo";
    } else if (diferencaMinutos < 60) {
      return `${diferencaMinutos} min atrás`;
    } else if (diferencaHoras < 24) {
      return `${diferencaHoras}h atrás`;
    } else if (diferencaDias === 1) {
      return "Ontem";
    } else if (diferencaDias < 7) {
      return `${diferencaDias} dias atrás`;
    } else {
      // Formato: DD/MM/YYYY HH:MM
      return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

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

  const fetchNotificacoes = useCallback(async () => {
    if (!user?.id || !user?.email) {
      setConvitesRecebidos([]);
      setMencoes([]);
      setLoadingNotificacoes(false);
      return;
    }

    setLoadingNotificacoes(true);
    try {
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
        const pilhaIds = [...new Set(notificacoesMencoes.map(n => n.pilha_id).filter(Boolean))];
        const containerIds = [...new Set(notificacoesMencoes.map(n => n.container_id).filter(Boolean))];
        const unidadeIds = [...new Set(
          notificacoesMencoes
            .map(n => n.projeto_id || n.setor_id)
            .filter(Boolean)
        )];

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

      // 🆕 Atualizar contadores
      setNotifCounts({
        mencoes: mencoesFormatadas.filter(m => !m.lido).length,
        convitesRecebidos: convitesFormatados.filter(c => c.status === "pendente").length
      });

    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
      setConvitesRecebidos([]);
      setMencoes([]);
    } finally {
      setLoadingNotificacoes(false);
    }
  }, [user?.id, user?.email]);

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

  const fetchProjectsAndSetores = useCallback(async () => {
    if (!user?.id) {
      setAllProjects([]);
      setAllSetores([]);
      setLoadingProjectsSetores(false);
      return;
    }
    setLoadingProjectsSetores(true);
    try {
      const { data: proj, error: projError } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id);
      if (projError) console.warn("Erro ao carregar projetos:", projError);
      setAllProjects(proj || []);

      const { data: set, error: setError } = await supabase
        .from("setores")
        .select("id, name")
        .eq("user_id", user.id);
      if (setError) console.warn("Erro ao carregar setores:", setError);
      setAllSetores(set || []);
    } catch (err) {
      console.error("Erro ao carregar projetos e setores:", err);
    } finally {
      setLoadingProjectsSetores(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotificacoes();
    fetchIntegrantes();
    fetchProjectsAndSetores();
  }, [fetchNotificacoes, fetchIntegrantes, fetchProjectsAndSetores]);

  // 🆕 Marcar todas as menções como lidas quando abrir a aba
  const handleTabChange = async (tabName) => {
    setActiveTab(tabName);

    if (tabName === "notificacoes") {
      // Marcar todas as menções não lidas como lidas
      const mencoesNaoLidas = mencoes.filter(m => !m.lido);
      if (mencoesNaoLidas.length > 0) {
        const ids = mencoesNaoLidas.map(m => m.id);
        try {
          await supabase
            .from("notificacoes")
            .update({ lido: true })
            .in("id", ids);
          
          // Atualizar estado local
          setMencoes(prev => prev.map(m => ({ ...m, lido: true })));
          setNotifCounts(prev => ({ ...prev, mencoes: 0 }));
        } catch (err) {
          console.error("Erro ao marcar menções como lidas:", err);
        }
      }
    }
  };

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
        .eq("remetente_id", user.id)
        .eq("status", "pendente")
        .maybeSingle();

      if (existingInvite) {
        alert("Convite já enviado.");
        setEnviando(false);
        return;
      }

      const { error: inviteError } = await supabase.from("convites").insert([
        {
          email: profile.email,
          remetente_id: user.id,
          user_id: profile.id,
          nickname: profile.nickname,
          container_id: user.id,
          status: "pendente",
        },
      ]);

      if (inviteError) throw inviteError;

      const permissionsToInsert = [];
      selectedPermissions.projetos.forEach(projectId => {
        permissionsToInsert.push({
          colaborador_id: profile.id,
          container_id: user.id,
          projeto_id: projectId,
          setor_id: null,
        });
      });
      selectedPermissions.setores.forEach(setorId => {
        permissionsToInsert.push({
          colaborador_id: profile.id,
          container_id: user.id,
          projeto_id: null,
          setor_id: setorId,
        });
      });

      if (permissionsToInsert.length > 0) {
        const { error: permError } = await supabase
          .from("permissoes_colaboradores")
          .insert(permissionsToInsert);
        if (permError) console.error("Erro ao salvar permissões prévias:", permError);
      }

      alert(`Convite enviado para ${profile.nome}`);
      setEmailConvite("");
      setSelectedPermissions({ projetos: [], setores: [] });
      fetchNotificacoes();
    } catch (err) {
      console.error("Erro ao enviar convite:", err);
      alert("Erro ao enviar convite.");
    } finally {
      setEnviando(false);
    }
  };

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

  // 🆕 Função para excluir notificação
  const excluirNotificacao = async (notificacaoId) => {
    const ok = window.confirm("Deseja excluir esta notificação?");
    if (!ok) return;
    
    try {
      await supabase
        .from("notificacoes")
        .delete()
        .eq("id", notificacaoId);
      
      // Atualizar estado local
      setMencoes(prev => prev.filter(n => n.id !== notificacaoId));
      
      // Atualizar contador se necessário
      const mencoesRestantes = mencoes.filter(n => n.id !== notificacaoId && !n.lido);
      setNotifCounts(prev => ({ ...prev, mencoes: mencoesRestantes.length }));
      
    } catch (err) {
      console.error("Erro ao excluir notificação:", err);
      alert("Erro ao excluir notificação.");
    }
  };

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

  const togglePermission = (type, id) => {
    setSelectedPermissions(prev => {
      const currentList = prev[type];
      const newList = currentList.includes(id)
        ? currentList.filter(item => item !== id)
        : [...currentList, id];
      return { ...prev, [type]: newList };
    });
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
                onClick={() => handleTabChange("notificacoes")}
                aria-label="Menções"
              >
                <FaBell className="icon" />
                {notifCounts.mencoes > 0 && (
                  <span className="tab-badge">
                    {notifCounts.mencoes > 9 ? "9+" : notifCounts.mencoes}
                  </span>
                )}
              </button>
              <button
                className={`tab-btn ${activeTab === "enviar" ? "active" : ""}`}
                onClick={() => handleTabChange("enviar")}
                aria-label="Enviar convite"
              >
                <FaUserPlus className="icon" />
              </button>
              <button
                className={`tab-btn ${activeTab === "convites-recebidos" ? "active" : ""}`}
                onClick={() => handleTabChange("convites-recebidos")}
                aria-label="Convites recebidos"
              >
                <FaArchive className="icon" />
                {notifCounts.convitesRecebidos > 0 && (
                  <span className="tab-badge">
                    {notifCounts.convitesRecebidos > 9 ? "9+" : notifCounts.convitesRecebidos}
                  </span>
                )}
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
                    <div className="convite-text-info">
                      <span>
                        <strong>{convite.remetente?.nome || "Alguém"}</strong> te convidou
                        {convite.status === "aceito" && " (aceito)"}
                      </span>
                      {convite.created_at && (
                        <span className="notificacao-data">
                          {formatarDataRelativa(convite.created_at)}
                        </span>
                      )}
                    </div>
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
                    <div className="notificacao-conteudo-wrapper">
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

                        {/* 🆕 Data da notificação */}
                        {n.created_at && (
                          <span className="notificacao-data">
                            {formatarDataRelativa(n.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="notificacao-actions">
                        <button
                          className="btn-abrir-notificacao"
                          onClick={() => navegarParaCaminho(n, partesCaminho.length - 1)}
                          title="Abrir tarefa"
                        >
                          Abrir
                        </button>
                        <button
                          className="delete-icon"
                          onClick={() => excluirNotificacao(n.id)}
                          title="Excluir notificação"
                        >
                          <FaTrash className="icon" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

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

              {emailConvite.trim() && (
                <div className="permissoes-previas-section">
                  <h4>Definir Permissões Prévias</h4>
                  {loadingProjectsSetores ? (
                    <div className="loader-container">
                      <div className="loader"></div>
                    </div>
                  ) : (
                    <>
                      {allProjects.length > 0 && (
                        <div className="permissoes-group">
                          <h5>Projetos</h5>
                          <div className="checkbox-list">
                            {allProjects.map(proj => (
                              <label key={proj.id} className="checkbox-item">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.projetos.includes(proj.id)}
                                  onChange={() => togglePermission('projetos', proj.id)}
                                />
                                <span>{proj.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {allSetores.length > 0 && (
                        <div className="permissoes-group">
                          <h5>Setores</h5>
                          <div className="checkbox-list">
                            {allSetores.map(setor => (
                              <label key={setor.id} className="checkbox-item">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.setores.includes(setor.id)}
                                  onChange={() => togglePermission('setores', setor.id)}
                                />
                                <span>{setor.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {allProjects.length === 0 && allSetores.length === 0 && (
                        <p className="empty">Nenhum projeto ou setor disponível para permissões.</p>
                      )}
                    </>
                  )}
                </div>
              )}
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