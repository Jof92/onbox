// src/components/ModalNota.jsx
import React, { useCallback } from "react";
import { FaTimes } from "react-icons/fa";
import Listagem from "./Listagem";
import AtaCard from "./AtaCard";
import Task from "./Task";
import Metas from "./Meta";
import "./Cards.css";

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
  usuarioId, // ✅ Novo: UUID do usuário logado
  notaProgresso,
  setNotaProgresso
}) {
  const handleProgressoChange = useCallback((progresso) => {
    if (notaSelecionada?.id) {
      setNotaProgresso(prev => ({
        ...prev,
        [notaSelecionada.id]: progresso
      }));
    }
  }, [notaSelecionada?.id, setNotaProgresso]);

  const handleFieldChange = (field, value) => {
    if (showNovaNota) {
      setFormData(prev => ({ ...prev, [field]: value }));
    } else {
      setNotaEditData(prev => ({ ...prev, [field]: value }));
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
            <label>Nome</label>
            <input
              value={showNovaNota ? formData.nome : notaEditData.nome}
              onChange={(e) => handleFieldChange("nome", e.target.value)}
            />
            <label>Responsável</label>
            <input
              value={showNovaNota ? formData.responsavel : notaEditData.responsavel}
              onChange={(e) => handleFieldChange("responsavel", e.target.value)}
            />
            {showNovaNota && (
              <>
                <label>Tipo</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                >
                  {["Lista", "Diário de Obra", "Atas", "Medição", "Tarefas", "Metas"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </>
            )}
            <div className="modal-actions">
              <button
                className="btn-salvar"
                onClick={showNovaNota ? handleSaveTask : saveEditedNota}
              >
                Salvar
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
                    usuarioId={usuarioId}
                    onProgressoChange={handleProgressoChange}
                    onClose={onCloseVisualizarNota}
                  />
                );
              } else if (notaSelecionada.tipo === "Tarefas") {
                const pilhaAtual = notaSelecionada.pilha_id ? { id: notaSelecionada.pilha_id } : null;
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
                    projectId={project?.type === "projeto" ? project.id : null}
                    usuarioId={usuarioId}
                  />
                );
              } else {
                return (
                  <Listagem
                    projetoAtual={project}
                    notaAtual={notaSelecionada}
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