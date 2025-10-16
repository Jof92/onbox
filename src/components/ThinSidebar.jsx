// ThinSidebar.jsx
import React from "react";
import { FaCog, FaUpload } from "react-icons/fa";
import "./ThinSidebar.css";

export default function ThinSidebar() {
  return (
    <aside className="thin-sidebar">
      <button className="thin-btn" title="Configurações">
        <FaCog />
      </button>
      <button className="thin-btn" title="Carregar / Enviar XML">
        <FaUpload />
      </button>
    </aside>
  );
}
