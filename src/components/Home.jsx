// src/components/Home.jsx
import React from "react";
import imgMaterial from "../assets/material.png";
import imgOb4 from "../assets/ob1.png"; // ou ob4.png — confirme o nome
import imgScroll from "../assets/1.png"; // ✅ imagem que aparece ao rolar
import "./Home.css";

export default function Home({ onOpenLogin }) {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      {/* Container principal — NÃO ALTERADO */}
      <div className="home-container">
        {/* Bloco Esquerdo */}
        <div className="home-left">
          <img src={imgMaterial} alt="Material" className="home-image" />
        </div>

        {/* Bloco Direito */}
        <div className="home-right">
          <div className="home-content">
            <h1 className="home-title">Do escritório ao canteiro, tudo conectado.</h1>
            <p className="home-subtitle">
              Agora suas equipes podem colaborar em tempo real.
            </p>

            <ul className="home-features">
              <li>Kanban</li>
              <li>Lista de materiais</li>
              <li>Elaboração de atas</li>
              <li>Tarefas</li>
              <li>Metas</li>
              <li>Diário de obras</li>
              <li>Medições</li>
            </ul>

            <button className="home-button" onClick={onOpenLogin}>
              Mãos à obra
            </button>
          </div>

          {/* Logo clicável no canto inferior direito — dentro do home-right */}
          <button className="home-logo-button" onClick={scrollToTop} aria-label="Voltar ao topo">
            <img src={imgOb4} alt="OnBox" className="home-logo" />
          </button>
        </div>
      </div>

      {/* Nova imagem — aparece AO ROLAR PARA BAIXO */}
      <div className="home-scroll-image-container">
        <img src={imgScroll} alt="OnBox na construção civil" className="home-scroll-image" />
      </div>
    </>
  );
}