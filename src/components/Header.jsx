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

  const [showMenu, setShowMenu]         = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [msg, setMsg]                   = useState({ error: "" });

  const [formData, setFormData] = useState({
    nome: "", empresa: "", funcao: "", container: "",
  });

  const [avatarUrl, setAvatarUrl]     = useState("");
  const [tempPreview, setTempPreview] = useState(null);

  const menuRef     = useRef(null);
  const fileInputRef = useRef(null);

  // ─── Crop state ────────────────────────────────────────────────────────────
  const [cropSrc, setCropSrc]       = useState(null);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropScale, setCropScale]   = useState(1);
  const cropImgRef                  = useRef(null);
  const CROP_SIZE                   = 260;

  // Abre o crop ao selecionar arquivo
  const abrirCrop = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
      setCropScale(scale);
      setCropOffset({
        x: (CROP_SIZE - img.width  * scale) / 2,
        y: (CROP_SIZE - img.height * scale) / 2,
      });
      cropImgRef.current = img;
      setCropSrc(url);
    };
    img.src = url;
  };

  const clampOffset = (nx, ny, sc) => {
    const img = cropImgRef.current;
    if (!img) return { x: nx, y: ny };
    const iw = img.width * sc, ih = img.height * sc;
    return {
      x: Math.max(Math.min(0, CROP_SIZE - iw), Math.min(Math.max(0, CROP_SIZE - iw), nx)),
      y: Math.max(Math.min(0, CROP_SIZE - ih), Math.min(Math.max(0, CROP_SIZE - ih), ny)),
    };
  };

  const handleCropMouseDown = (e) => {
    e.preventDefault();
    const start = { mx: e.clientX, my: e.clientY, ox: cropOffset.x, oy: cropOffset.y };
    const onMove = (ev) =>
      setCropOffset(clampOffset(start.ox + ev.clientX - start.mx, start.oy + ev.clientY - start.my, cropScale));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleCropTouchStart = (e) => {
    const t0 = e.touches[0];
    const start = { mx: t0.clientX, my: t0.clientY, ox: cropOffset.x, oy: cropOffset.y };
    const onMove = (ev) => {
      const tc = ev.touches[0];
      setCropOffset(clampOffset(start.ox + tc.clientX - start.mx, start.oy + tc.clientY - start.my, cropScale));
    };
    const onEnd = () => { window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  };

  const handleCropZoom = (e) => {
    const ns = parseFloat(e.target.value);
    setCropOffset(prev => clampOffset(prev.x, prev.y, ns));
    setCropScale(ns);
  };

  // Confirma crop → gera Blob → faz upload direto
  const confirmarCrop = async () => {
    const img = cropImgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = CROP_SIZE; canvas.height = CROP_SIZE;
    canvas.getContext("2d").drawImage(img, cropOffset.x, cropOffset.y, img.width * cropScale, img.height * cropScale);
    canvas.toBlob(async (blob) => {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      setCropSrc(null);
      await handleAvatarSelect(file, true);
    }, "image/jpeg", 0.92);
  };

  // ─── Profile & avatar ──────────────────────────────────────────────────────
  useEffect(() => {
    if (externalProfile) {
      setFormData({
        nome:      externalProfile.nome      || "",
        empresa:   externalProfile.empresa   || "",
        funcao:    externalProfile.funcao    || "",
        container: externalProfile.container || "",
      });
      if (externalProfile.avatar_url) setAvatarUrl(externalProfile.avatar_url);
    }
  }, [externalProfile]);

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!session?.user) return;
      const { data, error } = await supabase
        .from("profiles").select("avatar_url").eq("id", session.user.id).single();
      if (!error && data?.avatar_url) setAvatarUrl(data.avatar_url);
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
    const ext      = file.name.split(".").pop();
    const fileName = `${session.user.id}.${ext}`;
    const filePath = `avatars/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars").upload(filePath, file, { upsert: true });
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
        .from("profiles").update({ avatar_url: publicUrl }).eq("id", session.user.id);
      if (error) throw error;
      setAvatarUrl(publicUrl);
      if (onProfileUpdate) onProfileUpdate((prev) => ({ ...prev, avatar_url: publicUrl }));
      if (tempPreview) { URL.revokeObjectURL(tempPreview); setTempPreview(null); }
    } catch (err) {
      console.error("Erro no upload:", err);
      setMsg({ error: "Erro ao enviar imagem." });
    } finally {
      setUploading(false);
    }
  };

  // Intercepta a seleção de arquivo para abrir crop ao invés de enviar direto
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) abrirCrop(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (e.target !== fileInputRef.current) e.target.value = "";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout?.();
    navigate("/");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) return setMsg({ error: "Usuário não autenticado." });
    try {
      const { error } = await supabase.from("profiles").upsert([{
        id: session.user.id, email: session.user.email, ...formData,
      }]);
      if (error) throw error;
      setShowEditModal(false);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setMsg({ error: "Erro ao salvar informações." });
    }
  };

  const currentAvatar = tempPreview
    ? tempPreview
    : avatarUrl ? `${avatarUrl}?v=${Date.now()}` : null;

  const perfilIncompleto = !externalProfile?.nome || !externalProfile?.empresa ||
    !externalProfile?.funcao || !externalProfile?.container;

  const avatarWrapperClass = `header-avatar-wrapper ${
    showGlow ? (hasOverdueToday ? "overdue-glow" : "on-time-glow") : ""
  }`;

  const handleAvatarClick = () => {
    setShowMenu(prev => !prev);
    if (showGlow && onGlowDismiss) onGlowDismiss();
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
              <div className={avatarWrapperClass} onClick={handleAvatarClick}>
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Avatar" className="header-avatar" />
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
                    ? externalProfile.nome.split(" ").slice(0, 2).join(" ")
                    : "Usuário"}
                </strong>
              </p>

              {showMenu && (
                <div className="header-menu animate-dropdown">
                  <button onClick={() => { setShowEditModal(true); setShowMenu(false); }} className="header-menu-item">
                    <FaUserEdit /> Editar perfil
                  </button>
                  <button onClick={handleLogout} className="header-menu-item">
                    <FaSignOutAlt /> Sair
                  </button>
                </div>
              )}

              <input type="file" ref={fileInputRef} accept="image/*" hidden onChange={handleFileChange} />
            </div>
          ) : (
            <button className="header-btn-login" onClick={onLoginClick}>Entrar</button>
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
                setCropSrc(null);
                if (tempPreview) { URL.revokeObjectURL(tempPreview); setTempPreview(null); }
              }}
            >
              X
            </button>

            <div className="loginfull-card">
              <h2>Perfil do Usuário</h2>
              <form onSubmit={handleSubmit}>

                {/* ── Avatar com Crop ── */}
                <div className="avatar-upload">
                  {cropSrc ? (
                    /* ── Crop UI ── */
                    <div className="hd-crop-container">
                      <div
                        className="hd-crop-viewport"
                        style={{ width: CROP_SIZE, height: CROP_SIZE }}
                        onMouseDown={handleCropMouseDown}
                        onTouchStart={handleCropTouchStart}
                      >
                        <div className="hd-crop-grid" />
                        <img
                          src={cropSrc}
                          alt=""
                          draggable={false}
                          style={{
                            position: "absolute",
                            left:   cropOffset.x,
                            top:    cropOffset.y,
                            width:  cropImgRef.current ? cropImgRef.current.width  * cropScale : "auto",
                            height: cropImgRef.current ? cropImgRef.current.height * cropScale : "auto",
                            userSelect: "none",
                            pointerEvents: "none",
                          }}
                        />
                        <div className="hd-crop-mask" />
                      </div>

                      {/* Zoom */}
                      <div className="hd-crop-zoom-row">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        <input
                          type="range"
                          className="hd-crop-slider"
                          min={Math.max(0.2, CROP_SIZE / Math.max(cropImgRef.current?.width || 1, cropImgRef.current?.height || 1))}
                          max={4}
                          step={0.01}
                          value={cropScale}
                          onChange={handleCropZoom}
                        />
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                      </div>

                      <p className="hd-crop-hint">Arraste para reposicionar · deslize para zoom</p>

                      <div className="hd-crop-actions">
                        <button
                          type="button"
                          className="hd-crop-btn hd-crop-btn--cancel"
                          onClick={() => { setCropSrc(null); }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="hd-crop-btn hd-crop-btn--confirm"
                          disabled={uploading}
                          onClick={confirmarCrop}
                        >
                          {uploading ? "Enviando..." : "Confirmar foto"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Preview normal ── */
                    <>
                      {currentAvatar ? (
                        <img src={currentAvatar} alt="Avatar" className="avatar-preview" />
                      ) : (
                        <div className="avatar-placeholder">+</div>
                      )}
                      <label className="upload-btn">
                        {uploading ? "Enviando..." : "Alterar foto"}
                        <input type="file" accept="image/*" hidden onChange={handleFileChange} />
                        {uploading && <div className="loader" style={{ marginLeft: 8 }}></div>}
                      </label>
                    </>
                  )}
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
                      onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                      required={field === "nome" || field === "container"}
                      placeholder={field === "container" ? "Ex: Projeto OnBox Principal" : ""}
                    />
                  </div>
                ))}

                {msg.error && <div className="error-msg">{msg.error}</div>}

                <button type="submit" className="save-btn" disabled={uploading || !!cropSrc}>
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