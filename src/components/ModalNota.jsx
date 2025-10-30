// ModalNota.jsx
import React from "react";
import { FaTimes } from "react-icons/fa";
import Listagem from "./Listagem";
import AtaCard from "./AtaCard";
import Task from "./Task"; // ✅ IMPORTADO
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
  notaProgresso,
  setNotaProgresso
}) {
  if (!showNovaNota && !showEditarNota && !showVisualizarNota) return null;

  const handleFieldChange = (field, value) => {
    if (showNovaNota) {
      setFormData(prev => ({ ...prev, [field]: value }));
    } else {
      setNotaEditData(prev => ({ ...prev, [field]: value }));
    }
  };

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
                  {["Lista", "Diário de Obra", "Atas", "Medição", "Tarefas"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
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

            {/* ✅ Renderização condicional por tipo */}
            {(() => {
              const commonProps = {
                projetoAtual: project,
                notaAtual: notaSelecionada,
                usuarioAtual: usuarioAtual,
                onClose: onCloseVisualizarNota,
              };

              if (notaSelecionada.tipo === "Atas") {
                return (
                  <AtaCard
                    {...commonProps}
                    onProgressoChange={(p) =>
                      setNotaProgresso(prev => ({ ...prev, [notaSelecionada.id]: p }))
                    }
                  />
                );
              } else if (notaSelecionada.tipo === "Tarefas") {
                // Passa pilhaAtual com base no pilha_id da nota
                const pilhaAtual = notaSelecionada.pilha_id
                  ? { id: notaSelecionada.pilha_id }
                  : null;

                return <Task {...commonProps} pilhaAtual={pilhaAtual} />;
              } else {
                return <Listagem {...commonProps} />;
              }
            })()}
          </>
        )}
      </div>
    </div>
  );
}