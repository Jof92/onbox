// src/components/TaskReactions.jsx
import React, { useState, useEffect, useRef } from "react";
import { FiSmile, FiMoreHorizontal } from "react-icons/fi";
import "./Task.css";

const EMOJIS_PERMITIDOS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const TaskReactions = ({
  comentarioId,
  userId,
  reacoes = {}, // { "👍": 2, "❤️": 1 }
  reacoesDetalhadas = [], // [{ user_id: "uuid", emoji: "👍", user_name: "João", avatar_url: "..." }, ...]
  onToggleReacao,
  disabled = false,
}) => {
  const [menuAberto, setMenuAberto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [tooltip, setTooltip] = useState({ emoji: null, position: null, users: [] });
  const menuRef = useRef(null);
  const tooltipRef = useRef(null);

  // Fechar tooltip ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setTooltip({ emoji: null, position: null, users: [] });
      }
    };
    if (tooltip.emoji) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [tooltip]);

  const handleToggle = (emoji) => {
    if (disabled) return;
    onToggleReacao(comentarioId, emoji);
    setMenuAberto(false);
  };

  const handleEmojiClick = (emoji, event) => {
    if (disabled) return;
    const users = reacoesDetalhadas
      .filter((r) => r.emoji === emoji)
      .map((r) => ({
        id: r.user_id,
        name: r.user_name || "Usuário",
        avatar: r.avatar_url,
      }));

    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      emoji,
      position: { top: rect.bottom + 4, left: rect.left },
      users,
    });
  };

  const emojisUnicos = Object.keys(reacoes);
  const emojisVisiveis = expandido ? emojisUnicos : emojisUnicos.slice(0, 3);
  const temMais = !expandido && emojisUnicos.length > 3;

  return (
    <>
      <button
        type="button"
        title="Adicionar reação"
        onClick={() => setMenuAberto((prev) => !prev)}
        disabled={disabled}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#555",
          fontSize: "16px",
          display: "flex",
          alignItems: "center",
        }}
        aria-label="Adicionar reação"
      >
        <FiSmile />
      </button>

      {menuAberto && (
        <div className="menu-reacoes-flutuante" ref={menuRef}>
          {EMOJIS_PERMITIDOS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => handleToggle(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Barra de reações resumida */}
      {(emojisUnicos.length > 0 || tooltip.emoji) && (
        <div className="comentario-reacoes">
          {emojisVisiveis.map((emoji) => (
            <span
              key={emoji}
              onClick={(e) => handleEmojiClick(emoji, e)}
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "2px" }}
            >
              {emoji}
              {reacoes[emoji] > 1 && <span>{reacoes[emoji]}</span>}
            </span>
          ))}
          {temMais && (
            <button
              type="button"
              onClick={() => setExpandido(true)}
              style={{
                background: "none",
                border: "none",
                color: "#555",
                cursor: "pointer",
                fontSize: "12px",
                padding: "0",
                margin: "0 4px",
              }}
            >
              <FiMoreHorizontal size={14} />
            </button>
          )}
        </div>
      )}

      {/* Tooltip de quem reagiu */}
      {tooltip.emoji && (
        <div
          ref={tooltipRef}
          style={{
            position: "absolute",
            top: `60px`,
            right:`2px`,
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            padding: "8px",
            zIndex: 1001,
            minWidth: "160px",
            fontSize: "13px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            {tooltip.emoji} Reagiram
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {tooltip.users.length > 0 ? (
              tooltip.users.map((user) => (
                <div key={user.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      style={{ width: "20px", height: "20px", borderRadius: "50%" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        backgroundColor: "#e0e0e0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        color: "#555",
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{user.name}</span>
                </div>
              ))
            ) : (
              <span>Nenhum usuário encontrado.</span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TaskReactions;