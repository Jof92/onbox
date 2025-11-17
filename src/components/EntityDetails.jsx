// src/components/EntityDetails.jsx
import React from "react";
import { FaArrowLeft } from "react-icons/fa";
import "./Containers.css";

// ✅ Função idêntica à usada em ContainerGrid.jsx: gera cor suave e única com base no ID
const getConsistentColor = (str) => {
  if (!str) return "#81C784"; // fallback seguro

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 60%)`;
};

export default function EntityDetails({
  entityType,
  entity,
  onBack,
  onEdit,
  children,
  canEdit = false,
}) {
  const name = entity.name || (entityType === "project" ? "Projeto" : "Setor");
  const membros = Array.isArray(entity.membros) ? entity.membros : [];

  return (
    <div className="project-details">
      <button className="back-btn" onClick={onBack}>
        <FaArrowLeft />
      </button>

      <div
        className="details-photo"
        style={{
          backgroundColor: entity.photo_url ? undefined : getConsistentColor(entity.id),
          color: "#fff",
        }}
      >
        {entity.photo_url ? (
          <img src={entity.photo_url} alt={name} />
        ) : (
          name.charAt(0).toUpperCase() || "?"
        )}
      </div>

      <h2>{name}</h2>

      {membros.length > 0 && (
        <div
          style={{
            marginTop: "12px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent: "center",
            padding: "0 0 10px 0",
          }}
        >
          {membros.map((membro) => {
            if (!membro?.id) return null;
            return (
              <div
                key={membro.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  fontSize: "10px",
                  textAlign: "center",
                }}
              >
                {membro.avatar_url ? (
                  <img
                    src={membro.avatar_url}
                    alt={membro.nickname || "Membro"}
                    style={{
                      width: "4em",
                      height: "4em",
                      borderRadius: "50%",
                      border: "2px solid #007bff",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "4em",
                      height: "4em",
                      borderRadius: "50%",
                      backgroundColor: "#ccc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: "bold",
                      border: "2px solid #007bff",
                    }}
                  >
                    {membro.nickname?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <span style={{ marginTop: "4px", lineHeight: 1.2 }}>
                  {membro.nickname || "Membro"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {children}

      {canEdit && (
        <button className="edit-btn" onClick={onEdit}>
          Editar
        </button>
      )}
    </div>
  );
}