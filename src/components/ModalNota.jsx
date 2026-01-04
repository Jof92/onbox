// src/components/ModalNota.jsx
import React, { useCallback } from "react";
import { FaTimes } from "react-icons/fa";
import Listagem from "./Listagem";
import AtaCard from "./AtaCard";
import Task from "./Task";
import Metas from "./Meta";
import Rdo from "./Rdo"; // ✅ Importação do RDO
import "./Cards.css";

const TIPOS_NOTA = [
  { key: "Atas", label: "Atas" },
  { key: "Diário de Obra", label: "Diário de Obra" },
  { key: "Lista", label: "Lista" },
  { key: "Medição", label: "Medição" },
  { key: "Metas", label: "Metas" },
  { key: "Tarefas", label: "Tarefas" },
  { key: "Nota Rápida", label: "Nota Rápida" },
];

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
  project, // ✅ Este deve conter: id, name, type, pavimentos, etc.
  usuarioAtual,
  usuarioId,
  notaProgresso,
  setNotaProgresso,
  donoContainerId,
  onStatusUpdate,
}) {
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
              />

              {showNovaNota && (
                <>
                  <label>Tipo de Nota</label>
                  <div className="tipo-nota-buttons">
                    {TIPOS_NOTA.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={`tipo-btn ${formData.tipo === key ? "ativo" : ""}`}
                        onClick={() => setFormData((prev) => ({ ...prev, tipo: key }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions">
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

        {/* Modal de Visualização */}
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
                  // ✅ Passa 'project' como 'projetoAtual' para o Rdo
                  return (
                    <Rdo
                      notaId={notaSelecionada.id}
                      onClose={onCloseVisualizarNota}
                      usuarioId={usuarioId}
                      projetoAtual={project} // 👈 AQUI ESTÁ A CORREÇÃO!
                    />
                  );

                default:
                  // "Lista", "Medição", etc.
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