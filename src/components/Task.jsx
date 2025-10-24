import React, { useState } from "react";
import "./Task.css";
import { FiUploadCloud } from "react-icons/fi";

export default function Task({ onClose, projetoAtual, pilhaAtual, notaAtual }) {
  const [descricao, setDescricao] = useState(
    "O OnBox funciona melhor com a colaboração da equipe! Digite @ para mencionar colegas."
  );
  const [comentario, setComentario] = useState("");
  const [comentarios, setComentarios] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [editandoDescricao, setEditandoDescricao] = useState(false);

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
      {/* HEADER */}
      <div className="task-header">
        <div className="task-header-titles">
          <span className="project-name">
            {projetoAtual?.nome || projetoAtual?.name || "Sem projeto"}
          </span>
          <div className="sub-info">
            <span className="pilha-name">
              {pilhaAtual?.nome || pilhaAtual?.name || pilhaAtual || "Sem pilha"}
            </span>
            &nbsp;-&nbsp;
            <span className="nota-name">
              {notaAtual?.nome || notaAtual?.name || "Sem nota"}
            </span>
          </div>
        </div>
      </div>

      {/* TÍTULO */}
      <h2
        contentEditable
        suppressContentEditableWarning
        className="task-title"
      >
        {notaAtual?.nome || notaAtual?.name || "Título do cartão"}
      </h2>

      {/* DESCRIÇÃO */}
      <div className="descricao-section">
    <h3>Descrição</h3>
      <div
        className="descricao-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => setDescricao(e.currentTarget.innerText)}
        onDoubleClick={() => setEditandoDescricao(true)}
        onBlur={() => setEditandoDescricao(false)}
      >
        {descricao || "Clique aqui para adicionar uma descrição..."}
      </div>
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
              <button title="Remover" onClick={() => handleRemoverAnexo(i)}>
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
