// src/components/Task.jsx
import React, { useState, useEffect, useRef } from "react";
import "./Task.css";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ComentariosSection from "./TaskComentarios";

// Componente de chip de responsável
const ChipResponsavel = ({ responsavel, onRemove, disabled }) => {
  const nomeExibicao = responsavel.nome_exibicao || "Usuário";
  const isExterno = !responsavel.usuario_id;

  return (
    <span className={`chip-responsavel ${isExterno ? 'chip-externo' : ''}`}>
      {nomeExibicao}
      {!disabled && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove(responsavel);
          }}
          className="chip-remove"
        >
          ×
        </span>
      )}
    </span>
  );
};

export default function Task({ onClose, projetoAtual, notaAtual, containerId }) {
  const [descricao, setDescricao] = useState("");
  const [anexosSalvos, setAnexosSalvos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [meuNome, setMeuNome] = useState("Você");
  const [dataEntregaTarefa, setDataEntregaTarefa] = useState(""); // ✅ Novo estado
  const modalRef = useRef(null);

  // Estados dos Objetivos
  const [objetivos, setObjetivos] = useState([]);
  const [showObjetivos, setShowObjetivos] = useState(false);
  const [novoObjetivoTexto, setNovoObjetivoTexto] = useState("");
  const [inputResponsavel, setInputResponsavel] = useState({});
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState({});

  // Fechar modal ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (onClose && modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (onClose) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [onClose]);

  // Carregar usuário logado
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

        const safeProfile = profile || { nome: "Você", nickname: "usuario", avatar_url: null };
        setUserProfile(safeProfile);
        setMeuNome(safeProfile.nome || "Você");
      }
    };
    fetchUser();
  }, []);

  // Carregar dados da nota
  useEffect(() => {
    if (!notaAtual?.id) {
      setDescricao("");
      setAnexosSalvos([]);
      setDataEntregaTarefa(""); // ✅ Reset da data
      return;
    }

    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: nota } = await supabase
          .from("notas")
          .select("descricao, data_entrega") // ✅ Inclui data_entrega
          .eq("id", notaAtual.id)
          .single();
        if (isMounted) {
          setDescricao(nota?.descricao || "");
          setDataEntregaTarefa(nota?.data_entrega || ""); // ✅ Define a data
        }

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
    return () => { isMounted = false; };
  }, [notaAtual?.id]);

  // Carregar objetivos ao abrir a nota
  useEffect(() => {
    if (!notaAtual?.id) {
      setObjetivos([]);
      setShowObjetivos(false);
      return;
    }

    const fetchObjetivos = async () => {
      setLoading(true);
      try {
        const { data: checklist } = await supabase
          .from("checklists")
          .select("id")
          .eq("nota_id", notaAtual.id)
          .single();

        if (!checklist) {
          setObjetivos([]);
          setShowObjetivos(false);
          return;
        }

        const { data: items } = await supabase
          .from("checklist_items")
          .select("*")
          .eq("checklist_id", checklist.id)
          .order("created_at", { ascending: true });

        const itemIds = items.map(i => i.id);
        let respMap = {};
        if (itemIds.length > 0) {
          const { data: responsaveis } = await supabase
            .from("checklist_responsaveis")
            .select("*")
            .in("checklist_item_id", itemIds);

          if (responsaveis) {
            respMap = responsaveis.reduce((acc, r) => {
              if (!acc[r.checklist_item_id]) acc[r.checklist_item_id] = [];
              acc[r.checklist_item_id].push({
                id: r.id,
                usuario_id: r.usuario_id,
                nome_externo: r.nome_externo,
                nome_exibicao: r.nome_externo || "Usuário"
              });
              return acc;
            }, {});
          }
        }

        const objetivosCompletos = items.map(item => ({
          id: item.id,
          texto: item.description || "",
          concluido: item.is_completed || false,
          dataEntrega: item.data_entrega || null,
          responsaveis: respMap[item.id] || [],
          checklist_id: checklist.id
        }));

        setObjetivos(objetivosCompletos);
        setShowObjetivos(true);
      } catch (err) {
        console.error("Erro ao carregar objetivos:", err);
        setObjetivos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchObjetivos();
  }, [notaAtual?.id]);

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

  // ✅ Nova função: salvar data de entrega da tarefa
  const handleSalvarDataEntregaTarefa = async (novaData) => {
    if (!notaAtual?.id) return;
    setLoading(true);
    try {
      await supabase
        .from("notas")
        .update({ data_entrega: novaData || null })
        .eq("id", notaAtual.id);
      setDataEntregaTarefa(novaData || "");
    } catch (err) {
      console.error("Erro ao salvar data de entrega da tarefa:", err);
      alert("Erro ao salvar data de entrega.");
    } finally {
      setLoading(false);
    }
  };

  // Adicionar anexos
  const handleAddAnexos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!notaAtual?.id || !userId || files.length === 0) return;

    setLoading(true);
    try {
      for (const file of files) {
        const sanitizeFileName = (name) => {
          return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_+/g, '_')
            .trim()
            .replace(/^_+|_+$/g, '');
        };

        const originalName = file.name;
        const safeName = sanitizeFileName(originalName);
        const fileName = `anexos/${notaAtual.id}_${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from("anexos").upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("anexos").getPublicUrl(fileName);
        const fileUrl = data.publicUrl;

        const { data: insertedAnexo } = await supabase
          .from("anexos")
          .insert({
            nota_id: notaAtual.id,
            user_id: userId,
            file_name: originalName,
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

  // Remover anexo
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

  // ============= Objetivos =============

  const criarChecklistSeNecessario = async () => {
    if (!notaAtual?.id) return null;

    const { data: checklist, error: selectError } = await supabase
      .from("checklists")
      .select("id")
      .eq("nota_id", notaAtual.id)
      .single();

    if (checklist) {
      return checklist.id;
    }

    const { data: novo, error: insertError } = await supabase
      .from("checklists")
      .insert({ nota_id: notaAtual.id })
      .select("id")
      .single();

    if (insertError || !novo) {
      console.error("Erro ao criar checklist:", insertError);
      return null;
    }

    return novo.id;
  };

  const adicionarObjetivo = async () => {
    if (!novoObjetivoTexto.trim()) return;
    setLoading(true);
    try {
      const checklistId = await criarChecklistSeNecessario();
      if (!checklistId) {
        alert("Não foi possível acessar o checklist da nota.");
        return;
      }

      const { data: item, error } = await supabase
        .from("checklist_items")
        .insert({
          checklist_id: checklistId,
          description: novoObjetivoTexto.trim(),
          is_completed: false,
          data_entrega: null
        })
        .select()
        .single();

      if (error) {
        console.error("Erro do Supabase ao inserir objetivo:", error);
        alert("Erro ao salvar objetivo: " + (error.message || "Verifique o console."));
        return;
      }

      if (!item) {
        console.error("Inserção bem-sucedida, mas nenhum dado retornado");
        alert("Erro inesperado: objetivo não retornado.");
        return;
      }

      setObjetivos(prev => [...prev, {
        id: item.id,
        texto: item.description,
        concluido: item.is_completed,
        dataEntrega: item.data_entrega,
        responsaveis: [],
        checklist_id: checklistId
      }]);
      setNovoObjetivoTexto("");
      setShowObjetivos(true);
    } catch (err) {
      console.error("Erro inesperado na função adicionarObjetivo:", err);
      alert("Erro inesperado ao adicionar objetivo.");
    } finally {
      setLoading(false);
    }
  };

  const toggleConclusao = async (id, concluidoAtual) => {
    const novoValor = !concluidoAtual;
    setObjetivos(prev => prev.map(o => o.id === id ? { ...o, concluido: novoValor } : o));
    try {
      await supabase
        .from("checklist_items")
        .update({ is_completed: novoValor })
        .eq("id", id);
    } catch (err) {
      console.error("Erro ao atualizar conclusão:", err);
      setObjetivos(prev => prev.map(o => o.id === id ? { ...o, concluido: concluidoAtual } : o));
    }
  };

  const atualizarDataEntrega = async (id, data) => {
    setObjetivos(prev => prev.map(o => o.id === id ? { ...o, dataEntrega: data } : o));
    try {
      await supabase
        .from("checklist_items")
        .update({ data_entrega: data || null })
        .eq("id", id);
    } catch (err) {
      console.error("Erro ao atualizar data de entrega:", err);
    }
  };

  const removerObjetivo = async (id) => {
    if (!window.confirm("Deseja realmente excluir este objetivo?")) return;
    setObjetivos(prev => prev.filter(o => o.id !== id));
    try {
      await supabase
        .from("checklist_items")
        .delete()
        .eq("id", id);
    } catch (err) {
      console.error("Erro ao excluir objetivo:", err);
    }
  };

  // ============= Responsáveis =============

  const handleResponsavelInputChange = (e, objetivoId) => {
    const valor = e.target.value;
    setInputResponsavel(prev => ({ ...prev, [objetivoId]: valor }));
    if (valor.startsWith("@") && valor.length > 1 && containerId) {
      const termo = valor.slice(1).toLowerCase();
      supabase
        .from("convites")
        .select("user_id")
        .eq("container_id", containerId)
        .eq("status", "aceito")
        .then(async ({ data: convites }) => {
          const userIds = convites?.map(c => c.user_id).filter(Boolean) || [];
          if (userIds.length === 0) {
            setSugestoesResponsavel(prev => ({ ...prev, [objetivoId]: [] }));
            return;
          }
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, nickname, nome")
            .in("id", userIds);
          const sugestoes = profiles?.filter(p =>
            (p.nickname?.toLowerCase().includes(termo)) ||
            (p.nome?.toLowerCase().includes(termo))
          ) || [];
          setSugestoesResponsavel(prev => ({ ...prev, [objetivoId]: sugestoes.slice(0, 10) }));
        });
    } else {
      setSugestoesResponsavel(prev => ({ ...prev, [objetivoId]: [] }));
    }
  };

  const adicionarResponsavelExterno = async (nome, objetivoId) => {
    if (!nome.trim()) return;
    const item = objetivos.find(o => o.id === objetivoId);
    if (!item || item.concluido) return;
    if (item.responsaveis.some(r => r.nome_externo === nome && !r.usuario_id)) return;

    try {
      const { data } = await supabase
        .from("checklist_responsaveis")
        .insert({
          checklist_item_id: objetivoId,
          nome_externo: nome.trim(),
          usuario_id: null
        })
        .select()
        .single();

      if (!data) return;

      setObjetivos(prev =>
        prev.map(o =>
          o.id === objetivoId
            ? {
                ...o,
                responsaveis: [
                  ...o.responsaveis,
                  {
                    id: data.id,
                    nome_externo: nome.trim(),
                    nome_exibicao: nome.trim(),
                    usuario_id: null
                  }
                ]
              }
            : o
        )
      );
      setInputResponsavel(prev => ({ ...prev, [objetivoId]: "" }));
    } catch (err) {
      console.error("Erro ao adicionar responsável externo:", err);
    }
  };

  const adicionarResponsavelInterno = async (perfil, objetivoId) => {
    const item = objetivos.find(o => o.id === objetivoId);
    if (!item || item.concluido) return;
    if (item.responsaveis.some(r => r.usuario_id === perfil.id)) return;

    try {
      const { data } = await supabase
        .from("checklist_responsaveis")
        .insert({
          checklist_item_id: objetivoId,
          usuario_id: perfil.id,
          nome_externo: null
        })
        .select()
        .single();

      if (!data) return;

      setObjetivos(prev =>
        prev.map(o =>
          o.id === objetivoId
            ? {
                ...o,
                responsaveis: [
                  ...o.responsaveis,
                  {
                    id: data.id,
                    usuario_id: perfil.id,
                    nome_exibicao: perfil.nome || perfil.nickname || "Usuário",
                    nome: perfil.nome,
                    nickname: perfil.nickname
                  }
                ]
              }
            : o
        )
      );
      setInputResponsavel(prev => ({ ...prev, [objetivoId]: "" }));
      setSugestoesResponsavel(prev => ({ ...prev, [objetivoId]: [] }));
    } catch (err) {
      console.error("Erro ao adicionar responsável interno:", err);
    }
  };

  const removerResponsavel = async (responsavelId, objetivoId) => {
    setObjetivos(prev =>
      prev.map(o =>
        o.id === objetivoId
          ? { ...o, responsaveis: o.responsaveis.filter(r => r.id !== responsavelId) }
          : o
      )
    );
    try {
      await supabase
        .from("checklist_responsaveis")
        .delete()
        .eq("id", responsavelId);
    } catch (err) {
      console.error("Erro ao remover responsável:", err);
    }
  };

  // ============= Utilitários =============
  const getNomeProjeto = () => projetoAtual?.nome || projetoAtual?.name || "Sem projeto";
  const getNomeNota = () => notaAtual?.nome || notaAtual?.name || "Sem nota";
  const progressoPercent = objetivos.length
    ? Math.round((objetivos.filter(o => o.concluido).length / objetivos.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="task-modal" ref={modalRef}>
        <div className="task-loading-container">
          <Loading size={200} />
        </div>
      </div>
    );
  }

  return (
    <div className="task-modal" ref={modalRef}>
      <div className="task-header">
        <div className="task-header-titles">
          <span className="project-name">{getNomeProjeto()}</span>
          <div className="sub-info">
            <span className="nota-name">{getNomeNota()}</span>
          </div>
        </div>
        {onClose && (
          <button
            className="listagem-close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* ✅ Título com data de entrega no canto direito */}
      <div className="task-title-container">
        <h2 className="task-title">{getNomeNota()}</h2>
        <div className="data-entrega-wrapper">
          <label className="data-entrega-label">Data de entrega</label>
          <input
            type="date"
            value={dataEntregaTarefa || ""}
            onChange={(e) => setDataEntregaTarefa(e.target.value)} // só atualiza UI
            onBlur={(e) => handleSalvarDataEntregaTarefa(e.target.value || null)} // salva no banco
            className="data-entrega-input"
            disabled={loading}
          />
        </div>
      </div>

      {/* Seção de Descrição */}
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

      {/* Seção de Anexos */}
      <div
        className="anexos-section"
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('drag-over');
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('drag-over');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('drag-over');
          const files = Array.from(e.dataTransfer.files || []);
          if (files.length > 0) {
            const fakeEvent = { target: { files } };
            handleAddAnexos(fakeEvent);
          }
        }}
      >
        <div className="anexos-header">
          <div className="anexos-botoes">
            <label htmlFor="fileInputAnexo" className="upload-btn checklist-btn">
              <span>Anexo</span>
            </label>
            <input
              type="file"
              id="fileInputAnexo"
              hidden
              multiple
              onChange={handleAddAnexos}
              disabled={loading}
            />

            <button
              type="button"
              className="upload-btn checklist-btn"
              onClick={() => setShowObjetivos(!showObjetivos)}
              disabled={loading}
              title="Gerenciar objetivos"
            >
              <span>{showObjetivos ? "Ocultar" : "Ver"} Objetivos</span>
            </button>
          </div>
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

        <div className="drag-hint">
          Arraste arquivos aqui para anexar
        </div>
      </div>

      {/* Seção de Objetivos */}
      {showObjetivos && (
        <div className="objetivos-section">
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progressoPercent}%` }}></div>
            <span className="progress-percent">{progressoPercent}%</span>
          </div>

          <div className="objetivos-add-form">
            <input
              type="text"
              value={novoObjetivoTexto}
              onChange={(e) => setNovoObjetivoTexto(e.target.value)}
              placeholder="Digite um novo objetivo..."
              onKeyDown={(e) => e.key === "Enter" && adicionarObjetivo()}
              disabled={loading}
            />
            <button
              type="button"
              className="objetivos-add-btn"
              onClick={adicionarObjetivo}
              disabled={!novoObjetivoTexto.trim() || loading}
            >
              Adicionar
            </button>
          </div>

          <div className="objetivos-lista">
            {objetivos.map((o, idx) => (
              <div
                key={o.id}
                className={`objetivo-item1 ${o.concluido ? 'objetivo-concluido' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={o.concluido}
                  onChange={() => toggleConclusao(o.id, o.concluido)}
                  disabled={loading}
                />
                <span>
                  <strong>{idx + 1}.</strong> {o.texto}
                </span>

                <div className="objetivo-responsaveis">
                  {o.responsaveis.map(resp => (
                    <ChipResponsavel
                      key={resp.id}
                      responsavel={resp}
                      onRemove={(r) => removerResponsavel(r.id, o.id)}
                      disabled={o.concluido}
                    />
                  ))}
                  {!o.concluido && (
                    <input
                      type="text"
                      placeholder={o.responsaveis.length === 0 ? "Nome ou @" : ""}
                      value={inputResponsavel[o.id] || ""}
                      onChange={(e) => handleResponsavelInputChange(e, o.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !inputResponsavel[o.id]?.startsWith("@")) {
                          adicionarResponsavelExterno(inputResponsavel[o.id], o.id);
                          setInputResponsavel(prev => ({ ...prev, [o.id]: "" }));
                        }
                      }}
                      disabled={loading}
                    />
                  )}
                  {sugestoesResponsavel[o.id]?.length > 0 && !o.concluido && (
                    <div className="sugestoes-list">
                      {sugestoesResponsavel[o.id].map(item => (
                        <div
                          key={item.id}
                          className="sugestao-item"
                          onClick={() => adicionarResponsavelInterno(item, o.id)}
                        >
                          @{item.nickname || item.nome}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="objetivo-acao">
                  <input
                    type="date"
                    value={o.dataEntrega || ""}
                    onChange={(e) => atualizarDataEntrega(o.id, e.target.value || null)}
                    disabled={o.concluido || loading}
                  />
                  {!o.concluido && (
                    <span
                      className="objetivo-excluir"
                      onClick={() => removerObjetivo(o.id)}
                    >
                      ×
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção de Comentários */}
      {notaAtual?.id && userId && userProfile && (
        <ComentariosSection
          notaId={notaAtual.id}
          userId={userId}
          userProfile={userProfile}
          projetoAtual={projetoAtual}
          containerId={containerId}
          supabaseClient={supabase}
        />
      )}
    </div>
  );
}