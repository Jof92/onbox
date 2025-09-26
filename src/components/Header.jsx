import React, { useState } from 'react';
import './Header.css';
import ob1 from '../assets/ob1.png';
import ob2 from '../assets/ob2.png';
import LoginPanel from './Login';

export default function Header() {
  const [showLogin, setShowLogin] = useState(false);

  const toggleLogin = (e) => {
    e.preventDefault();
    setShowLogin(prev => !prev);
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <img src={ob2} alt="Logo Texto" className="header-logo-text" />
        </div>

        <nav className="header-nav-container">
          <ul className="header-nav">
            <li>
              <a href="#!" onClick={toggleLogin}>
                Login
              </a>
            </li>
            {/* Aqui você pode adicionar outros links, ex: Sobre, Contato */}
          </ul>
        </nav>
      </header>

      {/* Painel de login suspenso */}
      {showLogin && <LoginPanel />}
    </>
  );
}
