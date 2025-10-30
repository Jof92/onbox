// Task.jsx
import React, { useState } from "react";
import "./Task.css";
import { FiUploadCloud } from "react-icons/fi";

export default function Task({ onClose, projetoAtual, notaAtual }) {
  const [descricao, setDescricao] = useState(
    "O OnBox funciona melhor com a colaboração da equipe! Digite @ para mencionar colegas."
  );
  const [comentario, setComentario] = useState("");
  const [comentarios, setComentarios] = useState([]);
  const [anexos, setAnexos] = useState([]);

  const handleAddComentario = () => {
    if (!comentario.trim()) return;
    const hora = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const novoComentario = `Você comentou às ${hora}: ${comentario}`;
    setComentarios((prev) => [...prev, novoComentario]);
    setComentario("");
  };

  const handleAddAnexos = (e) => {
    const files = Array.from(e.target.files || []);
    setAnexos((prev) => [...prev, ...files]);
  };

  const handleRemoverAnexo = (index) => {
    setAnexos((prev) => prev.filter((_, i) => i !== index));
  };

  const getNomeProjeto = () => projetoAtual?.nome || projetoAtual?.name || "Sem projeto";
  const getNomeNota = () => notaAtual?.nome || notaAtual?.name || "Sem nota";

  return (
    <div className="task-modal">
      {/* HEADER — SEM PILHA */}
      <div className="task-header">
        <div className="task-header-titles">
          <span className="project-name">{getNomeProjeto()}</span>
          <div className="sub-info">
            <span className="nota-name">{getNomeNota()}</span>
          </div>
        </div>
      </div>

      <h2 className="task-title">{getNomeNota()}</h2>

      {/* DESCRIÇÃO COM TEXTAREA */}
      <div className="descricao-section">
        <h3>Descrição</h3>
        <textarea
          className="descricao-editor-textarea"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Clique aqui para adicionar uma descrição..."
          rows={6}
        />
      </div>

      {/* ANEXOS */}
      <div className="anexos-section">
        <div className="anexos-header">
          <h3>Anexos</h3>
          <label htmlFor="fileInput" className="upload-btn">
            <FiUploadCloud />
            <span>Enviar</span>
          </label>
          <input
            type="file"
            id="fileInput"
            hidden
            multiple
            onChange={handleAddAnexos}
          />
        </div>

        <div className="anexos-lista">
          {anexos.map((file, i) => (
            <div key={i} className="anexo-item">
              <span>{file.name}</span>
              <button
                type="button"
                title="Remover"
                onClick={() => handleRemoverAnexo(i)}
                aria-label="Remover anexo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* COMENTÁRIOS */}
      <div className="comentarios-section">
        <h3>Comentários e atividades</h3>
        <textarea
          placeholder="Escrever um comentário..."
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
        />
        <button type="button" onClick={handleAddComentario}>
          Comentar
        </button>

        <div className="comentarios-lista">
          {comentarios.map((c, i) => (
            <div key={i} className="comentario-item">
              {c}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}