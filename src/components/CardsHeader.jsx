// src/components/CardsHeader.jsx
import React, { useState } from "react";
import { FaArrowLeft, FaSearch, FaFolderOpen, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./Cards.css";

export default function CardsHeader({
  entity,
  membros,
  donoContainerId,
  onSearch, // recebe função de busca do Cards
}) {
  const navigate = useNavigate();
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearchClick = () => {
    setShowSearchInput(true);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (onSearch) onSearch(value);
  };

  const handleCancelSearch = () => {
    setSearchTerm("");
    if (onSearch) onSearch("");
    setShowSearchInput(false);
  };

  return (
    <header className="cards-header">
        <div className="begin-header">
      <button
        className="btn-voltar"
        onClick={() => {
          if (donoContainerId) {
            navigate(`/containers/${donoContainerId}`);
          } else {
            navigate("/containers");
          }
        }}
        title="Voltar"
      >
        <FaArrowLeft />
      </button>

      {entity?.photo_url && (
        <img
          src={entity.photo_url}
          alt={entity.name}
          className="project-photo-header"
        />
      )}

      <h1>
        Pilhas -{" "}
        <span className="project-name">
          {entity?.name || "Entidade Desconhecida"}
        </span>
      </h1>
      </div>

      {/* Área central: busca + pasta */}
      <div className="cards-header-center">
        {showSearchInput ? (
          <div className="search-input-wrapper">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Buscar em notas..."
              autoFocus
              className="search-input"
            />
            <button
              onClick={handleCancelSearch}
              className="search-cancel-btn"
              title="Cancelar busca"
            >
              <FaTimes />
            </button>
          </div>
        ) : (
          <div className="cards-header-actions">
            <button
              className="btn-header-action"
              title="Buscar"
              onClick={handleSearchClick}
            >
              <FaSearch />
            </button>
            <button className="btn-header-action" title="Arquivos">
              <FaFolderOpen />
            </button>
          </div>
        )}
      </div>

      {/* Avatares à direita */}
      {membros.length > 0 && (
        <div className="cards-header-members">
          {membros.slice(0, 5).map((membro) => (
            <img
              key={membro.id}
              src={
                membro.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  membro.nickname || "M"
                )}&background=81C784&color=fff`
              }
              alt={membro.nickname || "Membro"}
              className="member-avatar"
              title={membro.nickname}
            />
          ))}
        </div>
      )}
    </header>
  );
}