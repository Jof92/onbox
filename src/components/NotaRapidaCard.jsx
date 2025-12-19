// src/components/QuickNoteCard.jsx
import React, { useState, useEffect } from "react";
import { FaUser, FaCalendarAlt, FaTimes } from "react-icons/fa";
import { supabase } from "../supabaseClient";

export default function QuickNoteCard({
  nota,
  onSaveNome,
  onSaveResponsavel,
  onSaveDataEntrega,
  onRemoveResponsavel,
}) {
  const [nomeEdit, setNomeEdit] = useState(nota.nome || "");
  const [editingNome, setEditingNome] = useState(false);
  const [responsavelInput, setResponsavelInput] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [dataEntrega, setDataEntrega] = useState(nota.data_entrega || "");

  // Salvar nome ao perder foco
  const handleNomeBlur = () => {
    if (nomeEdit.trim() && nomeEdit !== nota.nome) {
      onSaveNome(nota.id, nomeEdit.trim());
    }
    setEditingNome(false);
  };

  // Salvar data ao mudar
  const handleDataChange = (e) => {
    const val = e.target.value;
    setDataEntrega(val);
    onSaveDataEntrega(nota.id, val || null);
  };

  // Lógica de menção (@) — simplificada aqui; você pode integrar com seu sistema de menções
  const handleResponsavelChange = (e) => {
    const val = e.target.value;
    setResponsavelInput(val);
    if (val.startsWith("@")) {
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const selectResponsavel = (user) => {
    onSaveResponsavel(nota.id, user.id, user.nome);
    setResponsavelInput("");
    setShowMentions(false);
  };

  return (
    <div className="quick-note-card">
      {nota.imagem_url && (
        <img
          src={nota.imagem_url}
          alt="Anexo"
          className="quick-note-image"
          style={{
            width: "100%",
            height: "80px",
            objectFit: "cover",
            borderRadius: "4px",
            marginBottom: "8px",
          }}
        />
      )}

      {editingNome ? (
        <input
          type="text"
          value={nomeEdit}
          autoFocus
          onChange={(e) => setNomeEdit(e.target.value)}
          onBlur={handleNomeBlur}
          onKeyDown={(e) => e.key === "Enter" && handleNomeBlur()}
          className="quick-note-nome-input"
        />
      ) : (
        <div
          className="quick-note-nome"
          onClick={() => setEditingNome(true)}
          style={{ cursor: "text", fontWeight: "bold", marginBottom: "6px" }}
        >
          {nomeEdit || "Clique para editar..."}
        </div>
      )}

      {/* Responsável */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        <FaUser size={12} style={{ color: "#666" }} />
        {nota.responsavel_nome ? (
          <span>
            {nota.responsavel_nome}
            <button
              onClick={() => onRemoveResponsavel(nota.id)}
              style={{ marginLeft: "4px", background: "none", border: "none", color: "#999", cursor: "pointer" }}
            >
              <FaTimes size={10} />
            </button>
          </span>
        ) : (
          <input
            type="text"
            value={responsavelInput}
            placeholder="@mencionar"
            onChange={handleResponsavelChange}
            className="quick-note-responsavel-input"
            style={{ fontSize: "0.85em", padding: "2px", border: "1px solid #ddd", borderRadius: "3px" }}
          />
        )}
      </div>

      {/* Data de entrega */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85em" }}>
        <FaCalendarAlt size={12} style={{ color: "#666" }} />
        <input
          type="date"
          value={dataEntrega || ""}
          onChange={handleDataChange}
          style={{ fontSize: "0.85em", padding: "2px" }}
        />
      </div>

      {/* Aqui você pode colocar o dropdown de menções se `showMentions` */}
      {showMentions && (
        <div className="mention-dropdown">
          {/* Exemplo: lista de participantes do container atual */}
          {/* Você já tem lógica de menção — reutilize aqui */}
        </div>
      )}
    </div>
  );
}