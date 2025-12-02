// src/components/ModalNota.jsx
import React, { useCallback } from "react";
import { FaTimes } from "react-icons/fa";
import Listagem from "./Listagem";
import AtaCard from "./AtaCard";
import Task from "./Task";
import Metas from "./Meta";
import "./Cards.css";

const TIPOS_NOTA = [
  { key: "Atas", label: "Atas" },
  { key: "Diário de Obra", label: "Diário de Obra" },
  { key: "Lista", label: "Lista" },
  { key: "Medição", label: "Medição" },
  { key: "Metas", label: "Metas" },
  { key: "Tarefas", label: "Tarefas" },
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
  project,
  usuarioAtual,
  usuarioId,
  notaProgresso,
  setNotaProgresso,
  donoContainerId,
}) {
  const handleProgressoChange = useCallback((progresso) => {
    if (notaSelecionada?.id) {
      setNotaProgresso((prev) => ({
        ...prev,
        [notaSelecionada.id]: progresso,
      }));
    }
  }, [notaSelecionada?.id, setNotaProgresso]);

  const handleFieldChange = (field, value) => {
    if (showNovaNota) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    } else {
      setNotaEditData((prev) => ({ ...prev, [field]: value }));
    }
  };

  // Função para formatar data de forma segura
  const formatarData = (dateString) => {
    if (!dateString) return "Nunca";
    try {
      return new Date(dateString).toLocaleString("pt-BR");
    } catch {
      return "Data inválida";
    }
  };

  if (!showNovaNota && !showEditarNota && !showVisualizarNota) {
    return <></>;
  }

  return (
    <div className="modal-overlay">
      <div className={`modal-content ${showVisualizarNota ? "large" : ""}`}>
        {(showNovaNota || showEditarNota) && (
          <div className="nota-modal-container">
            <h2>{showNovaNota ? "Nova Nota" : "Editar Nota"}</h2>

            <label>Nome da nota</label>
            <input
              value={showNovaNota ? formData.nome : notaEditData.nome}
              onChange={(e) => handleFieldChange("nome", e.target.value)}
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

        {showVisualizarNota && notaSelecionada && (
          <>
            <button
              className="modal-close-btn"
              onClick={onCloseVisualizarNota}
              title="Fechar"
            >
              <FaTimes />
            </button>

            {/* Renderização condicional por tipo da nota */}
            {(() => {
              if (notaSelecionada.tipo === "Atas") {
                return (
                  <AtaCard
                    projetoAtual={project}
                    notaAtual={notaSelecionada}
                    onProgressoChange={handleProgressoChange}
                    user={{ id: usuarioId }}
                    onClose={onCloseVisualizarNota}
                  />
                );
              } else if (notaSelecionada.tipo === "Tarefas") {
                const pilhaAtual = notaSelecionada.pilha_id
                  ? { id: notaSelecionada.pilha_id }
                  : null;
                return (
                  <Task
                    projetoAtual={project}
                    notaAtual={notaSelecionada}
                    pilhaAtual={pilhaAtual}
                    usuarioAtual={usuarioAtual}
                    onClose={onCloseVisualizarNota}
                  />
                );
              } else if (notaSelecionada.tipo === "Metas") {
                return (
                  <Metas
                    notaId={notaSelecionada.id}
                    projectId={
                      project?.type === "projeto" ? project.id : null
                    }
                    usuarioId={usuarioId}
                  />
                );
              } else {
                return (
                  <Listagem
                    projetoAtual={project}
                    notaAtual={notaSelecionada}
                    containerAtual={{ id: donoContainerId }} // 👈 IMPORTANTE!
                    usuarioAtual={usuarioAtual}
                    onClose={onCloseVisualizarNota}
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