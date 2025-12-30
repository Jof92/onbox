// src/components/CardsColumn.jsx
import React, { useState, useRef, useEffect } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { FaPlus, FaEllipsisV, FaEdit, FaTrash, FaTimes, FaMapPin, FaFileExport } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import NotaRapidaCard from "./NotaRapidaCard";

export default function Column({
  col,
  index,
  columns,
  notasConcluidas,
  notaProgresso,
  dataConclusaoEdit,
  dataConclusaoSalva,
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
  handleOpenNota,
  handleEditNota,
  handleDeleteNota,
  onSaveResponsavelRapida,
  onSaveDataEntregaRapida,
  onRemoveResponsavelRapida,
  modoArquivadas,
  donoContainerId,
  usuarioId,
  entityType, // ← ADICIONADO
  entity,     // ← ADICIONADO
}) {
  const colorTrackRefs = useRef({});
  const isRecebidos = col.title === "Recebidos";
  const isArquivo = modoArquivadas && !isRecebidos;
  const bgColor = col.cor_fundo || (isRecebidos ? "rgba(46, 125, 50, 0.08)" : "transparent");
  const isColorPickerVisible = showColorPicker[col.id];

  const handleSaveDescricaoRapida = async (notaId, descricao) => {
    const { error } = await supabase
      .from("notas")
      .update({ descricao })
      .eq("id", notaId);
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
    const { error } = await supabase
      .from("pilhas")
      .update({ cor_fundo: cor })
      .eq("id", pilhaId);
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
    if (show) setMenuOpenPilha(null);
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

      const { error } = await supabase
        .from("notas")
        .update(updates)
        .eq("id", nota.id);

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
                padding: "6px 0",
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

          <div className={`column-header ${isArquivo ? 'arquivo-header' : ''}`}>
            {editingColumnId === col.id && !isRecebidos ? (
              <input
                type="text"
                value={columnTitleDraft}
                autoFocus
                onChange={(e) => setColumnTitleDraft(e.target.value)}
                onBlur={() => saveColumnTitle(col.id)}
                onKeyDown={(e) => e.key === "Enter" && saveColumnTitle(col.id)}
              />
            ) : (
              <h3
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

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {!isRecebidos && (
                <button className="btn-add" onClick={() => setActiveColumnId(col.id)}>
                  <FaPlus />
                </button>
              )}

              {!isRecebidos && (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <button
                    className="column-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenPilha(menuOpenPilha === col.id ? null : col.id);
                    }}
                  >
                    <FaEllipsisV />
                  </button>
                  {menuOpenPilha === col.id && (
                    <div className="card-menu-dropdown" style={{ top: "100%", right: 0 }}>
                      <button
                        onClick={() => {
                          setMenuOpenPilha(null);
                          toggleColorPicker(col.id, true);
                        }}
                      >
                        🎨 Estilo
                      </button>
                      {col.notas.length === 0 ? (
                        <button
                          onClick={async () => {
                            setMenuOpenPilha(null);
                            await handleDeletePilha(col.id);
                          }}
                          style={{ color: "#e53e3e" }}
                        >
                          <FaTrash /> Excluir pilha
                        </button>
                      ) : (
                        <button disabled style={{ color: "#aaa" }}>
                          <FaTrash /> Pilha não vazia
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <Droppable droppableId={col.id} type="CARD">
            {(innerProvided) => (
              <div
                className={`cards-list ${isArquivo ? 'arquivo-cards-list' : ''}`}
                ref={innerProvided.innerRef}
                {...innerProvided.droppableProps}
                style={{
                  backgroundColor: bgColor,
                  border: isRecebidos ? "1px solid rgba(46, 125, 50, 0.2)" : "1px solid rgba(0, 0, 0, 0.08)",
                  borderRadius: "8px",
                  padding: "8px",
                  position: "relative",
                  minWidth: "280px",
                  maxWidth: "320px",
                  marginRight: "16px",
                }}
              >
                {col.notas.map((nota, idx) => {
                  if (nota.tipo === "Nota Rápida") {
                    const isConcluida = notasConcluidas.has(String(nota.id));
                    const isEditingDate = dataConclusaoEdit.hasOwnProperty(String(nota.id));
                    return (
                      <Draggable key={String(nota.id)} draggableId={String(nota.id)} index={idx} type="CARD">
                        {(prov, snapshot) => (
                          <div ref={prov.innerRef} {...prov.draggableProps} style={{ ...prov.draggableProps.style, userSelect: "text" }}>
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
                              entityType={entityType} // ← REPASSADO
                              entityId={entity?.id}   // ← REPASSADO
                            />
                          </div>
                        )}
                      </Draggable>
                    );
                  }

                  const isConcluida = notasConcluidas.has(String(nota.id));
                  const isEditingDate = dataConclusaoEdit.hasOwnProperty(String(nota.id));

                  let cardBackgroundColor = "#ffffff";
                  let cardBorderLeft = "none";
                  if (nota.respondida) {
                    cardBackgroundColor = "#e6f4ea";
                    cardBorderLeft = "4px solid #34a853";
                  } else if (nota.enviada) {
                    cardBackgroundColor = "#fce8e6";
                    cardBorderLeft = "4px solid #ea4335";
                  }

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
                                    value={dataConclusaoEdit[nota.id] || ""}
                                    onChange={(e) => setDataConclusaoEdit(prev => ({ ...prev, [nota.id]: e.target.value }))}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: "0.85em", padding: "2px 4px" }}
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveDataConclusao(nota.id, dataConclusaoEdit[nota.id]);
                                    }}
                                    style={{ fontSize: "0.8em" }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDataConclusaoEdit(prev => {
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
                                    setDataConclusaoEdit(prev => ({ ...prev, [nota.id]: dataConclusaoSalva[nota.id] || "" }));
                                  }}
                                  style={{
                                    marginTop: "4px",
                                    fontSize: "0.85em",
                                    color: dataConclusaoSalva[nota.id] ? "#444" : "#999",
                                    fontStyle: dataConclusaoSalva[nota.id] ? "normal" : "italic",
                                  }}
                                >
                                  {dataConclusaoSalva[nota.id]
                                    ? new Date(dataConclusaoSalva[nota.id]).toLocaleDateString("pt-BR")
                                    : "Data da entrega"}
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
        </div>
      )}
    </Draggable>
  );
}