import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { supabase } from "../supabaseClient";

export default function LoginPanel({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    senha: "",
    confirmarSenha: "",
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (isSignup) {
        if (!formData.email.includes("@")) throw new Error("Email inválido!");
        if (formData.senha.length < 6)
          throw new Error("Senha deve ter no mínimo 6 caracteres!");
        if (formData.senha !== formData.confirmarSenha)
          throw new Error("As senhas não conferem!");

        // Criar usuário no Auth e redirecionar para página de cadastro completo
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.senha,
          options: {
            emailRedirectTo: `${window.location.origin}/loginfull`, // ✅ redireciona após confirmar e-mail
          },
        });

        if (signUpError) throw signUpError;

        setFormData({
          email: "",
          senha: "",
          confirmarSenha: "",
        });

        setSuccessMessage(
          "✅ Cadastro iniciado! Confirme seu e-mail para continuar o cadastro completo."
        );

        setTimeout(() => {
          setSuccessMessage("");
          setIsSignup(false);
        }, 4000);
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.senha,
        });

        if (loginError) throw loginError;
        if (onLogin) onLogin();
        navigate("/containers");
      }
    } catch (err) {
      console.error("Erro:", err);
      setError(err.message || "Erro ao processar sua solicitação.");
    } finally {
      setLoading(false);
    }
  };

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
                  Não tem conta?{" "}
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
