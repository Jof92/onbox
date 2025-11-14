// CometarioAta.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import "./ComentarioAta.css";

export default function ComentarioAta({ objetivoId, comentarioInicial = "", onSalvo }) {
  const [editando, setEditando] = useState(false);
  const [comentario, setComentario] = useState(comentarioInicial);

  const handleSalvar = async () => {
    if (!objetivoId) return;

    try {
      const { error } = await supabase
        .from("ata_objetivos")
        .update({ comentario })
        .eq("id", objetivoId);

      if (error) throw error;

      if (typeof onSalvo === "function") {
        onSalvo(comentario);
      }
      setEditando(false);
    } catch (err) {
      console.error("Erro ao salvar comentário:", err);
      alert("Erro ao salvar comentário.");
    }
  };

  const handleCancelar = () => {
    setComentario(comentarioInicial);
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="comentario-ata-editor">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Comente sobre a conclusão deste objetivo..."
          rows={2}
          className="comentario-textarea"
        />
        <div className="comentario-actions">
          <button onClick={handleSalvar} className="btn-comentario-salvar">
            Salvar
          </button>
          <button onClick={handleCancelar} className="btn-comentario-cancelar">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <span
      className="icone-comentario"
      onClick={() => setEditando(true)}
      title={comentario ? "Editar comentário" : "Adicionar comentário"}
    >
      💬
    </span>
  );
}