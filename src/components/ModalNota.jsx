// ModalNota.jsx
import React from "react";
import { FaTimes } from "react-icons/fa";
import Listagem from "./Listagem";
import AtaCard from "./AtaCard";
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
  // ✅ REMOVIDO: pilhaSelecionada
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

  // ✅ Helper para obter o título da pilha atual (só para exibição no AtaCard, se necessário)
  const getPilhaTitle = () => {
    if (!notaSelecionada || !project) return null;
    // Se você ainda precisar do nome da pilha para o AtaCard, busque pelas colunas
    // Mas idealmente, AtaCard também deveria usar nota.id ou pilha_id
    return null; // vamos remover a dependência por enquanto
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
                  {["Lista", "Diário de Obra", "Atas", "Medição"].map((t) => (
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

            <div className="nota-header">
              <h2>{notaSelecionada.nome}</h2>
              {notaSelecionada.tipo === "Atas" && (
                <span className="nota-info">
                  {notaSelecionada.tipo} - {notaProgresso[notaSelecionada.id] || 0}%
                </span>
              )}
            </div>

            {notaSelecionada.tipo === "Atas" ? (
              <AtaCard
                projetoAtual={project}
                // ⚠️ Se AtaCard ainda usar pilhaAtual, você pode passar o ID ou buscar o título
                // Mas ideal: AtaCard também deve depender só da nota
                notaAtual={notaSelecionada}
                usuarioAtual={usuarioAtual}
                onProgressoChange={(p) =>
                  setNotaProgresso(prev => ({ ...prev, [notaSelecionada.id]: p }))
                }
              />
            ) : (
              <Listagem
                projetoAtual={project}
                notaAtual={notaSelecionada} // ✅ objeto completo com .id
                usuarioAtual={usuarioAtual}
                // ❌ REMOVIDO: pilhaAtual, locacoes, eaps (não são mais necessários)
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}