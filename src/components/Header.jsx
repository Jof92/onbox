import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Header.css";
import { supabase } from "../supabaseClient";
import ob2 from "../assets/ob2.png";
import { FaSignOutAlt, FaCamera, FaUserCircle, FaUserEdit } from "react-icons/fa";

export default function Header({ onLoginClick, onLogout, session, profile }) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState({ error: "", success: false });
  const [formData, setFormData] = useState({
    nome: "", empresa: "", funcao: "", container: "", avatar_url: "",
  });
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (profile)
      setFormData({
        nome: profile.nome || "",
        empresa: profile.empresa || "",
        funcao: profile.funcao || "",
        container: profile.container || "",
        avatar_url: profile.avatar_url || "",
      });
  }, [profile]);

  // === Verifica se perfil está incompleto ===
  const perfilIncompleto =
    !profile?.nome || !profile?.empresa || !profile?.funcao || !profile?.container;

  // === Upload de avatar ===
  const uploadAvatar = async (file) => {
    if (!file || !session?.user) return;
    const fileName = `${session.user.id}.${file.name.split(".").pop()}`;
    const filePath = `avatars/${fileName}`;
    await supabase.storage.from("avatars").remove([filePath]);
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleFileChange = async (e, isModal = false) => {
    try {
      setUploading(true);
      const file = e.target.files[0];
      const url = await uploadAvatar(file);
      if (isModal) setFormData((f) => ({ ...f, avatar_url: url }));
      else {
        await supabase.from("profiles").update({ avatar_url: url }).eq("id", session.user.id);
        window.location.reload();
      }
    } catch {
      setMsg({ error: "Erro ao enviar imagem.", success: false });
    } finally {
      setUploading(false);
    }
  };

  // === Salvar perfil ===
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) return setMsg({ error: "Usuário não autenticado.", success: false });
    try {
      const updates = {
        id: session.user.id,
        email: session.user.email,
        nome: formData.nome.trim(),
        empresa: formData.empresa.trim(),
        funcao: formData.funcao.trim(),
        container: formData.container.trim(),
        avatar_url: formData.avatar_url || null,
      };
      const { error } = await supabase.from("profiles").upsert([updates]);
      if (error) throw error;
      setMsg({ error: "", success: true });
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      setMsg({ error: "Erro ao salvar informações.", success: false });
    }
  };

  useEffect(() => {
    const clickOutside = (e) => !menuRef.current?.contains(e.target) && setShowMenu(false);
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout?.();
    navigate("/");
  };

  return (
    <>
      <header className="header">
        <div className="header-left" onClick={() => navigate("/")}>
          <img src={ob2} alt="Logo" />
        </div>

        <div className="header-right">
          {session ? (
            <div className="header-user-info" ref={menuRef}>
              <div className="header-avatar-wrapper" onClick={() => setShowMenu(!showMenu)}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="header-avatar" />
                ) : (
                  <FaUserCircle className="header-avatar-placeholder" />
                )}
              </div>

              {/* 🟡 Balão de aviso se o perfil estiver incompleto */}
              {perfilIncompleto && (
                <div className="perfil-warning-bubble">
                  ⚠️ Antes de iniciar, conclua seu perfil.
                </div>
              )}

              <p className="header-welcome">
                Bem-vindo, <strong>{profile?.nome || "Usuário"}</strong>
              </p>

              {showMenu && (
                <div className="header-menu animate-dropdown">
                  <button onClick={() => fileInputRef.current.click()} className="header-menu-item">
                    <FaCamera /> Alterar foto
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(true);
                      setShowMenu(false);
                    }}
                    className="header-menu-item"
                  >
                    <FaUserEdit /> Editar perfil
                  </button>
                  <button onClick={handleLogout} className="header-menu-item">
                    <FaSignOutAlt /> Sair
                  </button>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                hidden
                onChange={(e) => handleFileChange(e)}
              />
            </div>
          ) : (
            <button className="header-btn-login" onClick={onLoginClick}>
              Entrar
            </button>
          )}
        </div>
      </header>

      {/* Modal de edição */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="loginfull-container">
            <button className="close-modal" onClick={() => setShowEditModal(false)}>X</button>
            <div className="loginfull-card">
              <h2>Perfil do Usuário</h2>
              <form onSubmit={handleSubmit}>
                <div className="avatar-upload">
                  {formData.avatar_url ? (
                    <img src={formData.avatar_url} alt="Avatar" className="avatar-preview" />
                  ) : (
                    <div className="avatar-placeholder">+</div>
                  )}
                  <label className="upload-btn">
                    {uploading ? "Enviando..." : "Alterar foto"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => handleFileChange(e, true)}
                    />
                  </label>
                </div>

                {["nome", "empresa", "funcao", "container"].map((f) => (
                  <div className="form-group" key={f}>
                    <label>{f === "container" ? "Nomeie seu container" : f[0].toUpperCase() + f.slice(1)}</label>
                    <input
                      type="text"
                      value={formData[f]}
                      onChange={(e) => setFormData({ ...formData, [f]: e.target.value })}
                      required={f === "nome" || f === "container"}
                      placeholder={f === "container" ? "Ex: Projeto OnBox Principal" : ""}
                    />
                  </div>
                ))}

                {msg.error && <div className="error-msg">{msg.error}</div>}
                {msg.success && <div className="success-msg">Perfil atualizado com sucesso!</div>}

                <button type="submit" className="save-btn" disabled={uploading}>
                  Salvar informações
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
