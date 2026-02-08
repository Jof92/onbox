// src/components/Home.jsx
import React, { useState, useEffect } from "react";
import "./Home.css";

export default function Home({ onOpenLogin }) {
  // Carrossel - Seção 4
  const carouselImages = [
    "https://res.cloudinary.com/dmecovtmm/image/upload/v1770513805/sdw_yokpyn.jpg",
    "https://res.cloudinary.com/dmecovtmm/image/upload/v1770513805/fff_pr9w2a.jpg",
    "https://res.cloudinary.com/dmecovtmm/image/upload/v1770514482/fddfv_rqykt5.jpg",
    "https://res.cloudinary.com/dmecovtmm/image/upload/v1770513805/gt_xw5vrr.jpg",
    "https://res.cloudinary.com/dmecovtmm/image/upload/v1770478597/tela_fl9qav.png"
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-avanço a cada 5 segundos
  useEffect(() => {
    if (!isPaused) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isPaused]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    setIsPaused(true);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
    setIsPaused(true);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setIsPaused(true);
  };

  return (
    <div className="home-new-container">
      {/* Seção 1: GIF à esquerda, Título à direita, Subtítulo abaixo */}
      <section className="home-section home-hero-section">
        <div className="home-hero-content">
          <div className="home-hero-gif-side">
            <img 
              src="https://res.cloudinary.com/dmecovtmm/image/upload/v1770566047/ongif1_qzdzte.gif" 
              alt="OnBox em ação" 
              className="home-hero-gif"
            />
          </div>
          <div className="home-hero-text-side">
            <h1 className="home-new-title">Do escritório ao canteiro, tudo conectado.</h1>
          </div>
        </div>
        <div className="home-hero-subtitle">
          <p className="home-new-subtitle">
            Suas equipes de campo e de escritório trabalhando de forma colaborativa, em tempo real, tudo em um único aplicativo e com as principais funcionalidades utilizadas no dia a dia da construção civil.
          </p>
        </div>
      </section>

      {/* Seção 2: Imagem tela2 */}
      <section className="home-section">
        <div className="home-image-wrapper">
          <img 
            src="https://res.cloudinary.com/dmecovtmm/image/upload/v1770478596/tela2_zps4i3.png" 
            alt="OnBox Interface" 
            className="home-main-image"
          />
        </div>
      </section>

      {/* Seção 3: Funcionalidades em quadrados */}
      <section className="home-section">
        <div className="home-features-grid">
          <div className="home-feature-card">
            <span className="home-feature-icon material-symbols-outlined">text_ad</span>
            <span className="home-feature-text">Atas de reunião</span>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon material-symbols-outlined">task</span>
            <span className="home-feature-text">Tarefas</span>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon material-symbols-outlined">calendar_month</span>
            <span className="home-feature-text">Calendário</span>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon material-symbols-outlined">contract_edit</span>
            <span className="home-feature-text">Diário de obra</span>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon material-symbols-outlined">target</span>
            <span className="home-feature-text">Metas</span>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon material-symbols-outlined">list_alt_add</span>
            <span className="home-feature-text">Lista de materiais</span>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon material-symbols-outlined">notifications_active</span>
            <span className="home-feature-text">Lembretes</span>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-icon material-symbols-outlined">view_kanban</span>
            <span className="home-feature-text">Kanban</span>
          </div>
        </div>
      </section>

      {/* Seção 4: Texto e Carrossel lado a lado */}
      <section className="home-section home-text-image-section">
        <div className="home-text-image-content">
          <div className="home-text-side">
            <p className="home-benefits-text">
              Projetos e setores que interagem entre si, reduzindo tempo de espera e de pesquisa, troca de informações mais rápida.
            </p>
          </div>
          <div className="home-image-side">
            <div 
              className="home-carousel"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Imagens do carrossel */}
              <div className="home-carousel-track">
                {carouselImages.map((image, index) => (
                  <div
                    key={index}
                    className={`home-carousel-slide ${index === currentSlide ? 'active' : ''}`}
                  >
                    <img 
                      src={image} 
                      alt={`OnBox Slide ${index + 1}`} 
                      className="home-carousel-image"
                    />
                  </div>
                ))}
              </div>

              {/* Botões de navegação */}
              <button 
                className="home-carousel-btn home-carousel-btn-prev"
                onClick={prevSlide}
                aria-label="Imagem anterior"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <button 
                className="home-carousel-btn home-carousel-btn-next"
                onClick={nextSlide}
                aria-label="Próxima imagem"
              >
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>

              {/* Indicadores de dots */}
              <div className="home-carousel-dots">
                {carouselImages.map((_, index) => (
                  <button
                    key={index}
                    className={`home-carousel-dot ${index === currentSlide ? 'active' : ''}`}
                    onClick={() => goToSlide(index)}
                    aria-label={`Ir para slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção 5: Call to Action */}
      <section className="home-section home-cta-section">
        <div className="home-cta-content">
          <h2 className="home-cta-title">Faça parte do OnBox. É gratuito!</h2>
          <button className="home-cta-button" onClick={onOpenLogin}>
            Começar Agora
          </button>
        </div>
      </section>
    </div>
  );
}