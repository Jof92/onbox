// src/components/CardsColumn.jsx
import React, { useState, useRef, useEffect } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { FaPlus, FaEllipsisV, FaEdit, FaTrash, FaTimes, FaMapPin, FaFileExport } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import NotaRapidaCard from "./NotaRapidaCard";
import CalendarioDiarioObra from "./RdoCalendario";
import NotaCalendarioCard from "./NotaCalendario";

export default function Column({
  col,
  index,
  columns,
  columnsNormais,
  columnsArquivadas,
  notasConcluidas,
  notaProgresso,
  dataConclusaoEdit,
  dataConclusaoSalva,
  dataEntregaEdit,
  dataEntregaSalva,
  showColorPicker,
  menuOpenPilha,
  menuOpenNota,
  editingColumnId,
  columnTitleDraft,
  setMenuOpenPilha,
  setMenuOpenNota,
  setActiveColumnId,
  setEditingColumnId,
  setColumnTitleDraft,
  setShowColorPicker,
  setColumns,
  toggleConclusaoNota,
  setDataConclusaoEdit,
  saveDataConclusao,
  setDataEntregaEdit,
  saveDataEntrega,
  handleOpenNota,
  handleEditNota,
  handleDeleteNota,
  onSaveResponsavelRapida,
  onSaveDataEntregaRapida,
  onRemoveResponsavelRapida,
  modoArquivadas,
  donoContainerId,
  usuarioId,
  entityType,
  entity,
  membros,
  // Props de expansão mantidos na assinatura para não quebrar o pai, mas não usados
  expandedColumns,
  setExpandedColumns,
}) {
  const colorTrackRefs = useRef({});

  const getDiaSemana = (dataString) => {
    if (!dataString) return "";
    const dias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const data = new Date(dataString + "T00:00:00");
    return dias[data.getUTCDay()];
  };

  const formatarDataLocal = (dataString) => {
    if (!dataString) return null;
    const [ano, mes, dia] = dataString.split('-');
    return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
  };

  const isRecebidos = col.title === "Recebidos";
  const isArquivo = modoArquivadas && !isRecebidos;
  const bgColor = col.cor_fundo || (isRecebidos ? "rgba(46, 125, 50, 0.08)" : "transparent");
  const isColorPickerVisible = showColorPicker[col.id];
  const isDiarioObra = col.tipo_pilha === "diario_obras";

  const handleSaveDescricaoRapida = async (notaId, descricao) => {
    const { error } = await supabase.from("notas").update({ descricao }).eq("id", notaId);
    if (error) return;
    setColumns(prev =>
      prev.map(c =>
        c.id === col.id
          ? { ...c, notas: c.notas.map(n => n.id === notaId ? { ...n, descricao } : n) }
          : c
      )
    );
  };

  const updatePilhaCor = async (pilhaId, cor) => {
    const { error } = await supabase.from("pilhas").update({ cor_fundo: cor }).eq("id", pilhaId);
    if (!error) {
      setColumns(prev => prev.map(c => c.id === pilhaId ? { ...c, cor_fundo: cor } : c));
    }
  };

  const handleResetCor = (pilhaId) => {
    updatePilhaCor(pilhaId, null);
    setShowColorPicker(prev => ({ ...prev, [pilhaId]: false }));
  };

  const toggleColorPicker = (pilhaId, show) => {
    setShowColorPicker(prev => ({ ...prev, [pilhaId]: show }));
  };

  const saveColumnTitle = async (id) => {
    if (!columnTitleDraft.trim()) return setEditingColumnId(null);
    const { error } = await supabase.from("pilhas").update({ title: columnTitleDraft }).eq("id", id);
    if (!error) {
      setColumns(prev => prev.map(c => c.id === id ? { ...c, title: columnTitleDraft } : c));
    }
    setEditingColumnId(null);
  };

  const handleDeletePilha = async (pilhaId) => {
    const pilha = columns.find(c => c.id === pilhaId);
    if (!pilha || pilha.notas.length > 0) {
      alert("Apenas pilhas vazias podem ser excluídas.");
      return;
    }
    if (!window.confirm(`Excluir a pilha "${pilha.title}"?`)) return;
    const { error } = await supabase.from("pilhas").delete().eq("id", pilhaId);
    if (!error) {
      setColumns(prev => prev.filter(c => c.id !== pilhaId));
      setMenuOpenPilha(null);
    }
  };

  const handleArquivarNota = async (nota, pilhaAtualId) => {
    const estaEmArquivo = col.arquivada;
    const pilhasAlvo = columns.filter(c => c.arquivada !== estaEmArquivo);

    if (pilhasAlvo.length === 0) {
      alert(estaEmArquivo
        ? "Sem pilhas normais disponíveis para restaurar."
        : "Sem pilhas disponíveis em arquivo.");
      return;
    }

    const pilhaAlvoId = pilhasAlvo[0].id;

    try {
      const updates = {
        pilha_id: pilhaAlvoId,
        ordem: 0
      };

      if (!estaEmArquivo) {
        updates.pilha_original_id = pilhaAtualId;
      }

      const { error } = await supabase.from("notas").update(updates).eq("id", nota.id);
      if (error) throw error;

      setColumns(prev =>
        prev.map(c => {
          if (c.id === pilhaAtualId) {
            return { ...c, notas: c.notas.filter(n => n.id !== nota.id) };
          }
          if (c.id === pilhaAlvoId) {
            return { ...c, notas: [{ ...nota, ...updates }, ...c.notas] };
          }
          return c;
        })
      );
    } catch (err) {
      console.error("Erro ao mover nota:", err);
      alert("Erro ao mover a nota. Tente novamente.");
    }
  };

  useEffect(() => {
    if (!showColorPicker[col.id]) return;
    const track = colorTrackRefs.current[col.id];
    if (!track) return;
    const handleClick = (e) => {
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const pct = Math.max(0, Math.min(1, x / width));
      const hue = Math.round(pct * 360);
      const cor = `hsl(${hue}, 40%, 94%)`;
      updatePilhaCor(col.id, cor);
    };
    track.addEventListener("click", handleClick);
    return () => track.removeEventListener("click", handleClick);
  }, [showColorPicker, col.id]);

  useEffect(() => {
    if (!isDiarioObra) return;

    const handleNovaNotaRDO = (event) => {
      const { nota, pilhaId: eventPilhaId } = event.detail;
      if (eventPilhaId === col.id) {
        console.log("⚡ Nova nota RDO detectada, atualizando lista imediatamente");
        setColumns(prev =>
          prev.map(c =>
            c.id === col.id 
              ? { ...c, notas: [nota, ...c.notas] } 
              : c
          )
        );
      }
    };

    const handleRdoAtualizado = (event) => {
      const { notaId, data: updatedData } = event.detail;
      console.log("⚡ RDO atualizado, sincronizando lista");
      setColumns(prev =>
        prev.map(c =>
          c.id === col.id
            ? {
                ...c,
                notas: c.notas.map(n =>
                  n.id === notaId ? { ...n, ...updatedData } : n
                )
              }
            : c
        )
      );
    };

    window.addEventListener('novaNotaRDO', handleNovaNotaRDO);
    window.addEventListener('rdoAtualizado', handleRdoAtualizado);

    const subscription = supabase
      .channel(`rdo-${col.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notas',
          filter: `pilha_id=eq.${col.id}`
        },
        async (payload) => {
          if (payload.new?.tipo === "Diário de Obra" || payload.old?.tipo === "Diário de Obra") {
            console.log("📡 Sincronização Supabase - mudança detectada");
            const { data: notasRaw } = await supabase
              .from("notas")
              .select("*")
              .eq("pilha_id", col.id)
              .eq("tipo", "Diário de Obra")
              .order("data_entrega", { ascending: false });

            if (notasRaw) {
              setColumns(prev =>
                prev.map(c =>
                  c.id === col.id ? { ...c, notas: notasRaw } : c
                )
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('novaNotaRDO', handleNovaNotaRDO);
      window.removeEventListener('rdoAtualizado', handleRdoAtualizado);
      supabase.removeChannel(subscription);
    };
  }, [col.id, isDiarioObra, setColumns]);

  const openNotaById = async (notaId) => {
    console.log("🔍 Tentando abrir nota ID:", notaId);
    
    const allColumns = [...columnsNormais, ...columnsArquivadas];
    for (const c of allColumns) {
      const nota = c.notas.find(n => n.id === notaId);
      if (nota) {
        console.log("✅ Nota encontrada nas colunas:", nota);
        handleOpenNota(nota);
        return;
      }
    }

    console.log("⚠️ Nota não encontrada nas colunas, buscando no banco...");
    const { data: nota, error } = await supabase
      .from("notas")
      .select("*")
      .eq("id", notaId)
      .single();

    if (error) {
      console.error("❌ Erro ao buscar nota:", error);
      alert("Não foi possível abrir a nota.");
      return;
    }

    if (nota) {
      console.log("✅ Nota encontrada no banco:", nota);
      handleOpenNota(nota);
    } else {
      console.error("❌ Nota não existe");
      alert("Nota não encontrada.");
    }
  };

  return (
    <Draggable
      key={col.id}
      draggableId={col.id}
      index={index}
      type="COLUMN"
      isDragDisabled={isRecebidos}
    >
      {(colProvided, colSnapshot) => (
        <div
          ref={colProvided.innerRef}
          {...colProvided.draggableProps}
          style={{
            ...colProvided.draggableProps.style,
            opacity: colSnapshot.isDragging ? 0.85 : 1,
          }}
        >
          {!isRecebidos && (
            <div
              {...colProvided.dragHandleProps}
              style={{
                cursor: "grab",
                textAlign: "center",
                fontSize: "0.85em",
                color: "#666",
                userSelect: "none",
              }}
            >
              <FaMapPin />
            </div>
          )}

          {isColorPickerVisible && !isRecebidos && (
            <div className="color-picker-toolbar">
              <button
                className="reset-color-dot"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetCor(col.id);
                }}
                title="Cor original"
              />
              <div
                ref={(el) => (colorTrackRefs.current[col.id] = el)}
                className="color-track"
              />
              <button
                className="close-color-picker"
                onClick={() => toggleColorPicker(col.id, false)}
                title="Fechar"
              >
                <FaTimes size={12} />
              </button>
            </div>
          )}

          {/* NOVO LAYOUT DO COLUMN HEADER - APENAS VISUAL */}
          <div className={`column-header ${isArquivo ? 'arquivo-header' : ''}`}>
            {/* Título da Pilha */}
            {editingColumnId === col.id && !isRecebidos ? (
              <input
                type="text"
                value={columnTitleDraft}
                autoFocus
                onChange={(e) => setColumnTitleDraft(e.target.value)}
                onBlur={() => saveColumnTitle(col.id)}
                onKeyDown={(e) => e.key === "Enter" && saveColumnTitle(col.id)}
                className="column-title-input"
              />
            ) : (
              <h3
                className="column-title"
                style={{ cursor: isRecebidos ? "default" : "pointer" }}
                onDoubleClick={() => {
                  if (!isRecebidos) {
                    setEditingColumnId(col.id);
                    setColumnTitleDraft(col.title);
                  }
                }}
              >
                {modoArquivadas && !isRecebidos ? "Pilha de Arquivos" : col.title}
              </h3>
            )}

            {/* Barra de Ações - apenas para pilhas não-Recebidos */}
            {!isRecebidos && (
              <div className="column-actions-bar">
                {/* Botão Adicionar Nota */}
                {!isDiarioObra && (
                  <button 
                    className="column-action-btn"
                    title="Adicionar nota"
                    onClick={() => setActiveColumnId(col.id)}
                  >
                    <span className="material-symbols-outlined">add_chart</span>
                  </button>
                )}

                {/* Botão Mudar Cor */}
                <button 
                  className="column-action-btn"
                  title="Mudar cor"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleColorPicker(col.id, true);
                  }}
                >
                  <span className="material-symbols-outlined">palette</span>
                </button>

                {/* Botão Expandir/Recolher - APENAS VISUAL, SEM FUNCIONALIDADE */}
                <button 
                  className="column-action-btn"
                  title="Expandir/Recolher pilha (em breve)"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log("Funcionalidade de expansão ainda não implementada");
                  }}
                >
                  <span className="material-symbols-outlined">expand_content</span>
                </button>

                {/* Botão Excluir Pilha */}
                <button 
                  className={`column-action-btn ${col.notas.length > 0 ? 'disabled' : ''}`}
                  title={col.notas.length > 0 ? "Pilha não vazia" : "Excluir pilha"}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (col.notas.length === 0) {
                      await handleDeletePilha(col.id);
                    }
                  }}
                  disabled={col.notas.length > 0}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Conteúdo da Coluna - SEM ALTERAÇÕES NO COMPORTAMENTO */}
          {isDiarioObra ? (
            <div
              className="cards-list diario-obras-list"
              style={{
                backgroundColor: bgColor,
                border: isRecebidos ? "1px solid rgba(46, 125, 50, 0.2)" : "1px solid rgba(0, 0, 0, 0.08)",
                borderRadius: "8px",
                padding: "8px",
                position: "relative",
                minWidth: "280px",
                maxWidth: "280px",
                marginRight: "16px",
              }}
            >
              <CalendarioDiarioObra
                pilhaId={col.id}
                usuarioId={usuarioId}
                onSelectNota={openNotaById}
              />

              <Droppable droppableId={col.id} type="CARD" isDropDisabled={true}>
                {(innerProvided) => (
                  <div
                    ref={innerProvided.innerRef}
                    {...innerProvided.droppableProps}
                    style={{
                      marginTop: "16px",
                      minHeight: "40px",
                    }}
                  >
                    {col.notas
                      .filter(nota => nota.tipo === "Diário de Obra")
                      .sort((a, b) => new Date(b.data_entrega) - new Date(a.data_entrega))
                      .slice(0, 5)
                      .map((nota, idx) => (
                        <Draggable
                          key={String(nota.id)}
                          draggableId={String(nota.id)}
                          index={idx}
                          type="CARD"
                          isDragDisabled={true}
                        >
                          {(prov, snapshot) => (
                            <div
                              className={`card-item tipo-rdo ${snapshot.isDragging ? "dragging" : ""}`}
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              onClick={() => handleOpenNota(nota)}
                              style={{
                                ...prov.draggableProps.style,
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              <strong>{nota.nome}</strong>
                              {nota.data_entrega && (
                                <span style={{ color: "#666", fontSize: "0.85em" }}>
                                  {getDiaSemana(nota.data_entrega)}
                                </span>
                              )}
                              <span style={{ color: "#666", fontSize: "0.85em", fontWeight: "normal" }}>
                                Diário de Obra
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {innerProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ) : (
            <Droppable droppableId={col.id} type="CARD">
              {(innerProvided) => (
                <div
                  className={`cards-list ${isArquivo ? 'arquivo-cards-list' : ''}`}
                  ref={innerProvided.innerRef}
                  {...innerProvided.droppableProps}
                  style={{
                    backgroundColor: bgColor,
                    border: isRecebidos ? "1px solid rgba(46, 125, 50, 0.2)" : "1px solid rgba(0, 0, 0, 0.08)"
                  }}
                >
                  {col.notas.map((nota, idx) => {
                    // ✅ CALENDÁRIO - ARRASTÁVEL
                    if (nota.tipo === "Calendário") {
                      return (
                        <Draggable key={String(nota.id)} draggableId={String(nota.id)} index={idx} type="CARD">
                          {(prov, snapshot) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              style={{
                                ...prov.draggableProps.style,
                                marginBottom: "8px",
                                opacity: snapshot.isDragging ? 0.85 : 1,
                              }}
                            >
                              <NotaCalendarioCard
                                nota={nota}
                                pilhaId={col.id}
                                usuarioId={usuarioId}
                                membros={membros || []}
                                onDelete={() => handleDeleteNota(nota.id, col.id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    }

                    // ✅ NOTA RÁPIDA
                    if (nota.tipo === "Nota Rápida") {
                      const isConcluida = notasConcluidas.has(String(nota.id));
                      const isEditingDate = dataConclusaoEdit.hasOwnProperty(String(nota.id));
                      return (
                        <Draggable key={String(nota.id)} draggableId={String(nota.id)} index={idx} type="CARD">
                          {(prov, snapshot) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              style={{ ...prov.draggableProps.style, userSelect: "text" }}
                            >
                              <NotaRapidaCard
                                nota={nota}
                                onSaveResponsavel={onSaveResponsavelRapida}
                                onSaveDataEntrega={onSaveDataEntregaRapida}
                                onSaveDescricao={handleSaveDescricaoRapida}
                                onRemoveResponsavel={onRemoveResponsavelRapida}
                                isConcluida={isConcluida}
                                isEditingDate={isEditingDate}
                                dataConclusaoEdit={dataConclusaoEdit}
                                dataConclusaoSalva={dataConclusaoSalva}
                                setDataConclusaoEdit={setDataConclusaoEdit}
                                saveDataConclusao={saveDataConclusao}
                                menuOpenNota={menuOpenNota}
                                setMenuOpenNota={setMenuOpenNota}
                                handleEditNota={handleEditNota}
                                handleDeleteNota={handleDeleteNota}
                                toggleConclusaoNota={toggleConclusaoNota}
                                pilhaId={col.id}
                                dragHandleProps={prov.dragHandleProps}
                                containerId={donoContainerId}
                                usuarioId={usuarioId}
                                entityType={entityType}
                                entityId={entity?.id}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    }

                    // ✅ DEMAIS CARDS
                    const isConcluida = notasConcluidas.has(String(nota.id));

                    let cardBackgroundColor = "#ffffff";
                    let cardBorderLeft = "none";
                    if (nota.respondida) {
                      cardBackgroundColor = "#e6f4ea";
                      cardBorderLeft = "4px solid #34a853";
                    } else if (nota.enviada) {
                      cardBackgroundColor = "#fce8e6";
                      cardBorderLeft = "4px solid #ea4335";
                    }

                    const usarDataEntrega = nota.tipo === "Tarefas";
                    const isEditingDate = usarDataEntrega 
                      ? dataEntregaEdit?.hasOwnProperty(String(nota.id))
                      : dataConclusaoEdit?.hasOwnProperty(String(nota.id));
                    const dataAtual = usarDataEntrega ? dataEntregaSalva : dataConclusaoSalva;
                    const dataEdit = usarDataEntrega ? dataEntregaEdit : dataConclusaoEdit;
                    const setDataEdit = usarDataEntrega ? setDataEntregaEdit : setDataConclusaoEdit;
                    const saveData = usarDataEntrega ? saveDataEntrega : saveDataConclusao;

                    return (
                      <Draggable key={String(nota.id)} draggableId={String(nota.id)} index={idx} type="CARD">
                        {(prov, snapshot) => (
                          <div
                            className={`card-item tipo-${(nota.tipo || "lista").toLowerCase()} ${snapshot.isDragging ? "dragging" : ""} ${isConcluida ? "concluida" : ""}`}
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            style={{
                              ...prov.draggableProps.style,
                              userSelect: "none",
                              backgroundColor: cardBackgroundColor,
                              borderLeft: cardBorderLeft,
                            }}
                            onClick={() => handleOpenNota(nota)}
                          >
                            <div className="concluir-checkbox-wrapper">
                              <input
                                type="checkbox"
                                checked={isConcluida}
                                readOnly
                                className="concluir-checkbox"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleConclusaoNota(nota.id, isConcluida);
                                }}
                              />
                              {isConcluida && (
                                <button
                                  className="arquivar-btn"
                                  title={col.arquivada ? "Restaurar nota" : "Arquivar nota"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArquivarNota(nota, col.id);
                                  }}
                                >
                                  <FaFileExport size={14} />
                                </button>
                              )}
                            </div>

                            <div className="card-info">
                              <div className="card-title-wrapper">
                                <strong>{nota.nome}</strong>
                              </div>
                              <p>
                                {nota.tipo}
                                {nota.tipo === "Atas" && notaProgresso[nota.id] !== undefined && <> - {notaProgresso[nota.id]}%</>}
                              </p>

                              <div
                                className="data-conclusao-container"
                                data-nota-id={nota.id}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isEditingDate ? (
                                  <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                                    <input
                                      type="date"
                                      value={dataEdit?.[nota.id] || ""}
                                      onChange={(e) => setDataEdit(prev => ({ ...prev, [nota.id]: e.target.value }))}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ fontSize: "0.85em", padding: "2px 4px" }}
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveData(nota.id, dataEdit[nota.id]);
                                      }}
                                      style={{ fontSize: "0.8em" }}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDataEdit(prev => {
                                          const cp = { ...prev };
                                          delete cp[nota.id];
                                          return cp;
                                        });
                                      }}
                                      style={{ fontSize: "0.8em", color: "#e53e3e" }}
                                    >
                                      ✖
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDataEdit(prev => ({ ...prev, [nota.id]: dataAtual?.[nota.id] || "" }));
                                    }}
                                    style={{
                                      marginTop: "4px",
                                      fontSize: "0.85em",
                                      color: dataAtual?.[nota.id] ? "#444" : "#999",
                                      fontStyle: dataAtual?.[nota.id] ? "normal" : "italic",
                                    }}
                                  >
                                    {dataAtual?.[nota.id]
                                      ? formatarDataLocal(dataAtual[nota.id])
                                      : usarDataEntrega ? "Data para entrega" : "Data da entrega"}
                                  </div>
                                )}
                              </div>
                            </div>

                            {!isConcluida && (
                              <div className="card-menu-wrapper" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="card-menu-btn"
                                  onClick={() => setMenuOpenNota(menuOpenNota === nota.id ? null : nota.id)}
                                >
                                  <FaEllipsisV />
                                </button>
                                {menuOpenNota === nota.id && (
                                  <div className="card-menu-dropdown">
                                    <button onClick={() => handleEditNota(nota, col.id)}>
                                      <FaEdit /> Editar
                                    </button>
                                    <button onClick={() => handleDeleteNota(nota.id, col.id)}>
                                      <FaTrash /> Excluir
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  
                  {innerProvided.placeholder}
                </div>
              )}
            </Droppable>
          )}
        </div>
      )}
    </Draggable>
  );
}