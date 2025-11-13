// src/components/EntityDetails.jsx
import React from "react";
import { FaArrowLeft } from "react-icons/fa";
import "./Containers.css";

const getRandomColor = () => {
  const colors = ["#FFB74D", "#4DB6AC", "#BA68C8", "#7986CB", "#F06292", "#81C784"];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default function EntityDetails({
  entityType,
  entity,
  onBack,
  onEdit,
  children,
  canEdit = false, // ← nova prop
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
          backgroundColor: entity.photo_url ? undefined : getRandomColor(),
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