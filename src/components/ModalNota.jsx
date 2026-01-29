// src/components/ModalNota.jsx
import React, { useCallback, useState } from "react";
import { FaTimes, FaFileAlt } from "react-icons/fa";
import Listagem from "./Listagem";
import AtaCard from "./AtaCard";
import Task from "./Task";
import Metas from "./Meta";
import Rdo from "./Rdo";
import NotaCalendario from "./NotaCalendario";
import "./Cards.css";

const TIPOS_NOTA_CRIACAO = [
  { key: "Atas", label: "Atas" },
  { key: "Calendário", label: "Calendário" },
  { key: "Lista", label: "Listagem" },
  { key: "Metas", label: "Metas" },
  { key: "Nota Rápida", label: "Nota Rápida" },
  { key: "Tarefas", label: "Tarefas" },
];

// ✅ Cores exatas fornecidas por você + nova cor para Calendário
const CORES_TIPO = {
  "Atas": "#10b981",   // verde médio
  "Calendário": "#8b5cf6", // roxo médio
  "Lista": "#3b82f6",  // azul (já bom)
  "Metas": "#06b6d4",  // turquesa médio
  "Nota Rápida": "#ec4899", // rosa médio
  "Tarefas": "#fbbf24", // amarelo dourado médio
};

// Ícones para cada tipo de nota
const ICONES_TIPO = {
  "Atas": "📝",
  "Calendário": "📅",
  "Lista": "📋",
  "Metas": "🎯",
  "Nota Rápida": "⚡",
  "Tarefas": "✅",
  "Diário de Obra": "🏗️",
};

