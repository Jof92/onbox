// src/components/SetoresManager.jsx
import React, { useState, useRef, useEffect } from "react";
import { FaCamera } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./Containers.css";

export default function SetoresManager({ userId, setorId = null, onClose }) {
  const inputRef = useRef(null);

  const [name, setName] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const isEditing = !!setorId;

  const [membrosTexto, setMembrosTexto] = useState("");
  const [membrosSelecionados, setMembrosSelecionados] = useState([]);
  const [sugestoesMembros, setSugestoesMembros] = useState([]);
  const [mostrarSugestoesMembros, setMostrarSugestoesMembros] = useState(false);

  // Carregar dados atuais se for edição
  useEffect(() => {
    if (setorId) {
      const loadSetorData = async () => {
        setLoading(true);
        try {
          const { data: setorData, error: setorError } = await supabase
            .from("setores")
            .select("*")
            .eq("id", setorId)
            .single();

          if (setorError) throw setorError;
          setName(setorData.name);

          // ✅ String "photo_url" reescrita manualmente — sem caracteres ocultos
          const { data: photoData } = await supabase
            .from("setores_photos")
            .select("photo_url")
            .eq("setor_id", setorId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (photoData) {
            setPhotoPreview(photoData.photo_url);
          }

          const { data: membersData, error: membersError } = await supabase
            .from("setor_members")
            .select("user_id")
            .eq("setor_id", setorId);

          if (!membersError && membersData?.length) {
            const userIds = membersData.map(m => m.user_id);
            const { data: perfis, error: perfisError } = await supabase
              .from("profiles")
              .select("id, nickname, avatar_url")
              .in("id", userIds);

            if (!perfisError) {
              setMembrosSelecionados(perfis || []);
            }
          }
        } catch (err) {
          console.error("Erro ao carregar setor:", err);
          alert("Erro ao carregar dados do setor.");
        } finally {
          setLoading(false);
        }
      };

      loadSetorData();
    }
  }, [setorId]);

  const buscarSugestoesMembros = async (termo) => {
    if (!userId || !termo.trim()) {
      setSugestoesMembros([]);
      return;
    }

    try {
      const { data: convites, error: convitesError } = await supabase
        .from("convites")
        .select("user_id")
        .eq("remetente_id", userId)
        .eq("status", "aceito");

      if (convitesError || !convites || convites.length === 0) {
        setSugestoesMembros([]);
        return;
      }

      const userIds = convites
        .map(c => c.user_id)
        .filter(id => id != null);

      if (userIds.length === 0) {
        setSugestoesMembros([]);
        return;
      }

      const { data: perfis, error: perfisError } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds)
        .ilike("nickname", `%${termo}%`)
        .limit(5);

      if (perfisError) {
        setSugestoesMembros([]);
        return;
      }

      const filtrados = perfis.filter(p => !membrosSelecionados.some(m => m.id === p.id));
      setSugestoesMembros(filtrados);
    } catch (err) {
      console.error("Erro na busca de sugestões:", err);
      setSugestoesMembros([]);
    }
  };

  const handleMembrosChange = (e) => {
    const valor = e.target.value;
    const pos = e.target.selectionStart;
    setMembrosTexto(valor);

    const antes = valor.substring(0, pos);
    const ultimaArroba = antes.lastIndexOf("@");

    if (ultimaArroba !== -1) {
      const termo = antes.substring(ultimaArroba + 1).trim();
      if (termo) {
        setMostrarSugestoesMembros(true);
        buscarSugestoesMembros(termo);
      } else {
        setMostrarSugestoesMembros(false);
      }
    } else {
      setMostrarSugestoesMembros(false);
    }
  };

  const inserirMembro = (perfil) => {
    if (membrosSelecionados.some(m => m.id === perfil.id)) {
      setMostrarSugestoesMembros(false);
      return;
    }

    setMembrosSelecionados([...membrosSelecionados, perfil]);
    setMembrosTexto("");
    setMostrarSugestoesMembros(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removerMembro = (id) => {
    setMembrosSelecionados(membrosSelecionados.filter(m => m.id !== id));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Por favor, digite o nome do setor.");
      return;
    }
    if (!userId) {
      alert("Erro: usuário não identificado.");
      return;
    }

    setLoading(true);
    try {
      let currentSetorId = setorId;

      if (isEditing && setorId) {
        const { error: updateError } = await supabase
          .from("setores")
          .update({ name: name.trim() })
          .eq("id", setorId);

        if (updateError) throw updateError;
      } else {
        const { data: setorData, error: setorError } = await supabase
          .from("setores")
          .insert({ name: name.trim(), user_id: userId })
          .select()
          .single();

        if (setorError) throw setorError;
        currentSetorId = setorData.id;
      }

      // ✅ Upload e gerenciamento de foto — corrigido
      if (photoFile) {
        // Remover fotos antigas
        const { data: oldPhotos } = await supabase
          .from("setores_photos")
          .select("photo_url")
          .eq("setor_id", currentSetorId);

        if (oldPhotos?.length) {
          const fileNames = oldPhotos.map(p => p.photo_url.split("/").pop());
          await supabase.storage.from("setores_photos").remove(fileNames);
          await supabase.from("setores_photos").delete().eq("setor_id", currentSetorId);
        }

        const fileName = `setores/${currentSetorId}_${Date.now()}_${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("setores_photos")
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        // ✅ Obter URL pública — sem await, e com acesso correto
        const { data } = supabase.storage.from("setores_photos").getPublicUrl(fileName);
        const publicUrl = data?.publicUrl;

        if (!publicUrl) {
          throw new Error("Falha ao gerar URL pública da imagem.");
        }

        // ✅ Inserir nova URL — "photo_url" reescrito manualmente
        await supabase.from("setores_photos").insert({
          setor_id: currentSetorId,
          photo_url: publicUrl,
        });
      }

      // Atualizar membros
      await supabase.from("setor_members").delete().eq("setor_id", currentSetorId);
      if (membrosSelecionados.length > 0) {
        const membrosParaInserir = membrosSelecionados.map(m => ({
          setor_id: currentSetorId,
          user_id: m.id,
          added_by: userId,
        }));
        const { error: membrosError } = await supabase.from("setor_members").insert(membrosParaInserir);
        if (membrosError) throw membrosError;
      }

      alert(isEditing ? "Setor atualizado com sucesso!" : "Setor criado com sucesso!");
      onClose();
    } catch (err) {
      console.error("Erro ao salvar setor:", err);
      alert("Erro ao salvar o setor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay1">
      <div className="modal-content1">
        <h2>{isEditing ? "Editar Setor" : "Novo Setor"}</h2>

        <div className="project-photo-upload">
          <label htmlFor="setor-photo-input" className="photo-circle">
            {photoPreview ? (
              <img src={photoPreview} alt="Setor" />
            ) : (
              <FaCamera />
            )}
          </label>
          <input
            type="file"
            id="setor-photo-input"
            accept="image/*"
            onChange={handlePhotoChange}
            hidden
          />
        </div>

        <label>Nome do Setor</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder=""
          style={{ width: "100%", padding: "8px", marginBottom: "16px" }}
        />

        <label>Adicionar membros (digite @)</label>
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <input
            ref={inputRef}
            id="membros-input"
            type="text"
            value={membrosTexto}
            onChange={handleMembrosChange}
            placeholder="Ex: @joao, @maria"
            style={{ width: "100%", padding: "8px" }}
            autoComplete="off"
            onBlur={() => setTimeout(() => setMostrarSugestoesMembros(false), 200)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && mostrarSugestoesMembros && sugestoesMembros.length > 0) {
                e.preventDefault();
                inserirMembro(sugestoesMembros[0]);
              }
            }}
          />

          {mostrarSugestoesMembros && sugestoesMembros.length > 0 && (
            <div
              className="sugestoes-dropdown"
              style={{
                position: "absolute",
                zIndex: 1000,
                width: "100%",
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "4px",
                maxHeight: "150px",
                overflowY: "auto",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              }}
            >
              {sugestoesMembros.map((sug) => (
                <div
                  key={sug.id}
                  onClick={() => inserirMembro(sug)}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {sug.avatar_url ? (
                    <img
                      src={sug.avatar_url}
                      alt=""
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        marginRight: "8px",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        backgroundColor: "#ccc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "12px",
                        marginRight: "8px",
                      }}
                    >
                      {sug.nickname?.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  {sug.nickname}
                </div>
              ))}
            </div>
          )}
        </div>

        {membrosSelecionados.length > 0 && (
          <div style={{ marginBottom: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {membrosSelecionados.map((membro) => (
              <div key={membro.id} style={{ position: "relative", textAlign: "center" }}>
                {membro.avatar_url ? (
                  <img
                    src={membro.avatar_url}
                    alt={membro.nickname}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: "2px solid #007bff",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "#ccc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: "bold",
                      border: "2px solid #007bff",
                    }}
                  >
                    {membro.nickname?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: "10px", display: "block", marginTop: "2px" }}>
                  {membro.nickname}
                </span>
                <button
                  onClick={() => removerMembro(membro.id)}
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    background: "red",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "16px",
                    height: "16px",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="save-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? (isEditing ? "Atualizando..." : "Criando...") : (isEditing ? "Salvar Alterações" : "Criar Setor")}
          </button>
          <button className="cancel-btn" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}