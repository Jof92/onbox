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

  // Envia formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (isSignup) {
        // 🔹 Validações
        if (!formData.email.includes("@")) throw new Error("Email inválido.");
        if (formData.senha.length < 6)
          throw new Error("A senha deve ter pelo menos 6 caracteres.");
        if (formData.senha !== formData.confirmarSenha)
          throw new Error("As senhas não coincidem.");

        // 🔹 Cadastro com redirecionamento após confirmação
        const { error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.senha,
          options: {
            // 🔸 Redireciona direto para a página de cadastro completo
            emailRedirectTo: "https://onbox-two.vercel.app/loginfull",
          },
        });

        if (signUpError) throw signUpError;

        setSuccessMessage(
          "✅ Cadastro iniciado! Verifique seu e-mail e clique no link para continuar o cadastro no OnBox."
        );

        // Limpa formulário e volta para modo de login
        setFormData({ email: "", senha: "", confirmarSenha: "" });
        setTimeout(() => {
          setSuccessMessage("");
          setIsSignup(false);
        }, 5000);
      } else {
        // 🔹 Login normal
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.senha,
        });

        if (loginError) throw loginError;

        // Verifica se o usuário tem perfil completo
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile) {
          // ✅ Perfil completo → containers
          if (onLogin) onLogin();
          navigate("/containers");
        } else {
          // 🚧 Perfil incompleto → loginfull
          navigate("/loginfull");
        }
      }
    } catch (err) {
      console.error("Erro no login/cadastro:", err);
      setError(err.message || "Erro ao processar sua solicitação.");
    } finally {
      setLoading(false);
    }
  };

  // Campo reutilizável
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
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
