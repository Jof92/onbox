import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { supabase } from '../supabaseClient';

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
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isSignup) {
        // Validações básicas
        if (!formData.email.includes('@')) {
          setError('Email inválido!');
          setLoading(false);
          return;
        }
        if (formData.senha.length < 6) {
          setError('Senha deve ter no mínimo 6 caracteres!');
          setLoading(false);
          return;
        }
        if (formData.senha !== formData.confirmarSenha) {
          setError('As senhas não conferem!');
          setLoading(false);
          return;
        }

        console.log('Tentando criar usuário:', formData);

        // Criar usuário no Auth
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.senha
        });

        console.log('signUpData:', signUpData);
        console.log('signUpError:', signUpError);

        if (signUpError) throw signUpError;

        const userId = signUpData.user?.id;
        if (!userId) {
          throw new Error('Erro ao criar usuário. ID não retornado pelo Auth.');
        }

        // Inserir perfil na tabela profiles
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: userId,
            nome: formData.nome,
            empresa: formData.empresa,
            funcao: formData.funcao,
            email: formData.email
          }
        ]);

        if (profileError) throw profileError;

        // Limpar formulário e mostrar mensagem
        setFormData({
          nome: '',
          empresa: '',
          funcao: '',
          email: '',
          senha: '',
          confirmarSenha: ''
        });

        setSuccessMessage(
          'Cadastro feito com sucesso! Verifique seu email para confirmar a conta.'
        );

      } else {
        // Login normal
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.senha
        });
        if (loginError) throw loginError;

        if (onLogin) onLogin();
        navigate('/containers');
      }
    } catch (err) {
      console.error(err);
      if (err.status === 500) {
        setError('Erro do servidor: verifique sua conexão ou tente outro email.');
      } else {
        setError(err.message || 'Erro ao processar a requisição.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label, field, type = 'text', required = true) => (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        value={formData[field]}
        onChange={(e) => handleChange(field, e.target.value)}
        required={required}
      />
    </div>
  );

  return (
    <div className="login-page">
      <div className="login-panel">
        {successMessage ? (
          <div className="success-message">{successMessage}</div>
        ) : (
          <>
            <h2>{isSignup ? 'Criar Conta' : 'Entrar'}</h2>
            <form onSubmit={handleSubmit}>
              {isSignup && renderInput('Nome', 'nome')}
              {isSignup && renderInput('Empresa', 'empresa')}
              {isSignup && renderInput('Função', 'funcao')}
              {renderInput('Email', 'email', 'email')}
              {renderInput('Senha', 'senha', 'password')}
              {isSignup && renderInput('Confirmar Senha', 'confirmarSenha', 'password')}

              {error && <div className="error-msg">{error}</div>}

              <button type="submit" className="login-btn" disabled={loading}>
                {loading
                  ? isSignup
                    ? 'Cadastrando...'
                    : 'Entrando...'
                  : isSignup
                  ? 'Cadastrar'
                  : 'Acessar'}
              </button>
            </form>

            <p className="signup-link">
              {isSignup ? (
                <>
                  Já tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignup(false)}
                    className="link-btn"
                  >
                    Entrar
                  </button>
                </>
              ) : (
                <>
                  Não tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignup(true)}
                    className="link-btn"
                  >
                    Cadastre-se
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
