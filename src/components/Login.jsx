import React from 'react';
import './Login.css';

export default function LoginPanel() {
  return (
    <div className="login-panel">
      <h2>Entrar</h2>
      <form>
        <div className="form-group">
          <label>Email</label>
          <input type="email" placeholder="Digite seu email" required />
        </div>
        <div className="form-group">
          <label>Senha</label>
          <input type="password" placeholder="Digite sua senha" required />
        </div>
        <button type="submit" className="login-btn">Acessar</button>
      </form>
      <p className="signup-link">
        Não tem conta? <a href="/cadastro">Cadastre-se</a>
      </p>
    </div>
  );
}
