import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Login.css";

export default function LoginPanel({ onLogin }) {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    senha: "",
    confirmarSenha: "",
  });

  // Atualiza campos do formulário
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Envio do formulário (login ou cadastro)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (isSignup) {
        // Validações básicas
        if (!formData.email.includes("@")) throw new Error("Email inválido!");
        if (formData.senha.length < 6)
          throw new Error("Senha deve ter no mínimo 6 caracteres!");
        if (formData.senha !== formData.confirmarSenha)
          throw new Error("As senhas não conferem!");

        // Cria usuário no Supabase e envia e-mail com redirecionamento
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.senha,
          options: {
            emailRedirectTo: `${window.location.origin}/loginfull`, // 🔹 Redireciona após confirmar e-mail
          },
        });

        if (signUpError) throw signUpError;

        setFormData({ email: "", senha: "", confirmarSenha: "" });
        setSuccessMessage(
          "✅ Cadastro iniciado! Verifique seu e-mail para continuar o cadastro completo."
        );

        // Volta para login após alguns segundos
        setTimeout(() => {
          setSuccessMessage("");
          setIsSignup(false);
        }, 4000);

      } else {
        // Login normal
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.senha,
        });

        if (loginError) throw loginError;

        if (onLogin) onLogin();
        navigate("/containers");
      }
    } catch (err) {
      console.error("Erro no login/cadastro:", err);
      setError(err.message || "Erro ao processar sua solicitação.");
    } finally {
      setLoading(false);
    }
  };

  // Função auxiliar para renderizar inputs
  const renderInput = (label, field, type = "text", required = true) => (
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
          <div className="success-message-box">{successMessage}</div>
        ) : (
          <>
            <h2>{isSignup ? "Criar Conta" : "Entrar"}</h2>
            <form onSubmit={handleSubmit}>
              {renderInput("Email", "email", "email")}
              {renderInput("Senha", "senha", "password")}
              {isSignup && renderInput("Confirmar Senha", "confirmarSenha", "password")}

              {error && <div className="error-msg">{error}</div>}

              <button type="submit" className="login-btn" disabled={loading}>
                {loading
                  ? isSignup
                    ? "Cadastrando..."
                    : "Entrando..."
                  : isSignup
                  ? "Cadastrar"
                  : "Acessar"}
              </button>
            </form>

            <p className="signup-link">
              {isSignup ? (
                <>
                  Já tem conta?{" "}
                  <button type="button" onClick={() => setIsSignup(false)} className="link-btn">
                    Entrar
                  </button>
                </>
              ) : (
                <>
                  Não tem conta?{" "}
                  <button type="button" onClick={() => setIsSignup(true)} className="link-btn">
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
