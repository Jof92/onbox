import React, { useState } from "react";
import { FaCog, FaUpload, FaUserFriends } from "react-icons/fa";
import "./ThinSidebar.css";
import Collab from "./Collab"; // 🔹 Importa o modal de colaboração

export default function ThinSidebar({ containerAtual, user }) {
  const [showCollab, setShowCollab] = useState(false);

  return (
    <>
      <aside className="thin-sidebar">
        <button className="thin-btn" title="Configurações">
          <FaCog />
        </button>

        <button className="thin-btn" title="Enviar / Carregar XML">
          <FaUpload />
        </button>

        <button
          className="thin-btn"
          title="Colaboração"
          onClick={() => setShowCollab(true)} // 🔹 Abre o modal
        >
          <FaUserFriends />
        </button>
      </aside>

      {/* 🔹 Renderiza o modal se showCollab = true */}
      {showCollab && (
        <Collab
          onClose={() => setShowCollab(false)}
          containerAtual={containerAtual}
          user={user}
        />
      )}
    </>
  );
}
