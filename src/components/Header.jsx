import React from 'react';
import './Header.css';
import ob2 from '../assets/ob2.png';

export default function Header({ onLoginClick, onLogout, session }) {
  return (
    <header className="header">
      <div className="header-left">
        <img src={ob2} alt="Logo Texto" className="header-logo-text" />
      </div>

      <nav className="header-nav-container">
        <ul className="header-nav">
          {/* Exibe Login apenas se o usuário não estiver logado */}
          {!session ? (
            <li>
              <button
                className="header-btn-login"
                onClick={onLoginClick}
                type="button"
              >
                Login
              </button>
            </li>
          ) : (
            <li>
              <button
                className="header-btn-logout"
                onClick={onLogout}
                type="button"
              >
                Sair
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
