import React, { useState } from 'react';
import './Login.css';

export default function LoginPanel({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    empresa: '',
    funcao: '',
    email: '',
    senha: '',
    confirmarSenha: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSignup && formData.senha !== formData.confirmarSenha) {
      setError('As senhas não conferem!');
      return;
    }

    setError('');

    // Codifica a senha (exemplo simples, apenas visual)
    const senhaCodificada = btoa(formData.senha);

    // Monta dados para enviar
    const dadosEnvio = {
      ...formData,
      senha: senhaCodificada
    };

    // Aqui você integraria com Supabase
    console.log('Dados enviados para Supabase:', dadosEnvio);

    // Simula login bem-sucedido
    if (onLogin) onLogin();
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        {isSignup ? (
          <>
            <h2>Criar Conta</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Empresa</label>
                <input
                  type="text"
                  value={formData.empresa}
                  onChange={(e) => setFormData({...formData, empresa: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Função</label>
                <input
                  type="text"
                  value={formData.funcao}
                  onChange={(e) => setFormData({...formData, funcao: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({...formData, senha: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirmar Senha</label>
                <input
                  type="password"
                  value={formData.confirmarSenha}
                  onChange={(e) => setFormData({...formData, confirmarSenha: e.target.value})}
                  required
                />
              </div>

              {error && <div className="error-msg">{error}</div>}

              <button type="submit" className="login-btn">Cadastrar</button>
            </form>
            <p className="signup-link">
              Já tem conta?{' '}
              <button type="button" onClick={() => setIsSignup(false)} className="link-btn">
                Entrar
              </button>
            </p>
          </>
        ) : (
          <>
            <h2>Entrar</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({...formData, senha: e.target.value})}
                  required
                />
              </div>
              <button type="submit" className="login-btn">Acessar</button>
            </form>
            <p className="signup-link">
              Não tem conta?{' '}
              <button type="button" onClick={() => setIsSignup(true)} className="link-btn">
                Cadastre-se
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
