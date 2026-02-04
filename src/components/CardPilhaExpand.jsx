// src/components/CardPilhaExpand.jsx
import React from "react";
import { FaTimes, FaEllipsisV, FaEdit, FaTrash, FaFileExport } from "react-icons/fa";
import NotaRapidaCard from "./NotaRapidaCard";
import NotaCalendarioCard from "./NotaCalendario";
import "./CardPilhaExpand.css";

export default function CardPilhaExpand({
  col,
  isArquivo,
  notasConcluidas,
  notaProgresso,
  dataConclusaoEdit,
  dataConclusaoSalva,
  dataEntregaEdit,
  dataEntregaSalva,
  menuOpenNota,
  setMenuOpenNota,
  handleOpenNota,
  handleEditNota,
  handleDeleteNota,
  toggleConclusaoNota,
  onSaveResponsavelRapida,
  onSaveDataEntregaRapida,
  onRemoveResponsavelRapida,
  handleSaveDescricaoRapida,
  setDataConclusaoEdit,
  saveDataConclusao,
  setDataEntregaEdit,
  saveDataEntrega,
  donoContainerId,
  usuarioId,
  entityType,
  entity,
  membros,
  expandedNotaView,
  setExpandedNotaView,
  setExpandedColumnId,
  handleArquivarNota,
  renderNotaContent,
}) {
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

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    setExpandedColumnId(null);
    setExpandedNotaView(null);
  };

  const handleNotaClickExpanded = (nota) => {
    if (nota.tipo === "Nota Rápida") return;
    setExpandedNotaView(nota);
  };

  return (
    <div className="column-expanded-wrapper">
      <div className="expanded-left-panel">
        <div className={`column-header ${isArquivo ? 'arquivo-header' : ''} column-header-expanded`}>
          <h3 className="column-title">{col.title}</h3>
          <div className="column-actions-bar">
            <button
              className="column-action-btn"
              title="Condensar pilha"
              onClick={handleToggleExpand}
            >
              <span className="material-symbols-outlined">collapse_content</span>
            </button>
          </div>
        </div>

        <div className="expanded-notes-grid">
          {col.notas.map((nota) => {
            const isConcluida = notasConcluidas.has(String(nota.id));

            if (nota.tipo === "Nota Rápida") {
              return (
                <div key={String(nota.id)} className="expanded-note-slot">
                  <NotaRapidaCard
                    nota={nota}
                    onSaveResponsavel={onSaveResponsavelRapida}
                    onSaveDataEntrega={onSaveDataEntregaRapida}
                    onSaveDescricao={handleSaveDescricaoRapida}
                    onRemoveResponsavel={onRemoveResponsavelRapida}
                    isConcluida={isConcluida}
                    isEditingDate={false}
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
                    dragHandleProps={null}
                    containerId={donoContainerId}
                    usuarioId={usuarioId}
                    entityType={entityType}
                    entityId={entity?.id}
                  />
                </div>
              );
            }

            if (nota.tipo === "Calendário") {
              return (
                <div key={String(nota.id)} className="expanded-note-slot">
                  <NotaCalendarioCard
                    nota={nota}
                    pilhaId={col.id}
                    usuarioId={usuarioId}
                    membros={membros || []}
                    onDelete={() => handleDeleteNota(nota.id, col.id)}
                  />
                </div>
              );
            }

            if (nota.tipo === "Diário de Obra") {
              return (
                <div
                  key={String(nota.id)}
                  className="expanded-note-slot"
                >
                  <div
                    className="card-item tipo-rdo"
                    onClick={() => handleNotaClickExpanded(nota)}
                    style={{ cursor: "pointer" }}
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
                </div>
              );
            }

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
            const dataAtual = usarDataEntrega ? dataEntregaSalva : dataConclusaoSalva;

            return (
              <div
                key={String(nota.id)}
                className="expanded-note-slot"
                onClick={() => handleNotaClickExpanded(nota)}
              >
                <div
                  className={`card-item tipo-${(nota.tipo || "lista").toLowerCase()} ${isConcluida ? "concluida" : ""} expanded-card-clickable`}
                  style={{
                    backgroundColor: cardBackgroundColor,
                    borderLeft: cardBorderLeft,
                    cursor: "pointer",
                  }}
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

                    <div className="data-conclusao-container" data-nota-id={nota.id} onClick={(e) => e.stopPropagation()}>
                      <div
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
              </div>
            );
          })}
        </div>
      </div>

      <div className="expanded-right-panel">
        {expandedNotaView ? (
          <div className="expanded-note-viewer">
            <button
              className="close-expanded-view"
              onClick={() => setExpandedNotaView(null)}
              title="Fechar visualização"
            >
              <FaTimes />
            </button>
            
            <div className="expanded-note-content">
              {renderNotaContent && renderNotaContent(expandedNotaView, () => setExpandedNotaView(null))}
            </div>
          </div>
        ) : (
          <div className="expanded-right-panel-empty">
            <span className="material-symbols-outlined">open_in_new</span>
            <p>Selecione uma nota para visualizar</p>
          </div>
        )}
      </div>
    </div>
  );
}