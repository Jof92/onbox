// src/components/Task.jsx
import React, { useState, useEffect, useRef } from "react";
import "./Task.css";
import { FiUploadCloud, FiUser, FiCalendar } from "react-icons/fi";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import "./loader.css";

const MencoesTooltip = ({ children, userId, projetoAtual, containerId, supabaseClient }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);
  const [loadingTooltip, setLoadingTooltip] = useState(false);

  useEffect(() => {
    if (!showTooltip || tooltipData || loadingTooltip || !userId) {
      return;
    }

    const fetchTooltipData = async () => {
      setLoadingTooltip(true);
      try {
        const { data: profile, error: profileError } = await supabaseClient
          .from("profiles")
          .select("nome, nickname, funcao, container, avatar_url")
          .eq("id", userId)
          .single();

        if (profileError || !profile) {
          console.warn("Perfil não encontrado para ID:", userId);
          setTooltipData({ error: true });
          return;
        }

        let pertenceA = "Não pertence a nenhuma entidade";

        const { data: projectMembers } = await supabaseClient
          .from("project_members")
          .select("project_id")
          .eq("user_id", userId);

        if (Array.isArray(projectMembers) && projectMembers.length > 0) {
          const projectIds = projectMembers.map(pm => pm.project_id);
          const { data: projectNames } = await supabaseClient
            .from("projects")
            .select("name")
            .in("id", projectIds)
            .limit(1);
          if (Array.isArray(projectNames) && projectNames[0]?.name) {
            pertenceA = `Membro do Projeto "${projectNames[0].name}"`;
          }
        } else {
          const { data: setorMembers } = await supabaseClient
            .from("setor_members")
            .select("setor_id")
            .eq("user_id", userId);

          if (Array.isArray(setorMembers) && setorMembers.length > 0) {
            const setorIds = setorMembers.map(sm => sm.setor_id);
            const { data: setorNames } = await supabaseClient
              .from("setores")
              .select("name")
              .in("id", setorIds)
              .limit(1);
            if (Array.isArray(setorNames) && setorNames[0]?.name) {
              pertenceA = `Membro do Setor "${setorNames[0].name}"`;
            }
          }
        }

        setTooltipData({
          nome: profile.nickname || profile.nome || "Usuário",
          funcao: profile.funcao || "Função não informada",
          container_id: profile.container || "—",
          pertenceA,
          avatar_url: profile.avatar_url,
        });
      } catch (err) {
        console.error("Erro ao carregar tooltip de menção:", err);
        setTooltipData({ error: true });
      } finally {
        setLoadingTooltip(false);
      }
    };

    fetchTooltipData();
  }, [showTooltip, userId, tooltipData, loadingTooltip, supabaseClient]);

  if (!userId) {
    return (
      <span
        style={{
          color: "#1E88E5",
          textDecoration: "underline",
          cursor: "default",
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      style={{
        position: "relative",
        color: "#1E88E5",
        textDecoration: "underline",
        cursor: "pointer",
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div
          className="mencoes-tooltip"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "8px",
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "6px",
            padding: "10px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            zIndex: 1000,
            width: "220px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: "14px",
          }}
        >
          {loadingTooltip ? (
            <span>Carregando...</span>
          ) : tooltipData?.error ? (
            <span>Usuário não encontrado</span>
          ) : tooltipData ? (
            <>
              {tooltipData.avatar_url ? (
                <img
                  src={tooltipData.avatar_url}
                  alt={tooltipData.nome}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    marginBottom: "6px",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#e0e0e0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "6px",
                    fontWeight: "bold",
                    color: "#555",
                  }}
                >
                  {(tooltipData.nome || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <strong>{tooltipData.nome}</strong>
              <div>{tooltipData.funcao}</div>
              <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                Container ID: {tooltipData.container_id}
              </div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "4px", textAlign: "center" }}>
                {tooltipData.pertenceA}
              </div>
            </>
          ) : null}
        </div>
      )}
    </span>
  );
};

