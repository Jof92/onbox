import React, { useState } from "react";
import "./Task.css";

export default function Task({ onClose }) {
  const [descricao, setDescricao] = useState(
    "O OnBox funciona melhor com a colaboração da equipe! Digite @ para mencionar colegas."
  );
  const [comentario, setComentario] = useState("");
  const [comentarios, setComentarios] = useState([]);
  const [anexos, setAnexos] = useState([]);

  const handleSalvarDescricao = () => {
    alert("Descrição salva:\n" + descricao);
  };

  const handleCancelarDescricao = () => {
    setDescricao(
      "O OnBox funciona melhor com a colaboração da equipe! Digite @ para mencionar colegas."
    );
  };

  const handleAddComentario = () => {
    if (comentario.trim() === "") return;
    const hora = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const novoComentario = `José Frota comentou às ${hora}: ${comentario}`;
    setComentarios([...comentarios, novoComentario]);
    setComentario("");
  };

  const handleAddAnexos = (e) => {
    const files = Array.from(e.target.files);
    setAnexos((prev) => [...prev, ...files]);
  };

  const handleRemoverAnexo = (index) => {
    setAnexos(anexos.filter((_, i) => i !== index));
  };

  return (
    <div className="task-modal">
      <div className="modal-header">
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>
      </div>

      <h2 contentEditable suppressContentEditableWarning className="task-title">
        Título do cartão
      </h2>

      {/* Descrição */}
      <div className="descricao-section">
        <h3>Descrição</h3>
        <div
          className="descricao-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => setDescricao(e.currentTarget.textContent)}
        >
          {descricao}
        </div>
        <div className="editor-buttons">
          <button onClick={handleSalvarDescricao}>Salvar</button>
          <button id="cancelDesc" onClick={handleCancelarDescricao}>
            Cancelar
          </button>
        </div>
      </div>

      {/* Anexos */}
      <div className="anexos-section">
        <div className="anexos-header">
          <h3>Anexos</h3>
          <label htmlFor="fileInput" className="clip-btn">
            📎
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
              <span>📎 {file.name}</span>
              <button title="Remover" onClick={() => handleRemoverAnexo(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Comentários */}
      <div className="comentarios-section">
        <h3>Comentários e atividades</h3>
        <textarea
          placeholder="Escrever um comentário..."
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
        <button onClick={handleAddComentario}>Comentar</button>

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
