import React, { useState } from "react";
import { FaUserCircle, FaCog, FaUpload, FaUserFriends } from "react-icons/fa";
import "./ThinSidebar.css";
import Collab from "./Collab";
import LoginFull from "./LoginFull"; // 🔹 Importa o LoginFull para usar como modal

export default function ThinSidebar({ containerAtual, user }) {
  const [showCollab, setShowCollab] = useState(false);
  const [showLoginFull, setShowLoginFull] = useState(false); // 🔹 Controla o modal de LoginFull

  return (
    <>
      <aside className="thin-sidebar">
        {/* 🔹 Novo botão de Usuário */}
        <button
          className="thin-btn"
          title="Perfil / Login"
          onClick={() => setShowLoginFull(true)}
        >
          <FaUserCircle />
        </button>

        <button className="thin-btn" title="Configurações">
          <FaCog />
        </button>

        <button className="thin-btn" title="Enviar / Carregar XML">
          <FaUpload />
        </button>

        <button
          className="thin-btn"
          title="Colaboração"
          onClick={() => setShowCollab(true)}
        >
          <FaUserFriends />
        </button>
      </aside>

      {/* 🔹 Modal do LoginFull */}
      {showLoginFull && (
        <div className="modal-overlay" onClick={() => setShowLoginFull(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()} // impede fechar ao clicar dentro
          >
            <LoginFull />
          </div>
        </div>
      )}

      {/* 🔹 Modal do Collab */}
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
