import React, { useState, useEffect } from "react";
import "./LoginFull.css";
import { supabase } from "../supabaseClient";

export default function LoginFull({ onClose, session }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    empresa: "",
    funcao: "",
    container: "",
    avatar_url: "",
  });

  // Buscar dados do perfil ao abrir o modal
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("nome, empresa, funcao, container, avatar_url")
          .eq("id", session.user.id)
          .single();

        if (error && error.code !== "PGRST116") throw error;

        if (data) {
          setFormData({
            nome: data.nome || "",
            empresa: data.empresa || "",
            funcao: data.funcao || "",
            container: data.container || "",
            avatar_url: data.avatar_url || "",
          });
        }
      } catch (err) {
        console.error("Erro ao buscar perfil:", err.message);
        setError("Erro ao carregar informações do perfil.");
      }
    };

    fetchProfile();
  }, [session]);

  const handleUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file || !session?.user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${session.user.id}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      await supabase.storage.from("avatars").remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData, error: urlError } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      if (urlError) throw urlError;

      setFormData((prev) => ({
        ...prev,
        avatar_url: publicData.publicUrl,
      }));
    } catch (err) {
      console.error("Erro ao enviar avatar:", err);
      setError("Erro ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) return setError("Usuário não autenticado.");

    try {
      setError("");

      const updates = {
        id: session.user.id,
        nome: formData.nome.trim(),
        empresa: formData.empresa.trim(),
        funcao: formData.funcao.trim(),
        container: formData.container.trim(),
        avatar_url: formData.avatar_url || null,
        updated_at: new Date(),
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .upsert([updates]);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      setError("Erro ao salvar informações.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="loginfull-container">
        <div className="loginfull-card">
          {onClose && (
            <button className="close-modal" onClick={onClose}>
              X
            </button>
          )}

          <h2>Perfil do Usuário</h2>

          <form onSubmit={handleSubmit}>
            <div className="avatar-upload">
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt="Avatar"
                  className="avatar-preview"
                />
              ) : (
                <div className="avatar-placeholder">+</div>
              )}
              <label className="upload-btn">
                {uploading ? "Enviando..." : "Alterar foto"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  hidden
                />
              </label>
            </div>

            <div className="form-group">
              <label>Nome completo</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => handleChange("nome", e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Empresa</label>
              <input
                type="text"
                value={formData.empresa}
                onChange={(e) => handleChange("empresa", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Função</label>
              <input
                type="text"
                value={formData.funcao}
                onChange={(e) => handleChange("funcao", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Nomeie seu container</label>
              <input
                type="text"
                value={formData.container}
                onChange={(e) => handleChange("container", e.target.value)}
                placeholder="Ex: Projeto OnBox Principal"
                required
              />
            </div>

            {error && <div className="error-msg">{error}</div>}
            {success && <div className="success-msg">Perfil atualizado com sucesso!</div>}

            <button type="submit" className="save-btn" disabled={uploading}>
              Salvar informações
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
