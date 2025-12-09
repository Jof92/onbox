// src/pages/ResetSenha.jsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function ResetSenha() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const token = searchParams.get("token");
  const type = searchParams.get("type");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (novaSenha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (novaSenha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "recovery",
      password: novaSenha,
    });

    if (error) {
      console.error(error);
      setErro("Falha ao redefinir senha. O link pode ter expirado.");
    } else {
      setSucesso(true);
      setTimeout(() => navigate("/"), 2000);
    }
  };

  if (!token || type !== "recovery") {
    return (
      <div style={{ maxWidth: "400px", margin: "100px auto", padding: "20px", color: "red" }}>
        <h2>Link inválido</h2>
        <p>O link de recuperação de senha é inválido ou expirou.</p>
        <button onClick={() => navigate("/")}>Voltar ao início</button>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div style={{ maxWidth: "400px", margin: "100px auto", padding: "20px", color: "green" }}>
        Senha redefinida com sucesso! Redirecionando...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto", padding: "20px" }}>
      <h2>Redefinir Senha</h2>
      {erro && <p style={{ color: "red" }}>{erro}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Nova senha"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <input
          type="password"
          placeholder="Confirmar senha"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Redefinir Senha
        </button>
      </form>
    </div>
  );
}