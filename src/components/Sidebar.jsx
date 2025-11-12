// src/components/Sidebar.jsx
import React from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import "./Containers.css";

export default function Sidebar({
  projects,
  selectedProject,
  onCreateProject,
  onProjectSelect,
  onDeleteProject,
  onOpenSetoresManager,
  currentUserId,
  containerOwnerId,
}) {
  const isOwner = currentUserId && containerOwnerId && currentUserId === containerOwnerId;

  return (
    <aside className="containers-sidebar">
      {isOwner && (
        <button className="sidebar-btn" onClick={onCreateProject}>
          <FaPlus className="icon" /> Projeto
        </button>
      )}

      {isOwner && (
        <button className="sidebar-btn" onClick={onOpenSetoresManager}>
          <FaPlus className="icon" /> Setores
        </button>
      )}

      <div className="sidebar-projects">
        {projects.map((proj) => (
          <div
            key={proj.id}
            className={`sidebar-project ${selectedProject?.id === proj.id ? "active" : ""}`}
            onClick={() => onProjectSelect(proj)}
          >
            <span className="project-name">{proj.name || "Projeto"}</span>
            {isOwner && (
              <FaTrash
                className="delete-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProject(proj.id);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}