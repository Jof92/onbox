import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Header.css";
import ob2 from "../assets/ob2.png";
import { supabase } from "../supabaseClient";
import { FaSignOutAlt, FaCamera, FaUserCircle } from "react-icons/fa";

export default function Header({ onLoginClick, onLogout, session }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  // === Buscar perfil do usuário ===
  useEffect(() => {
    async function fetchProfile() {
      if (!session?.user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .eq("id", session.user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        console.error("Erro ao buscar perfil:", error.message);
      }
    }

    fetchProfile();
  }, [session]);

  // === Upload e atualização do avatar ===
  async function handleFileChange(e) {
    try {
      const file = e.target.files[0];
      if (!file || !session?.user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${session.user.id}.${fileExt}`;
      const filePath = fileName; // simples e direto

      // Upload no bucket "avatars"
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obter URL pública do arquivo
      const { data: publicData, error: urlError } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      if (urlError) throw urlError;

      const publicUrl = publicData.publicUrl;

      // Atualizar a tabela profiles
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", session.user.id)
        .select();

      if (updateError) throw updateError;

      // Atualizar o estado local
      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
      setShowMenu(false);
    } catch (error) {
      console.error("Erro ao atualizar avatar:", error.message);
    }
  }

  // === Fechar menu ao clicar fora ===
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // === Logout ===
  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    setShowMenu(false);
    if (onLogout) onLogout();
    navigate("/");
  }

  return (
    <header className="header">
      {/* Logo */}
      <div className="header-left" onClick={() => navigate("/")}>
        <img src={ob2} alt="Logo" />
      </div>

      {/* Área do usuário */}
      <div className="header-right">
        {session ? (
          <div className="header-user-info" ref={menuRef}>
            {/* Avatar */}
            <div
              className="header-avatar-wrapper"
              onClick={() => setShowMenu((prev) => !prev)}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="header-avatar"
                />
              ) : (
                <FaUserCircle className="header-avatar-placeholder" />
              )}
            </div>

            {/* Nome e saudação */}
            <div className="header-user-text">
              <p className="header-welcome">
                Bem-vindo, <strong>{profile?.nome || "Usuário"}</strong>
              </p>
            </div>

            {/* Menu suspenso */}
            {showMenu && (
              <div
                className={`header-menu ${showMenu ? "animate-dropdown" : ""}`}
              >
                <button
                  className="header-menu-item"
                  onClick={() => fileInputRef.current.click()}
                >
                  <FaCamera /> Editar foto
                </button>

                <button className="header-menu-item" onClick={handleLogout}>
                  <FaSignOutAlt /> Sair
                </button>
              </div>
            )}

            {/* Input de upload invisível */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <button className="header-btn-login" onClick={onLoginClick}>
            Entrar
          </button>
        )}
      </div>
    </header>
  );
}
