// src/components/Header.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Header.css";
import "./loader.css";
import { supabase } from "../supabaseClient";
import { images } from "../config/images";
import { FaSignOutAlt, FaUserCircle, FaUserEdit } from "react-icons/fa";

export default function Header({
  onLoginClick,
  onLogout,
  session,
  profile: externalProfile,
  onProfileUpdate,
  hasOverdueToday = false,
  showGlow = true,
  onGlowDismiss,
}) {
  const navigate = useNavigate();

  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState({ error: "" });

  const [formData, setFormData] = useState({
    nome: "",
    empresa: "",
    funcao: "",
    container: "",
  });

  const [avatarUrl, setAvatarUrl] = useState("");
  const [tempPreview, setTempPreview] = useState(null);

  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (externalProfile) {
      setFormData({
        nome: externalProfile.nome || "",
        empresa: externalProfile.empresa || "",
        funcao: externalProfile.funcao || "",
        container: externalProfile.container || "",
      });
      if (externalProfile.avatar_url) {
        setAvatarUrl(externalProfile.avatar_url);
      }
    }
  }, [externalProfile]);

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!session?.user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", session.user.id)
        .single();

      if (!error && data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };
    fetchAvatar();
  }, [session]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!menuRef.current?.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (tempPreview) URL.revokeObjectURL(tempPreview);
    };
  }, [tempPreview]);

  const uploadAvatar = async (file) => {
    if (!file || !session?.user) return null;
    const ext = file.name.split(".").pop();
    const fileName = `${session.user.id}.${ext}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAvatarSelect = async (file, isFromModal = false) => {
    if (!file) return;
    if (isFromModal) {
      const url = URL.createObjectURL(file);
      setTempPreview(url);
    }

    try {
      setUploading(true);
      const publicUrl = await uploadAvatar(file);
      if (!publicUrl) return;

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", session.user.id);

      if (error) throw error;

      setAvatarUrl(publicUrl);

      if (onProfileUpdate) {
        onProfileUpdate((prev) => ({
          ...prev,
          avatar_url: publicUrl,
        }));
      }

      if (tempPreview) {
        URL.revokeObjectURL(tempPreview);
        setTempPreview(null);
      }
    } catch (err) {
      console.error("Erro no upload:", err);
      setMsg({ error: "Erro ao enviar imagem." });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e, isFromModal = false) => {
    const file = e.target.files?.[0];
    if (file) handleAvatarSelect(file, isFromModal);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout?.();
    navigate("/");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user)
      return setMsg({ error: "Usuário não autenticado." });

    try {
      const updates = {
        id: session.user.id,
        email: session.user.email,
        ...formData,
      };

      const { error } = await supabase.from("profiles").upsert([updates]);
      if (error) throw error;

      setShowEditModal(false);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setMsg({ error: "Erro ao salvar informações." });
    }
  };

  const currentAvatar = tempPreview
    ? tempPreview
    : avatarUrl
      ? `${avatarUrl}?v=${Date.now()}`
      : null;

  const perfilIncompleto =
    !externalProfile?.nome ||
    !externalProfile?.empresa ||
    !externalProfile?.funcao ||
    !externalProfile?.container;

  // Determinar classe do wrapper com base no glow ativo
  const avatarWrapperClass = `header-avatar-wrapper ${
    showGlow
      ? hasOverdueToday
        ? 'overdue-glow'
        : 'on-time-glow'
      : ''
  }`;

  // Ao clicar no avatar, abre o menu e descarta o glow (se aplicável)
  const handleAvatarClick = () => {
    setShowMenu(prev => !prev);
    if (showGlow && onGlowDismiss) {
      onGlowDismiss();
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-left" onClick={() => navigate("/")}>
          <img src={images.ob2} alt="Logo" />
        </div>

        <div className="header-right">
          {session ? (
            <div className="header-user-info" ref={menuRef}>
              <div
                className={avatarWrapperClass}
                onClick={handleAvatarClick}
              >
                {currentAvatar ? (
                  <img
                    src={currentAvatar}
                    alt="Avatar"
                    className="header-avatar"
                  />
                ) : (
                  <FaUserCircle className="header-avatar-placeholder" />
                )}
              </div>

              {perfilIncompleto && (
                <div className="perfil-warning-bubble">
                  ⚠️ Antes de iniciar, conclua seu perfil.
                </div>
              )}

              <p className="header-welcome">
                Bem-vindo, <strong>
                  {externalProfile?.nome
                    ? externalProfile.nome.split(' ').slice(0, 2).join(' ')
                    : "Usuário"}
                </strong>
              </p>

              {showMenu && (
                <div className="header-menu animate-dropdown">
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
                onChange={(e) => handleFileChange(e, false)}
              />
            </div>
          ) : (
            <button className="header-btn-login" onClick={onLoginClick}>
              Entrar
            </button>
          )}
        </div>
      </header>

      {showEditModal && (
        <div className="modal-overlay">
          <div className="loginfull-container">
            <button
              className="close-modal"
              onClick={() => {
                setShowEditModal(false);
                if (tempPreview) URL.revokeObjectURL(tempPreview);
                setTempPreview(null);
              }}
            >
              X
            </button>

            <div className="loginfull-card">
              <h2>Perfil do Usuário</h2>
              <form onSubmit={handleSubmit}>
                <div className="avatar-upload">
                  {currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt="Avatar"
                      className="avatar-preview"
                    />
                  ) : (
                    <div className="avatar-placeholder">+</div>
                  )}

                  <label className="upload-btn">
                    Alterar foto
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => handleFileChange(e, true)}
                    />
                    {uploading && <div className="loader" style={{ marginLeft: 8 }}></div>}
                  </label>
                </div>

                {["nome", "empresa", "funcao", "container"].map((field) => (
                  <div className="form-group" key={field}>
                    <label>
                      {field === "container"
                        ? "Nomeie seu container"
                        : field.charAt(0).toUpperCase() + field.slice(1)}
                    </label>
                    <input
                      type="text"
                      value={formData[field] || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, [field]: e.target.value })
                      }
                      required={field === "nome" || field === "container"}
                      placeholder={
                        field === "container"
                          ? "Ex: Projeto OnBox Principal"
                          : ""
                      }
                    />
                  </div>
                ))}

                {msg.error && <div className="error-msg">{msg.error}</div>}

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