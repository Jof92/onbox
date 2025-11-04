// src/components/Task.jsx
import React, { useState, useEffect, useRef } from "react";
import "./Task.css";
import { FiUploadCloud, FiUser } from "react-icons/fi";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import Lottie from "lottie-react";
import "./loader.css";

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

  // Obter ID do usuário logado
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

  // Atualiza sugestões de menção
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

  // Inserir menção
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

  // Carregar nota, anexos e comentários
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
          .select("id, conteudo, created_at, user_id")
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
            // campo para controle local de edição inline
            isEditing: false,
            editValue: undefined,
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
  }, [notaAtual?.id, userId]);

  // Salvar descrição
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

  // Adicionar comentário (sem usar loading global)
  const handleAddComentario = async () => {
    if (!notaAtual?.id || !userId || !comentario.trim()) return;
    setComentando(true);
    try {
      const { data: novoComentarioDB, error } = await supabase
        .from("comentarios")
        .insert({
          nota_id: notaAtual.id,
          user_id: userId,
          conteudo: comentario.trim(),
        })
        .select("id, conteudo, created_at, user_id")
        .single();

      if (error) throw error;

      const comentarioFormatado = {
        ...novoComentarioDB,
        profiles: userProfile || { nome: "Você", nickname: null, avatar_url: null },
        formattedDate: formatarDataComentario(novoComentarioDB.created_at),
        isEditing: false,
        editValue: undefined,
      };

      setComentarios((prev) => [comentarioFormatado, ...prev]);
      setComentario("");
      setSugestoesMencoes([]);

      // menções (mantive igual)
      const mencionados = comentario.match(/@(\S+)/g);
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
            mensagem: `${userProfile?.nickname || userProfile?.nome || "Você"} marcou você em um comentário na tarefa ${notaAtual.nome || notaAtual.name
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

  // Editar comentário (salvar)
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
            ? { ...c, conteudo: novoConteudo.trim(), isEditing: false, editValue: undefined }
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

  // Iniciar edição localmente
  const handleStartEdit = (comentarioId) => {
    setComentarios((prev) =>
      prev.map((c) =>
        c.id === comentarioId ? { ...c, isEditing: true, editValue: c.conteudo } : c
      )
    );
    setMenuAberto(null);
  };

  // Cancelar edição localmente
  const handleCancelEdit = (comentarioId) => {
    setComentarios((prev) =>
      prev.map((c) =>
        c.id === comentarioId ? { ...c, isEditing: false, editValue: undefined } : c
      )
    );
    setMenuAberto(null);
  };

  // Excluir comentário (sem confirmação)
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

  // Anexos (mantive como estava)
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
          onChange={(e) => setDescricao(e.target.value)}
          onBlur={handleSaveDescricao}
          placeholder="Clique aqui para adicionar uma descrição..."
          rows={2}
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

        {/* 🔹 Área do botão + loader lateral */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="coment-btn"
            onClick={handleAddComentario}
            disabled={loading || !userId || comentando}
          >
            Comentar
          </button>

          {/* Loader lateral aparece ao comentar OU ao excluir comentário */}
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
                    <strong>{nomeExibicao}</strong>
                    <span>{c.formattedDate}</span>
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

                  {/* === EDIÇÃO INLINE: se isEditing === true mostra textarea + Salvar/Cancelar === */}
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
                    <p>{c.conteudo}</p>
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
