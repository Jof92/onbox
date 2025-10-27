import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./LoginFull.css";

export default function LoginFull() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(true);

  const [formData, setFormData] = useState({
    nome: "",
    empresa: "",
    funcao: "",
    avatar_url: "",
  });

  // 🔹 1️⃣ Inicializa sessão e verifica perfil
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setError("Sessão inválida ou expirou. Faça login novamente.");
          setLoading(false);
          return;
        }

        setSession(session);

        // Verifica se o e-mail foi confirmado
        const user = session.user;
        if (!user.email_confirmed_at) {
          setEmailConfirmed(false);
          setLoading(false);
          return;
        }

        // Busca perfil existente
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("nome, empresa, funcao, avatar_url")
          .eq("id", user.id)
          .single();

        if (profileError && profileError.code !== "PGRST116") {
          console.error("Erro ao buscar perfil:", profileError);
        }

        if (profile) setFormData(profile);
      } catch (err) {
        console.error("Erro ao inicializar sessão:", err);
        setError("Erro ao carregar sua sessão. Faça login novamente.");
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSession(session);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  // 🔹 2️⃣ Upload de avatar
  const handleUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      if (!session?.user) throw new Error("Usuário não autenticado.");

      const fileExt = file.name.split(".").pop();
      const fileName = `${session.user.id}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Remove imagem antiga
      await supabase.storage.from("avatars").remove([filePath]);

      // Faz upload da nova imagem
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obtém URL pública
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: publicUrlData.publicUrl }));
    } catch (err) {
      console.error("Erro no upload de avatar:", err);
      setError("Erro ao enviar imagem. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  // 🔹 3️⃣ Atualiza campos do formulário
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 🔹 4️⃣ Salva perfil
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) return setError("Sessão inválida. Faça login novamente.");

    try {
      setError("");

      const updates = {
        id: session.user.id,
        email: session.user.email,
        nome: formData.nome.trim(),
        empresa: formData.empresa.trim(),
        funcao: formData.funcao.trim(),
        avatar_url: formData.avatar_url || null,
      };

      const { error: updateError } = await supabase.from("profiles").upsert([updates]);

      if (updateError) throw updateError;

      setSuccess(true);

      setTimeout(() => navigate("/containers"), 2000);
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      setError(
        "Erro ao salvar informações do perfil. Verifique se a tabela 'profiles' existe e se você tem permissão de inserção."
      );
    }
  };

  // 🔹 5️⃣ Render loading
  if (loading) {
    return (
      <div className="loginfull-container">
        <div className="loginfull-card">
          <h2>Carregando...</h2>
          <p>Validando sua conta, aguarde.</p>
        </div>
      </div>
    );
  }

  // 🔹 6️⃣ Render caso e-mail não confirmado
  if (!emailConfirmed) {
    return (
      <div className="loginfull-container">
        <div className="loginfull-card">
          <h2>⚠️ Confirme seu e-mail</h2>
          <p>Você precisa confirmar seu e-mail antes de concluir o cadastro.</p>
          <button onClick={() => navigate("/login")}>Voltar ao login</button>
        </div>
      </div>
    );
  }

  // 🔹 7️⃣ Render erro geral
  if (error && !session) {
    return (
      <div className="loginfull-container">
        <div className="loginfull-card">
          <h2>⚠️ Erro</h2>
          <p>{error}</p>
          <button onClick={() => navigate("/login")}>Voltar</button>
        </div>
      </div>
    );
  }

  // 🔹 8️⃣ Render formulário completo
  return (
    <div className="loginfull-container">
      <div className="loginfull-card">
        <h2>🎉 Bem-vindo ao OnBox!</h2>
        <p>Finalize seu cadastro para continuar.</p>

        <form onSubmit={handleSubmit}>
          {/* Upload de avatar */}
          <div className="avatar-upload">
            {formData.avatar_url ? (
              <img src={formData.avatar_url} alt="Avatar" className="avatar-preview" />
            ) : (
              <div className="avatar-placeholder">+</div>
            )}
            <label className="upload-btn">
              {uploading ? "Enviando..." : "Alterar foto"}
              <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} hidden />
            </label>
          </div>

          {/* Campos */}
          <div className="form-group">
            <label>Nome completo</label>
            <input type="text" value={formData.nome} onChange={e => handleChange("nome", e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Empresa</label>
            <input type="text" value={formData.empresa} onChange={e => handleChange("empresa", e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Função</label>
            <input type="text" value={formData.funcao} onChange={e => handleChange("funcao", e.target.value)} required />
          </div>

          {/* Mensagens */}
          {error && <div className="error-msg">{error}</div>}
          {success && <div className="success-msg">✅ Perfil salvo com sucesso! Redirecionando...</div>}

          <button type="submit" className="save-btn" disabled={uploading}>
            Salvar informações
          </button>
        </form>
      </div>
    </div>
  );
}
