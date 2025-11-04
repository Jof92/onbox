import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Header.css";
import { supabase } from "../supabaseClient";
import ob2 from "../assets/ob2.png";
import { FaSignOutAlt, FaCamera, FaUserCircle, FaUserEdit } from "react-icons/fa";

export default function Header({ onLoginClick, onLogout, session, profile: externalProfile, onProfileUpdate }) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState({ error: "", success: false });
  const [tempPreview, setTempPreview] = useState(null); // 👈 Preview temporário (antes do upload)
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(externalProfile?.avatar_url || ""); // 👈 Avatar salvo

  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  // Atualiza avatar salvo quando externalProfile mudar (ex: login inicial)
  useEffect(() => {
    setSavedAvatarUrl(externalProfile?.avatar_url || "");
  }, [externalProfile?.avatar_url]);

  const perfilIncompleto =
    !externalProfile?.nome || !externalProfile?.empresa || !externalProfile?.funcao || !externalProfile?.container;

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

  // === Lida com upload e atualiza estado ===
  const handleAvatarSelect = async (file, isFromModal = false) => {
    if (!file) return;

    // Mostra preview imediatamente (só no modal)
    if (isFromModal) {
      const url = URL.createObjectURL(file);
      setTempPreview(url);
    }

    try {
      setUploading(true);
      const publicUrl = await uploadAvatar(file);
      if (!publicUrl) return;

      // Salva no banco
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", session.user.id);
      if (error) throw error;

      // Atualiza estado local
        setSavedAvatarUrl(publicUrl);

        // ✅ Atualiza o perfil no componente pai (App)
        if (onProfileUpdate) {
          onProfileUpdate(prev => ({
            ...prev,
            avatar_url: publicUrl
          }));
        }

        // Limpa preview temporário
        if (tempPreview) {
          URL.revokeObjectURL(tempPreview);
          setTempPreview(null);
        }

      setMsg({ error: "", success: true });
      setTimeout(() => setMsg({ error: "", success: false }), 2000);
    } catch (err) {
      console.error("Erro no upload:", err);
      setMsg({ error: "Erro ao enviar imagem.", success: false });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e, isFromModal = false) => {
    const file = e.target.files?.[0];
    if (file) handleAvatarSelect(file, isFromModal);
  };

  useEffect(() => {
    const clickOutside = (e) => !menuRef.current?.contains(e.target) && setShowMenu(false);
    document.addEventListener("mousedown", clickOutside);
    return () => {
      document.removeEventListener("mousedown", clickOutside);
      if (tempPreview) URL.revokeObjectURL(tempPreview);
    };
  }, [tempPreview]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout?.();
    navigate("/");
  };

  // === Modal de edição ===
  const [formData, setFormData] = useState({
    nome: "", empresa: "", funcao: "", container: "",
  });

  useEffect(() => {
    if (externalProfile) {
      setFormData({
        nome: externalProfile.nome || "",
        empresa: externalProfile.empresa || "",
        funcao: externalProfile.funcao || "",
        container: externalProfile.container || "",
      });
    }
  }, [externalProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) return setMsg({ error: "Usuário não autenticado.", success: false });

    try {
      const updates = {
        id: session.user.id,
        email: session.user.email,
        ...formData,
        avatar_url: savedAvatarUrl || null,
      };

      const { error } = await supabase.from("profiles").upsert([updates]);
      if (error) throw error;

      setMsg({ error: "", success: true });
      setTimeout(() => setShowEditModal(false), 1500);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setMsg({ error: "Erro ao salvar informações.", success: false });
    }
  };

  // Avatar atual: preview temporário (modal) > avatar salvo > avatar externo
  const currentAvatar = tempPreview || savedAvatarUrl;

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
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Avatar" className="header-avatar" />
                ) : (
                  <FaUserCircle className="header-avatar-placeholder" />
                )}
              </div>

              {perfilIncompleto && (
                <div className="perfil-warning-bubble">⚠️ Antes de iniciar, conclua seu perfil.</div>
              )}

              <p className="header-welcome">
                Bem-vindo, <strong>{externalProfile?.nome || "Usuário"}</strong>
              </p>

              {showMenu && (
                <div className="header-menu animate-dropdown">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowMenu(false);
                    }}
                    className="header-menu-item"
                  >
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

      {/* Modal de edição */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="loginfull-container">
            <button className="close-modal" onClick={() => {
              setShowEditModal(false);
              if (tempPreview) URL.revokeObjectURL(tempPreview);
              setTempPreview(null);
            }}>
              X
            </button>
            <div className="loginfull-card">
              <h2>Perfil do Usuário</h2>
              <form onSubmit={handleSubmit}>
                <div className="avatar-upload">
                  {currentAvatar ? (
                    <img src={currentAvatar} alt="Avatar" className="avatar-preview" />
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

                {["nome", "empresa", "funcao", "container"].map((field) => (
                  <div className="form-group" key={field}>
                    <label>
                      {field === "container" ? "Nomeie seu container" : field.charAt(0).toUpperCase() + field.slice(1)}
                    </label>
                    <input
                      type="text"
                      value={formData[field] || ""}
                      onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                      required={field === "nome" || field === "container"}
                      placeholder={field === "container" ? "Ex: Projeto OnBox Principal" : ""}
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