// src/components/SetoresManager.jsx
import React, { useState } from "react";
import { FaCamera } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./Containers.css";

export default function SetoresManager({ userId, onClose }) {
  const [name, setName] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);

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
      // 1. Criar o setor
      const { data: setorData, error: setorError } = await supabase
        .from("setores")
        .insert({ name: name.trim(), user_id: userId })
        .select()
        .single();

      if (setorError) throw setorError;

      // 2. Se houver foto, fazer upload no bucket CORRETO: "setores_photos"
      if (photoFile) {
        const fileName = `setores/${setorData.id}_${Date.now()}_${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("setores_photos") // ✅ Bucket correto
          .upload(fileName, photoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("setores_photos").getPublicUrl(fileName);
        // 3. Salvar URL na tabela setores_photos
        await supabase.from("setores_photos").insert({
          setor_id: setorData.id,
          photo_url: urlData.publicUrl,
        });
      }

      alert("Setor criado com sucesso!");
      onClose();
    } catch (err) {
      console.error("Erro ao criar setor:", err);
      alert("Erro ao salvar o setor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay1">
      <div className="modal-content1">
        <h2>Novo Setor</h2>

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

        <div className="modal-actions">
          <button className="save-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? "Criando..." : "Criar Setor"}
          </button>
          <button className="cancel-btn" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}