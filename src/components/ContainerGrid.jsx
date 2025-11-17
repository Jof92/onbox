// src/components/ContainerGrid.jsx
import React from "react";

// ✅ Nova função: gera cor suave e única com base no ID
const getConsistentColor = (str) => {
  if (!str) return "#81C784";

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 60%)`;
};

export default function ContainerGrid({
  projects = [],
  setores = [],
  onProjectClick,
  onSetorClick,
  onSetorAction,
  menuSetorAberto,
  setMenuSetorAberto,
}) {
  return (
    <>
      {projects.length > 0 ? (
        <div className="projects-grid">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="project-box"
              onClick={() => onProjectClick?.(proj)}
            >
              <div
                className="project-photo"
                style={{
                  backgroundColor: proj.photo_url ? undefined : getConsistentColor(proj.id),
                  color: "#fff",
                }}
              >
                {proj.photo_url ? (
                  <img src={proj.photo_url} alt={proj.name || "Projeto"} />
                ) : (
                  proj.name?.charAt(0).toUpperCase() || "?"
                )}
              </div>
              <h3>{proj.name || "Projeto"}</h3>
              <p>
                {proj.type === "vertical" ? "Edificação Vertical" : "Edificação Horizontal"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-projects">Tudo calmo por aqui ainda...</p>
      )}

      {setores.length > 0 && (
        <>
          <hr className="setores-divider" />
          <div className="projects-grid">
            {setores.map((setor) => (
              <div
                key={setor.id}
                className="project-box"
                onClick={() => onSetorClick?.(setor)}
                style={{ position: "relative", cursor: "pointer" }}
              >
                <div
                  className="setor-actions-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuSetorAberto?.(menuSetorAberto === setor.id ? null : setor.id);
                  }}
                >
                  <span className="setor-actions-dots">⋯</span>
                </div>

                {menuSetorAberto === setor.id && (
                  <div className="setor-actions-menu">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetorAction?.("verPerfil", setor);
                        setMenuSetorAberto?.(null);
                      }}
                    >
                      Ver perfil
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetorAction?.("delete", setor);
                        setMenuSetorAberto?.(null);
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                )}

                <div
                  className="project-photo"
                  style={{
                    backgroundColor: setor.photo_url ? undefined : getConsistentColor(setor.id),
                    color: "#fff",
                  }}
                >
                  {setor.photo_url ? (
                    <img src={setor.photo_url} alt={setor.name || "Setor"} />
                  ) : (
                    setor.name?.charAt(0).toUpperCase() || "?"
                  )}
                </div>
                <h3>{setor.name || "Setor"}</h3>
                <p>Setor</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}