const renderMencoes = (conteudo, perfilesPorId, projetoAtual, containerId, supabaseClient) => {
  if (!conteudo) return conteudo;

  const regex = /@([\p{L}\p{N}_-]+)/gu;
  let match;
  const partes = [];
  let lastIndex = 0;

  while ((match = regex.exec(conteudo)) !== null) {
    const textoAntes = conteudo.slice(lastIndex, match.index);
    if (textoAntes) partes.push(textoAntes);

    const nickname = match[1];
    const usuario = Object.values(perfilesPorId).find(
      (p) => p && p.id && (p.nickname === nickname || p.nome === nickname)
    );

    if (usuario && usuario.id) {
      partes.push(
        <MencoesTooltip
          key={match.index}
          userId={usuario.id}
          projetoAtual={projetoAtual}
          containerId={containerId}
          supabaseClient={supabaseClient}
        >
          <span className="mencoes">@{nickname}</span>
        </MencoesTooltip>
      );
    } else {
      partes.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < conteudo.length) {
    partes.push(conteudo.slice(lastIndex));
  }

  return (
    <div className="comentario-texto">
      {partes}
    </div>
  );
};

const mencionaUsuario = (conteudo, userProfile) => {
  if (!userProfile || !conteudo) return false;
  const termos = [userProfile.nickname, userProfile.nome].filter(Boolean);
  const regex = /@([\p{L}\p{N}_-]+)/gu;
  const mencoes = [...conteudo.matchAll(regex)].map(m => m[1]);
  return mencoes.some(m => termos.includes(m));
};

export default function Task({ onClose, projetoAtual, notaAtual, containerId }) {
  const [descricao, setDescricao] = useState("");
  const [comentario, setComentario] = useState("");
  const [comentarios, setComentarios] = useState([]);
  const [anexosSalvos, setAnexosSalvos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [comentando, setComentando] = useState(false);
  const [loadingExcluir, setLoadingExcluir] = useState(false);
  const [sugestoesMencoes, setSugestoesMencoes] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome, nickname, avatar_url")
          .eq("id", user.id)
          .single();
        setUserProfile(profile);
      }
    };
    fetchUser();
  }, []);

  const handleComentarioChange = (e) => {
    const valor = e.target.value;
    setComentario(valor);
    const cursor = e.target.selectionStart;
    const textoAteCursor = valor.slice(0, cursor);
    const match = textoAteCursor.match(/@([\p{L}\p{N}_-]*)$/u);

    if (match && match[1]) {
      const termo = match[1];
      if (termo.length >= 1) {
        supabase
          .from("profiles")
          .select("id, nome, nickname, avatar_url")
          .ilike("nickname", `%${termo}%`)
          .limit(5)
          .then(({ data }) => setSugestoesMencoes(data || []));
      } else setSugestoesMencoes([]);
    } else setSugestoesMencoes([]);
  };

  const inserirMencoes = (usuario) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const textoAntes = comentario.slice(0, cursorPos);
    const textoDepois = comentario.slice(cursorPos);
    const nomeParaMencoes = usuario.nickname || usuario.nome;
    const novoTextoAntes = textoAntes.replace(/@[\p{L}\p{N}_-]*$/u, `@${nomeParaMencoes}`);
    const novoTexto = novoTextoAntes + " " + textoDepois;
    setComentario(novoTexto);
    setSugestoesMencoes([]);
    setTimeout(() => {
      const novaPos = novoTextoAntes.length + 1;
      textarea.focus();
      textarea.setSelectionRange(novaPos, novaPos);
    }, 0);
  };

  const formatarDataComentario = (dateString) => {
    const date = new Date(dateString);
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);
    const isSameDay = (d1, d2) =>
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
    const hora = date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (isSameDay(date, hoje)) return `Hoje às ${hora}`;
    if (isSameDay(date, ontem)) return `Ontem às ${hora}`;
    return `em ${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()} às ${hora}`;
  };

  const podeEditarComentario = (createdAt, autorId) => {
    if (autorId !== userId) return false;
    const agora = new Date();
    const criadoEm = new Date(createdAt);
    const diffMin = (agora - criadoEm) / (1000 * 60);
    return diffMin < 60;
  };

  useEffect(() => {
    if (!notaAtual?.id) {
      setDescricao("");
      setComentarios([]);
      setAnexosSalvos([]);
      return;
    }
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: nota } = await supabase
          .from("notas")
          .select("descricao")
          .eq("id", notaAtual.id)
          .single();
        if (isMounted) setDescricao(nota?.descricao || "");

        const { data: comentariosData } = await supabase
          .from("comentarios")
          .select("id, conteudo, created_at, user_id, agendado_por")
          .eq("nota_id", notaAtual.id)
          .order("created_at", { ascending: false });

        if (comentariosData?.length > 0) {
          const userIds = [...new Set(comentariosData.map((c) => c.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, nome, nickname, avatar_url")
            .in("id", userIds);
          const profileMap = {};
          profiles?.forEach((p) => (profileMap[p.id] = p));
          const comentariosComUsuario = comentariosData.map((c) => ({
            ...c,
            profiles: profileMap[c.user_id] || { nome: "Usuário", nickname: null, avatar_url: null },
            formattedDate: formatarDataComentario(c.created_at),
            isEditing: false,
            editValue: undefined,
            mencionaUsuarioLogado: mencionaUsuario(c.conteudo, userProfile),
            estaAgendadoPeloUsuario: c.agendado_por === userId,
          }));
          if (isMounted) setComentarios(comentariosComUsuario);
        } else setComentarios([]);

        const { data: anexos } = await supabase
          .from("anexos")
          .select("id, file_name, file_url")
          .eq("nota_id", notaAtual.id)
          .order("created_at", { ascending: true });
        if (isMounted) setAnexosSalvos(anexos || []);
      } catch (err) {
        console.error("Erro ao carregar dados da nota:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [notaAtual?.id, userId, userProfile]);

  const handleEnviarParaAgenda = async (comentarioId) => {
    if (!userId || !comentarioId || typeof comentarioId !== 'string') return;

    const { data, error } = await supabase
      .from("comentarios")
      .update({ agendado_por: userId })
      .eq("id", comentarioId)
      .select("id, agendado_por");

    if (error) {
      console.error("❌ Erro ao adicionar à agenda:", error);
      alert("Erro ao adicionar à agenda: " + (error.message || "tente novamente"));
    } else {
      if (data && data[0]?.agendado_por === userId) {
        setComentarios(prev =>
          prev.map(c =>
            c.id === comentarioId ? { ...c, estaAgendadoPeloUsuario: true } : c
          )
        );
        alert("Adicionado à agenda!");
      } else {
        alert("Não foi possível adicionar à agenda. Verifique permissões.");
      }
    }
  };

  const handleSaveDescricao = async () => {
    if (!notaAtual?.id) return;
    setLoading(true);
    try {
      await supabase
        .from("notas")
        .update({ descricao: descricao || null })
        .eq("id", notaAtual.id);
    } catch (err) {
      console.error("Erro ao salvar descrição:", err);
      alert("Erro ao salvar descrição.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComentario = async () => {
    if (!notaAtual?.id || !userId || !comentario.trim()) return;
    setComentando(true);
    try {
      const conteudoTrim = comentario.trim();

      // ✅ INSERT + SELECT para obter o ID REAL
      const { data: novoComentario, error: insertError } = await supabase
        .from("comentarios")
        .insert({
          nota_id: notaAtual.id,
          user_id: userId,
          conteudo: conteudoTrim,
        })
        .select('id, nota_id, user_id, conteudo, created_at, agendado_por')
        .single();

      if (insertError || !novoComentario) {
        throw new Error(insertError?.message || "Falha ao criar comentário");
      }

      const { id, created_at } = novoComentario;

      const novoComentarioLocal = {
        id,
        nota_id: notaAtual.id,
        user_id: userId,
        conteudo: conteudoTrim,
        created_at,
        agendado_por: null,
        profiles: userProfile || { nome: "Você", nickname: null, avatar_url: null },
        formattedDate: formatarDataComentario(created_at),
        isEditing: false,
        editValue: undefined,
        mencionaUsuarioLogado: mencionaUsuario(conteudoTrim, userProfile),
        estaAgendadoPeloUsuario: false,
      };

      setComentarios((prev) => [novoComentarioLocal, ...prev]);
      setComentario("");
      setSugestoesMencoes([]);

      // Notificações de menção
      const mencionados = conteudoTrim.match(/@(\S+)/g);
      if (mencionados?.length > 0) {
        const nomesMencionados = mencionados.map((m) => m.slice(1));
        const { data: candidatos } = await supabase
          .from("profiles")
          .select("id, nickname, nome")
          .or(
            `nickname.in.(${nomesMencionados.map((n) => `"${n}"`).join(",")}),nome.in.(${nomesMencionados
              .map((n) => `"${n}"`)
              .join(",")})`
          );
        const mencionadosValidos = (candidatos || []).filter((p) =>
          nomesMencionados.includes(p.nickname || p.nome)
        );
        for (const u of mencionadosValidos) {
          await supabase.from("notificacoes").insert({
            user_id: u.id,
            remetente_id: userId,
            nota_id: notaAtual.id,
            projeto_id: projetoAtual?.id || null,
            tipo: "menção",
            mensagem: `${userProfile?.nickname || userProfile?.nome || "Você"} marcou você em um comentário na tarefa ${notaAtual?.nome || notaAtual?.name
              } do projeto ${projetoAtual?.nome || projetoAtual?.name || "Sem projeto"}`,
            lido: false,
          });
        }
      }
    } catch (err) {
      console.error("Erro ao salvar comentário:", err);
      alert("Erro ao salvar comentário.");
    } finally {
      setComentando(false);
    }
  };

  const handleSaveEdit = async (comentarioId) => {
    const alvo = comentarios.find((c) => c.id === comentarioId);
    const novoConteudo = (alvo && (alvo.editValue !== undefined ? alvo.editValue : alvo.conteudo)) || "";
    if (!novoConteudo.trim()) return;

    setLoading(true);
    try {
      await supabase
        .from("comentarios")
        .update({ conteudo: novoConteudo.trim() })
        .eq("id", comentarioId)
        .eq("user_id", userId);

      setComentarios((prev) =>
        prev.map((c) =>
          c.id === comentarioId
            ? { 
                ...c, 
                conteudo: novoConteudo.trim(), 
                isEditing: false, 
                editValue: undefined,
                mencionaUsuarioLogado: mencionaUsuario(novoConteudo.trim(), userProfile),
              }
            : c
        )
      );
    } catch (err) {
      console.error("Erro ao editar comentário:", err);
      alert("Erro ao editar comentário.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (comentarioId) => {
    setComentarios((prev) =>
      prev.map((c) =>
        c.id === comentarioId ? { ...c, isEditing: true, editValue: c.conteudo } : c
      )
    );
    setMenuAberto(null);
  };

  const handleCancelEdit = (comentarioId) => {
    setComentarios((prev) =>
      prev.map((c) =>
        c.id === comentarioId ? { ...c, isEditing: false, editValue: undefined } : c
      )
    );
    setMenuAberto(null);
  };

  const handleExcluirComentario = async (comentarioId) => {
    setLoadingExcluir(true);
    try {
      await supabase
        .from("comentarios")
        .delete()
        .eq("id", comentarioId)
        .eq("user_id", userId);
      setComentarios((prev) => prev.filter((c) => c.id !== comentarioId));
      setMenuAberto(null);
    } catch (err) {
      console.error("Erro ao excluir comentário:", err);
      alert("Erro ao excluir comentário.");
    } finally {
      setLoadingExcluir(false);
    }
  };

  const handleAddAnexos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!notaAtual?.id || !userId || files.length === 0) return;
    setLoading(true);
    try {
      for (const file of files) {
        const fileName = `anexos/${notaAtual.id}_${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("anexos").upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("anexos").getPublicUrl(fileName);
        const fileUrl = data.publicUrl;
        const { data: insertedAnexo } = await supabase
          .from("anexos")
          .insert({
            nota_id: notaAtual.id,
            user_id: userId,
            file_name: file.name,
            file_url: fileUrl,
          })
          .select()
          .single();
        setAnexosSalvos((prev) => [...prev, insertedAnexo]);
      }
    } catch (err) {
      console.error("Erro ao enviar anexo:", err);
      alert("Erro ao enviar um ou mais anexos.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoverAnexo = async (anexoId, fileUrl) => {
    if (!window.confirm("Deseja realmente excluir este anexo?")) return;
    setLoading(true);
    try {
      const url = new URL(fileUrl);
      const fileName = url.pathname.split("/").pop();
      await supabase.storage.from("anexos").remove([fileName]);
      await supabase.from("anexos").delete().eq("id", anexoId).eq("user_id", userId);
      setAnexosSalvos((prev) => prev.filter((a) => a.id !== anexoId));
    } catch (err) {
      console.error("Erro ao excluir anexo:", err);
      alert("Erro ao excluir anexo.");
    } finally {
      setLoading(false);
    }
  };

  const getNomeProjeto = () => projetoAtual?.nome || projetoAtual?.name || "Sem projeto";
  const getNomeNota = () => notaAtual?.nome || notaAtual?.name || "Sem nota";

  const perfilesPorId = {};
  comentarios.forEach(c => {
    if (c.profiles?.id) {
      perfilesPorId[c.profiles.id] = c.profiles;
    }
  });

  if (loading) {
    return (
      <div className="task-loading-container">
        <Loading size={200} />
      </div>
    );
  }

  return (
    <div className="task-modal">
      <div className="task-header">
        <div className="task-header-titles">
          <span className="project-name">{getNomeProjeto()}</span>
          <div className="sub-info">
            <span className="nota-name">{getNomeNota()}</span>
          </div>
        </div>
      </div>

      <h2 className="task-title">{getNomeNota()}</h2>

      <div className="descricao-section">
        <h3>Descrição</h3>
        <textarea
          className="descricao-editor-textarea"
          value={descricao}
          onChange={(e) => {
            setDescricao(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={handleSaveDescricao}
          placeholder="Clique aqui para adicionar uma descrição..."
          rows={3}
          style={{
            minHeight: "3.25em",
            height: "8em",
            resize: "none",
          }}
          disabled={loading}
        />
      </div>

      <div className="anexos-section">
        <div className="anexos-header">
          <h3>Anexos</h3>
          <label htmlFor="fileInput" className="upload-btn">
            <FiUploadCloud />
            <span>Enviar</span>
          </label>
          <input
            type="file"
            id="fileInput"
            hidden
            multiple
            onChange={handleAddAnexos}
            disabled={loading}
          />
        </div>
        <div className="anexos-lista">
          {anexosSalvos.map((anexo) => (
            <div key={anexo.id} className="anexo-item">
              <a href={anexo.file_url} target="_blank" rel="noopener noreferrer">
                {anexo.file_name}
              </a>
              <button
                type="button"
                title="Remover"
                onClick={() => handleRemoverAnexo(anexo.id, anexo.file_url)}
                aria-label="Remover anexo"
                disabled={loading}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="comentarios-section">
        <h3>Comentários e atividades</h3>
        <div style={{ position: "relative" }}>
          <textarea
            ref={textareaRef}
            placeholder="Escrever um comentário... (use @ para mencionar)"
            value={comentario}
            onChange={handleComentarioChange}
            rows={3}
            disabled={loading}
          />

          {sugestoesMencoes.length > 0 && (
            <div
              className="sugestoes-list"
              style={{
                position: "absolute",
                zIndex: 10,
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                marginTop: "4px",
                width: "250px",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {sugestoesMencoes.map((u) => {
                const nomeExibicao = u.nickname || u.nome;
                return (
                  <div
                    key={u.id}
                    onClick={() => inserirMencoes(u)}
                    style={{
                      padding: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={nomeExibicao}
                        style={{ width: "24px", height: "24px", borderRadius: "50%" }}
                      />
                    ) : (
                      <FiUser style={{ width: "24px", height: "24px" }} />
                    )}
                    <span>{nomeExibicao}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
          <button
            type="button"
            className="coment-btn"
            onClick={handleAddComentario}
            disabled={loading || !userId || comentando || !comentario.trim()}
          >
            Comentar
          </button>
          {(comentando || loadingExcluir) && <span className="loader"></span>}
        </div>

        <div className="comentarios-lista">
          {comentarios.map((c) => {
            const profile = c.profiles || {
              nome: "Usuário",
              nickname: null,
              avatar_url: null,
            };
            const nomeExibicao = profile.nickname || profile.nome;
            const editavel = podeEditarComentario(c.created_at, c.user_id);
            const podeEnviarParaAgenda = c.mencionaUsuarioLogado && !c.estaAgendadoPeloUsuario;

            return (
              <div key={c.id} className="comentario-item">
                <div className="comentario-avatar">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={nomeExibicao}
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "block";
                      }}
                    />
                  ) : (
                    <FiUser className="avatar-placeholder" />
                  )}
                </div>
                <div className="comentario-conteudo">
                  <div className="comentario-header">
                    <div className="comentario-autor">
                      <strong>{nomeExibicao}</strong>
                    </div>
                    <div className="comentario-meta" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{c.formattedDate}</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {podeEnviarParaAgenda && (
                          <button
                            type="button"
                            title="Adicionar à minha agenda"
                            onClick={() => handleEnviarParaAgenda(c.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#1E88E5",
                              fontSize: "16px",
                            }}
                            aria-label="Adicionar à agenda"
                          >
                            <FiCalendar />
                          </button>
                        )}
                        {editavel && !c.isEditing && (
                          <button
                            type="button"
                            className="comentario-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuAberto(menuAberto === c.id ? null : c.id);
                            }}
                            aria-label="Opções"
                          >
                            ⋮
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {c.isEditing ? (
                    <div>
                      <textarea
                        value={c.editValue !== undefined ? c.editValue : c.conteudo}
                        onChange={(e) =>
                          setComentarios((prev) =>
                            prev.map((x) =>
                              x.id === c.id ? { ...x, editValue: e.target.value } : x
                            )
                          )
                        }
                        rows={3}
                        style={{ width: "100%", resize: "none", marginTop: "4px" }}
                      />
                      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(c.id)}
                          disabled={loading}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelEdit(c.id)}
                          disabled={loading}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="comentario-texto">
                      {renderMencoes(
                        c.conteudo,
                        perfilesPorId,
                        projetoAtual,
                        containerId,
                        supabase
                      )}
                    </div>
                  )}

                  {menuAberto === c.id && editavel && !c.isEditing && (
                    <div className="comentario-menu">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(c.id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExcluirComentario(c.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}