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
}) {
  const handleNewProjectClick = () => {
    onCreateProject();
  };

  const handleOpenSetoresClick = () => {
    onOpenSetoresManager();
  };

  return (
    <aside className="containers-sidebar">
      <button className="sidebar-btn" onClick={handleNewProjectClick}>
        <FaPlus className="icon" /> Projeto
      </button>

      <button className="sidebar-btn" onClick={handleOpenSetoresClick}>
        <FaPlus className="icon" /> Setores
      </button>

      <div className="sidebar-projects">
        {projects.map((proj) => (
          <div
            key={proj.id}
            className={`sidebar-project ${selectedProject?.id === proj.id ? "active" : ""}`}
            onClick={() => onProjectSelect(proj)}
          >
            <span className="project-name">{proj.name || "Projeto"}</span>
            <FaTrash
              className="delete-icon"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProject(proj.id);
              }}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}