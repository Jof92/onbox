// src/components/Login.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import "./Login.css";

export default function LoginPanel({ onLogin, onClose }) {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    senha: "",
    confirmarSenha: "",
  });

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
        if (!formData.email.includes("@")) throw new Error("Email inválido.");
        if (formData.senha.length < 6)
          throw new Error("A senha deve ter pelo menos 6 caracteres.");
        if (formData.senha !== formData.confirmarSenha)
          throw new Error("As senhas não coincidem.");

        const { error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.senha,
          options: {
            emailRedirectTo: "https://onbox-two.vercel.app/loginfull",
          },
        });

        if (signUpError) throw signUpError;

        setSuccessMessage(
          "✅ Cadastro iniciado! Verifique seu e-mail e clique no link para continuar o cadastro no OnBox."
        );

        setFormData({ email: "", senha: "", confirmarSenha: "" });
        setTimeout(() => {
          setSuccessMessage("");
          setIsSignup(false);
        }, 5000);
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.senha,
        });

        if (loginError) throw loginError;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile) {
          if (onLogin) onLogin();
          if (onClose) onClose();
        } else {
          if (onClose) onClose();
          window.location.href = "/loginfull";
        }
      }
    } catch (err) {
      console.error("Erro no login/cadastro:", err);
      setError(err.message || "Erro ao processar sua solicitação.");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Nova lógica: dispara e-mail de recuperação
  const handleEsqueciSenha = async () => {
    if (!formData.email) {
      setError("Por favor, digite seu e-mail para recuperar a senha.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        options: {
          emailRedirectTo: "https://onbox-two.vercel.app/ResetSenha",
        },
      });

      if (error) {
        throw error;
      }

      setSuccessMessage("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setFormData((prev) => ({ ...prev, email: "" }));
      setTimeout(() => {
        setSuccessMessage("");
        if (onClose) onClose();
      }, 4000);
    } catch (err) {
      console.error("Erro ao enviar e-mail de recuperação:", err);
      setError(err.message || "Erro ao enviar e-mail. Verifique o endereço.");
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label, field, type = "text") => (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        value={formData[field]}
        onChange={(e) => handleChange(field, e.target.value)}
        required
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
              {!isSignup && renderInput("Senha", "senha", "password")}
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
                    className="link-btn"
                    onClick={() => setIsSignup(false)}
                  >
                    Entrar
                  </button>
                </>
              ) : (
                <>
                  Não tem conta?{" "}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setIsSignup(true)}
                  >
                    Cadastre-se
                  </button>
                  {" | "}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={handleEsqueciSenha}
                    disabled={loading}
                  >
                    Esqueci a senha
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