export default function ModalNota({
  showNovaNota,
  showEditarNota,
  showVisualizarNota,
  onCloseNovaNota,
  onCloseEditarNota,
  onCloseVisualizarNota,
  formData,
  setFormData,
  handleSaveTask,
  notaEditData,
  setNotaEditData,
  saveEditedNota,
  notaSelecionada,
  project,
  usuarioAtual,
  usuarioId,
  notaProgresso,
  setNotaProgresso,
  donoContainerId,
  onStatusUpdate,
  setColumns,
  setColumnsNormais,
  setColumnsArquivadas 
}) {
  const [hoveredTipo, setHoveredTipo] = useState(null);

  const handleProgressoChange = useCallback(
    (progresso) => {
      if (notaSelecionada?.id) {
        setNotaProgresso((prev) => ({
          ...prev,
          [notaSelecionada.id]: progresso,
        }));
      }
    },
    [notaSelecionada?.id, setNotaProgresso]
  );

  const handleFieldChange = (field, value) => {
    if (showNovaNota) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    } else {
      setNotaEditData((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Não renderizar se nenhum modal estiver ativo
  if (!showNovaNota && !showEditarNota && !showVisualizarNota) {
    return null;
  }

  // Proteção: não abrir Nota Rápida no modal de visualização
  if (showVisualizarNota && notaSelecionada && notaSelecionada.tipo === "Nota Rápida") {
    return null;
  }

  // Determinar o tipo atual e projeto para o header
  const tipoAtual = showNovaNota ? formData.tipo : notaSelecionada?.tipo || notaEditData?.tipo;
  const nomeProjeto = project?.name || "Projeto";
  const nomeNota = showNovaNota 
    ? (formData.nome || "Nova Nota")
    : (notaSelecionada?.nome || notaEditData?.nome || "Editar Nota");
  
  const corHeader = tipoAtual ? CORES_TIPO[tipoAtual] : "#6c757d";

  // Determinar título do modal
  const tituloModal = showNovaNota ? "Nova Nota" : "Editar Nota";

  return (
    <div className="modal-overlay">
      <div className={`modal-content ${showVisualizarNota ? "large" : ""}`}>
        {/* Modal de Criação/Edição */}
        {(showNovaNota || showEditarNota) && (
          <div className="nota-modal-container">
            {/* Header com título - apenas texto, sem ícone */}
            <div className="modal-header">
              <h2 className="modal-title">
                {tituloModal}
              </h2>
              <button 
                className="modal-close-btn" 
                onClick={showNovaNota ? onCloseNovaNota : onCloseEditarNota}
              >
                <FaTimes />
              </button>
            </div>

            <div className="modal-body">
              <label>Nome da nota</label>
              <input
                type="text"
                value={showNovaNota ? formData.nome : notaEditData.nome}
                onChange={(e) => handleFieldChange("nome", e.target.value)}
                placeholder="Digite o nome da nota"
              />

              {showNovaNota && (
                <>
                  <label>Tipo de Nota</label>
                  <div className="tipo-nota-buttons">
                    {TIPOS_NOTA_CRIACAO.map(({ key, label }) => {
                      const isSelected = formData.tipo === key;
                      const isHovered = hoveredTipo === key;

                      const bgColor = isHovered
                        ? CORES_TIPO[key]
                        : isSelected
                        ? CORES_TIPO[key]
                        : "";

                      const color = isSelected || isHovered ? "#fff" : "#000";

                      return (
                        <button
                          key={key}
                          type="button"
                          className={`tipo-btn ${isSelected ? "ativo" : ""}`}
                          onClick={() => setFormData((prev) => ({ ...prev, tipo: key }))}
                          onMouseEnter={() => setHoveredTipo(key)}
                          onMouseLeave={() => setHoveredTipo(null)}
                          style={{
                            backgroundColor: bgColor,
                            color: color,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Botões - ordem original mantida */}
            <div className="modal-nota-actions-container">
              <div className="modal-action-buttons">
                <div className="modal-send-action-wrapper">
                  <button
                    className="modal-send-btn"
                    style={{ 
                      background: tipoAtual 
                        ? `linear-gradient(135deg, ${corHeader} 0%, ${adjustColor(corHeader, -20)} 100%)`
                        : "linear-gradient(135deg, #6c757d 0%, #495057 100%)"
                    }}
                    onClick={showNovaNota ? handleSaveTask : saveEditedNota}
                  >
                    {showNovaNota ? "Criar" : "Salvar"}
                  </button>
                  <button 
                    className="modal-btn-cancelar-evento" 
                    onClick={showNovaNota ? onCloseNovaNota : onCloseEditarNota}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Visualização — mantém todos os tipos + Calendário */}
        {showVisualizarNota && notaSelecionada && (
          <>
            {(() => {
              switch (notaSelecionada.tipo) {
                case "Atas":
                  return (
                    <AtaCard
                      projetoAtual={project}
                      notaAtual={notaSelecionada}
                      onProgressoChange={handleProgressoChange}
                      user={{ id: usuarioId }}
                      onClose={onCloseVisualizarNota}
                      containerAtual={{ id: donoContainerId }}
                    />
                  );
                case "Calendário":
                  return (
                    <NotaCalendario
                      notaId={notaSelecionada.id}
                      onClose={onCloseVisualizarNota}
                      usuarioId={usuarioId}
                      projetoAtual={project}
                      projetoNome={project?.name || "Projeto"}
                      notaNome={notaSelecionada?.nome || "Calendário"}  
                    />
                  );
                case "Tarefas":
                  return (
                    <Task
                      projetoAtual={project}
                      notaAtual={notaSelecionada}
                      pilhaAtual={notaSelecionada.pilha_id ? { id: notaSelecionada.pilha_id } : null}
                      usuarioAtual={usuarioAtual}
                      onClose={onCloseVisualizarNota}
                      containerAtual={{ id: donoContainerId }}
                      setColumns={setColumns}
                      setColumnsNormais={setColumnsNormais}
                      setColumnsArquivadas={setColumnsArquivadas}
                    />
                  );
                case "Metas":
                  return (
                    <Metas
                      notaId={notaSelecionada.id}
                      projectId={project?.type === "projeto" ? project.id : null}
                      usuarioId={usuarioId}
                    />
                  );
                case "Diário de Obra":
                  return (
                    <Rdo
                      notaId={notaSelecionada.id}
                      onClose={onCloseVisualizarNota}
                      usuarioId={usuarioId}
                      projetoAtual={project}
                    />
                  );
                default:
                  return (
                    <Listagem
                      projetoAtual={project}
                      notaAtual={notaSelecionada}
                      containerAtual={{ id: donoContainerId }}
                      usuarioAtual={usuarioAtual}
                      onClose={onCloseVisualizarNota}
                      onStatusUpdate={onStatusUpdate}
                    />
                  );
              }
            })()}
          </>
        )}
      </div>
    </div>
  );
}

// Função auxiliar para ajustar cor (escurecer)
function adjustColor(hex, percent) {
  // Remover # se existir
  hex = hex.replace('#', '');
  
  // Converter para RGB
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  
  // Converter de volta para hex
  return '#' + (
    0x1000000 + 
    (r < 0 ? 0 : r) * 0x10000 + 
    (g < 0 ? 0 : g) * 0x100 + 
    (b < 0 ? 0 : b)
  ).toString(16).slice(1).toUpperCase();
}