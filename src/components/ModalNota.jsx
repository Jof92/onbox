// src/components/ModalNota.jsx
import React, { useCallback, useState } from "react";
import { FaTimes } from "react-icons/fa";
import Listagem from "./Listagem";
import AtaCard from "./AtaCard";
import Task from "./Task";
import Metas from "./Meta";
import Rdo from "./Rdo";
import "./Cards.css";

const TIPOS_NOTA_CRIACAO = [
  { key: "Atas", label: "Atas" },
  { key: "Lista", label: "Listagem" },
  { key: "Metas", label: "Metas" },
  { key: "Nota Rápida", label: "Nota Rápida" },
  { key: "Tarefas", label: "Tarefas" },
];

// ✅ Cores exatas fornecidas por você
const CORES_TIPO = {
  "Atas": "#10b981",   // verde médio
  "Lista": "#3b82f6",  // azul (já bom)
  "Metas": "#06b6d4",  // turquesa médio
  "Nota Rápida": "#ec4899", // rosa médio
  "Tarefas": "#fbbf24", // amarelo dourado médio
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

  return (
    <div className="modal-overlay">
      <div className={`modal-content ${showVisualizarNota ? "large" : ""}`}>
        {/* Modal de Criação/Edição */}
        {(showNovaNota || showEditarNota) && (
          <div className="nota-modal-container">
            <div className="modal-header">
              <h2>{showNovaNota ? "Nova Nota" : "Editar Nota"}</h2>
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
                // ✅ NENHUM ESTILO DINÂMICO AQUI — só o padrão do CSS
              />

              {showNovaNota && (
                <>
                  <label>Tipo de Nota</label>
                  <div className="tipo-nota-buttons">
                    {TIPOS_NOTA_CRIACAO.map(({ key, label }) => {
                      const isSelected = formData.tipo === key;
                      const isHovered = hoveredTipo === key;

                      // ✅ APENAS O BACKGROUND MUDA NO HOVER — NADA MAIS
                      const bgColor = isHovered
                        ? CORES_TIPO[key]     // cor sólida no hover
                        : isSelected
                        ? CORES_TIPO[key]     // cor sólida quando selecionado
                        : "";                 // branco/default

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
                            // ✅ NENHUMA BORDA, NENHUM OUTRO EFEITO ADICIONADO
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

            <div className="modal-actions1">
              <button
                className="btn-salvar"
                onClick={showNovaNota ? handleSaveTask : saveEditedNota}
              >
                {showNovaNota ? "Criar" : "Salvar"}
              </button>
              <button
                className="btn-cancelar"
                onClick={showNovaNota ? onCloseNovaNota : onCloseEditarNota}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Modal de Visualização — mantém todos os tipos */}
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