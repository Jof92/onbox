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
  renderNotaContent, // Nova prop para renderizar conteúdo completo
}) {
  // ── FUNÇÕES AUXILIARES ───────────────────────────────────────────────────
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

  // ── FECHAR MODO EXPANDIDO ────────────────────────────────────────────────
  const handleToggleExpand = (e) => {
    e.stopPropagation();
    setExpandedColumnId(null);
    setExpandedNotaView(null);
  };

  // ── CLICAR EM NOTA PARA VISUALIZAÇÃO ──────────────────────────────────────
  const handleNotaClickExpanded = (nota) => {
    if (nota.tipo === "Nota Rápida") return;
    
    // Debug: verificar a nota clicada
    console.log('🔍 CardPilhaExpand - Nota clicada:', {
      id: nota.id,
      nome: nota.nome,
      tipo: nota.tipo,
      notaCompleta: nota
    });
    
    // Define a nota para visualização no painel lateral (não abre modal)
    setExpandedNotaView(nota);
  };

  // ── RENDERIZAÇÃO ──────────────────────────────────────────────────────────
  return (
    <div className="column-expanded-wrapper">
      {/* ════════════════════════════════════════════════════════════════════════
         ║  PAINEL ESQUERDO: LISTA DE NOTAS
         ╚══════════════════════════════════════════════════════════════════════ */}
      <div className="expanded-left-panel">
        {/* ── Header da Pilha Expandida ── */}
        <div className={`column-header ${isArquivo ? 'arquivo-header' : ''} column-header-expanded`}>
          <h3 className="column-title">{col.title}</h3>
          <div className="column-actions-bar">
            <button
              className="column-action-btn"
              title="Condensar pilha"
              onClick={handleToggleExpand}
            >
              <span className="material-symbols-outlined">compress</span>
            </button>
          </div>
        </div>

        {/* ── Grid de Notas ── */}
        <div className="expanded-notes-grid">
          {col.notas.map((nota) => {
            const isConcluida = notasConcluidas.has(String(nota.id));

            // ───────────────────────────────────────────────────────────────────
            // ✅ NOTA RÁPIDA
            // ───────────────────────────────────────────────────────────────────
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

            // ───────────────────────────────────────────────────────────────────
            // ✅ CALENDÁRIO
            // ───────────────────────────────────────────────────────────────────
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

            // ───────────────────────────────────────────────────────────────────
            // ✅ DIÁRIO DE OBRA
            // ───────────────────────────────────────────────────────────────────
            if (nota.tipo === "Diário de Obra") {
              return (
                <div
                  key={String(nota.id)}
                  className="expanded-note-slot"
                >
                  <div
                    className="card-item tipo-rdo"
                    onClick={() => setExpandedNotaView(nota)}
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

            // ───────────────────────────────────────────────────────────────────
            // ✅ DEMAIS TIPOS (Lista, Atas, Tarefas, Metas, etc.)
            // ───────────────────────────────────────────────────────────────────
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
                  {/* ── Checkbox + Arquivar ── */}
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

                  {/* ── Informações do Card ── */}
                  <div className="card-info">
                    <div className="card-title-wrapper">
                      <strong>{nota.nome}</strong>
                    </div>
                    <p>
                      {nota.tipo}
                      {nota.tipo === "Atas" && notaProgresso[nota.id] !== undefined && <> - {notaProgresso[nota.id]}%</>}
                    </p>

                    {/* ── Data ── */}
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

                  {/* ── Menu 3 Pontos ── */}
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

      {/* ════════════════════════════════════════════════════════════════════════
         ║  PAINEL DIREITO: VISUALIZAÇÃO DA NOTA SELECIONADA
         ╚══════════════════════════════════════════════════════════════════════ */}
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
            
            {/* ═══════════════════════════════════════════════════════════ */}
            {/* DEBUG: INFORMAÇÕES DA NOTA */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div style={{ padding: '20px', background: '#f0f0f0', margin: '10px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>🔍 DEBUG - Informações da Nota</h3>
              <pre style={{ 
                background: '#fff', 
                padding: '10px', 
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
                margin: 0
              }}>
{JSON.stringify({
  id: expandedNotaView.id,
  nome: expandedNotaView.nome,
  tipo: expandedNotaView.tipo,
  pilha_id: expandedNotaView.pilha_id,
  renderNotaContent_existe: !!renderNotaContent,
  renderNotaContent_tipo: typeof renderNotaContent
}, null, 2)}
              </pre>
            </div>

            <div className="expanded-view-content">
              {/* Renderiza o conteúdo completo da nota (mesmo que seria no modal) */}
              {renderNotaContent ? (
                <>
                  <div style={{ 
                    background: '#4CAF50', 
                    color: 'white', 
                    padding: '10px',
                    margin: '10px',
                    borderRadius: '4px'
                  }}>
                    ✅ renderNotaContent EXISTE - Tentando renderizar conteúdo completo...
                  </div>
                  {renderNotaContent(expandedNotaView, () => setExpandedNotaView(null))}
                </>
              ) : (
                /* Fallback caso renderNotaContent não seja fornecido */
                <div style={{ padding: '20px' }}>
                  <div style={{ 
                    background: '#f44336', 
                    color: 'white', 
                    padding: '20px',
                    marginBottom: '20px',
                    borderRadius: '8px'
                  }}>
                    ❌ ERRO: renderNotaContent NÃO FOI PASSADO COMO PROP
                    <br /><br />
                    Verifique se o componente Column está passando a prop renderNotaContent para CardPilhaExpand
                  </div>
                  
                  <div className="expanded-view-details">
                    <h2>{expandedNotaView.nome}</h2>
                    <p><strong>Tipo:</strong> {expandedNotaView.tipo}</p>
                    {expandedNotaView.data_entrega && (
                      <p><strong>Data:</strong> {formatarDataLocal(expandedNotaView.data_entrega)}</p>
                    )}
                    {expandedNotaView.descricao && (
                      <div className="expanded-view-descricao">
                        <strong>Descrição:</strong>
                        <p>{expandedNotaView.descricao}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Estado Vazio ── */
          <div className="expanded-right-panel-empty">
            <span className="material-symbols-outlined">open_in_new</span>
            <p>Selecione uma nota para visualizar</p>
          </div>
        )}
      </div>
    </div>
  );
}