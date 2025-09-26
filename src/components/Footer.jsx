import React from 'react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>© {new Date().getFullYear()} OnBox. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
