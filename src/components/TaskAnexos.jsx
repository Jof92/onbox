// src/components/TaskAnexos.jsx
import React from "react";
import "./Task.css";
import { supabase } from "../supabaseClient";
import { FaTrashAlt } from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faUserPlus, faCalendar } from "@fortawesome/free-solid-svg-icons";

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

const TaskAnexos = ({
  notaAtual,
  userId,
  loading,
  anexosSalvos,
  setAnexosSalvos,
  objetivos,
  setObjetivos,
  showObjetivos,
  setShowObjetivos,
  novoObjetivoTexto,
  setNovoObjetivoTexto,
  inputResponsavel,
  setInputResponsavel,
  sugestoesResponsavel,
  setSugestoesResponsavel,
  containerId,
  setImagemAmpliada
}) => {
  const [editingResponsavelId, setEditingResponsavelId] = React.useState(null);
  const dateInputRefs = React.useRef({});

  const handleAddImagens = async (e) => {
    const files = Array.from(e.target.files || []).filter(file => file.type.startsWith('image/'));
    if (!notaAtual?.id || !userId || files.length === 0) return;

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
            mime_type: file.type || 'image/unknown',
          })
          .select()
          .single();

        setAnexosSalvos((prev) => [...prev, insertedAnexo]);
      }
    } catch (err) {
      console.error("Erro ao enviar imagem:", err);
      alert("Erro ao enviar uma ou mais imagens.");
    }
  };

  const handleAddAnexos = async (e) => {
    const files = Array.from(e.target.files || []).filter(file => !file.type.startsWith('image/'));
    if (!notaAtual?.id || !userId || files.length === 0) return;

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
            mime_type: file.type || null,
          })
          .select()
          .single();

        setAnexosSalvos((prev) => [...prev, insertedAnexo]);
      }
    } catch (err) {
      console.error("Erro ao enviar anexo:", err);
      alert("Erro ao enviar um ou mais anexos.");
    }
  };

  const handleRemoverAnexo = async (anexoId, fileUrl) => {
    if (!window.confirm("Deseja realmente excluir este anexo?")) return;
    try {
      const url = new URL(fileUrl);
      const fileName = url.pathname.split("/").pop();
      await supabase.storage.from("anexos").remove([fileName]);
      await supabase.from("anexos").delete().eq("id", anexoId).eq("user_id", userId);
      setAnexosSalvos((prev) => prev.filter((a) => a.id !== anexoId));
    } catch (err) {
      console.error("Erro ao excluir anexo:", err);
      alert("Erro ao excluir anexo.");
    }
  };

  const criarChecklistSeNecessario = async () => {
    if (!notaAtual?.id || !containerId) {
      console.warn("Tentativa de criar checklist sem notaId ou containerId");
      return null;
    }

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
      .insert({ 
        nota_id: notaAtual.id,
        container_id: containerId
      })
      .select("id")
      .single();

    if (insertError || !novo) {
      console.error("Erro ao criar checklist:", insertError);
      alert("Você não tem permissão para criar checklist neste container.");
      return null;
    }

    return novo.id;
  };

  const adicionarObjetivo = async () => {
    if (!novoObjetivoTexto.trim()) return;
    try {
      const checklistId = await criarChecklistSeNecessario();
      if (!checklistId) {
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
    } catch (err) {
      console.error("Erro inesperado na função adicionarObjetivo:", err);
      alert("Erro inesperado ao adicionar objetivo.");
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

  const progressoPercent = objetivos.length
    ? Math.round((objetivos.filter(o => o.concluido).length / objetivos.length) * 100)
    : 0;

  const imagens = anexosSalvos.filter(anexo => anexo.mime_type?.startsWith('image/'));

  return (
    <>
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
            const images = files.filter(file => file.type.startsWith('image/'));
            const others = files.filter(file => !file.type.startsWith('image/'));
            if (images.length > 0) {
              const fakeEvent = { target: { files: images } };
              handleAddImagens(fakeEvent);
            }
            if (others.length > 0) {
              const fakeEvent = { target: { files: others } };
              handleAddAnexos(fakeEvent);
            }
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

            <label htmlFor="fileInputImagem" className="upload-btn checklist-btn">
              <span>Imagens</span>
            </label>
            <input
              type="file"
              id="fileInputImagem"
              hidden
              multiple
              accept="image/*"
              onChange={handleAddImagens}
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

        <div className="imagens-miniaturas">
          {imagens.map((anexo) => (
            <div key={`img-${anexo.id}`} className="miniatura-item">
              <img
                src={anexo.file_url}
                alt={anexo.file_name}
                onClick={() => {
                  const index = imagens.findIndex(img => img.id === anexo.id);
                  setImagemAmpliada({ index, imagens });
                }}
                loading="lazy"
              />
              <button
                className="botao-lixeira-miniatura"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoverAnexo(anexo.id, anexo.file_url);
                }}
                aria-label="Excluir imagem"
                title="Excluir imagem"
              >
                <FaTrashAlt size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="anexos-lista">
          {anexosSalvos
            .filter(anexo => !anexo.mime_type?.startsWith('image/'))
            .map((anexo) => (
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
          Arraste arquivos aqui para anexar (imagens ou documentos)
        </div>
      </div>

      {showObjetivos && (
        <div className="objetivos-section">
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progressoPercent}%` }}></div>
            <span className="progress-percent">{progressoPercent}%</span>
          </div>

          {notaAtual?.id && containerId ? (
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
          ) : (
            <div className="objetivos-add-form">
              <input
                type="text"
                placeholder="Carregando..."
                disabled={true}
              />
              <button
                type="button"
                className="objetivos-add-btn"
                disabled={true}
              >
                Adicionar
              </button>
            </div>
          )}

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

                <div className="objetivo-responsaveis-chips">
                  {o.responsaveis.map(resp => (
                    <ChipResponsavel
                      key={resp.id}
                      responsavel={resp}
                      onRemove={(r) => removerResponsavel(r.id, o.id)}
                      disabled={o.concluido}
                    />
                  ))}
                </div>

                <div className="objetivo-acao-direita">
                  {!o.concluido && (
                    <span
                      className="icone-editar"
                      title="Editar objetivo"
                      onClick={() => {
                        const novoTexto = prompt("Editar objetivo:", o.texto);
                        if (novoTexto !== null && novoTexto.trim() !== "" && novoTexto.trim() !== o.texto) {
                          setObjetivos(prev =>
                            prev.map(item =>
                              item.id === o.id ? { ...item, texto: novoTexto.trim() } : item
                            )
                          );
                          supabase
                            .from("checklist_items")
                            .update({ description: novoTexto.trim() })
                            .eq("id", o.id)
                            .then(({ error }) => {
                              if (error) {
                                console.error("Erro ao salvar edição:", error);
                                alert("Erro ao salvar alteração.");
                                setObjetivos(prev =>
                                  prev.map(item =>
                                    item.id === o.id ? { ...item, texto: o.texto } : item
                                  )
                                );
                              }
                            });
                        }
                      }}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} />
                    </span>
                  )}

                  {!o.concluido && (
                    <span
                      className="icone-add-resp"
                      title="Adicionar responsável"
                      onClick={() => {
                        setEditingResponsavelId(o.id);
                      }}
                    >
                      <FontAwesomeIcon icon={faUserPlus} />
                    </span>
                  )}

                  {editingResponsavelId === o.id && !o.concluido && (
                    <div className="input-responsavel-flutuante">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Nome ou @menção"
                        value={inputResponsavel[o.id] || ""}
                        onChange={(e) => handleResponsavelInputChange(e, o.id)}
                        onBlur={() => {
                          setTimeout(() => setEditingResponsavelId(null), 200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const valor = inputResponsavel[o.id] || "";
                            if (!valor.startsWith("@")) {
                              adicionarResponsavelExterno(valor, o.id);
                              setEditingResponsavelId(null);
                            }
                          } else if (e.key === "Escape") {
                            setEditingResponsavelId(null);
                          }
                        }}
                        disabled={loading}
                      />
                      {sugestoesResponsavel[o.id]?.length > 0 && (
                        <div className="sugestoes-list-flutuante">
                          {sugestoesResponsavel[o.id].map(item => (
                            <div
                              key={item.id}
                              className="sugestao-item"
                              onClick={() => {
                                adicionarResponsavelInterno(item, o.id);
                                setEditingResponsavelId(null);
                              }}
                            >
                              @{item.nickname || item.nome}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="objetivo-acao">
                  {!o.concluido && (
                    <label
                      className="objetivo-data-entrega"
                      style={{ 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        position: 'relative'
                      }}
                    >
                      {o.dataEntrega ? (
                        <>
                          {new Date(o.dataEntrega).toLocaleDateString('pt-BR')}
                          <FontAwesomeIcon icon={faCalendar} style={{ fontSize: '12px', color: '#555' }} />
                        </>
                      ) : (
                        <FontAwesomeIcon icon={faCalendar} style={{ fontSize: '14px', color: '#555' }} />
                      )}
                      <input
                        type="date"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer'
                        }}
                        value={o.dataEntrega || ''}
                        onChange={(e) => atualizarDataEntrega(o.id, e.target.value || null)}
                        disabled={loading}
                      />
                    </label>
                  )}

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
    </>
  );
};

export default TaskAnexos;