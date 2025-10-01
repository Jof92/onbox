import React, { useState } from 'react';
import './Header.css';
import ob2 from '../assets/ob2.png';

export default function Header({ onLoginClick }) {
  return (
    <header className="header">
      <div className="header-left">
        <img src={ob2} alt="Logo Texto" className="header-logo-text" />
      </div>

      <nav className="header-nav-container">
        <ul className="header-nav">
          <li>
            <button 
              className="header-btn-login"
              onClick={onLoginClick} 
              type="button"
            >
              Login
            </button>
          </li>
          {/* Outros links, ex: Sobre, Contato */}
        </ul>
      </nav>
    </header>
  );
}
