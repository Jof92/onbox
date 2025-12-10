// src/components/Task.jsx
import React, { useState, useEffect, useRef } from "react";
import "./Task.css";
import { FiUploadCloud, FiUser } from "react-icons/fi";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ComentariosSection from "./TaskComentarios";

export default function Task({ onClose, projetoAtual, notaAtual, containerId }) {
  const [descricao, setDescricao] = useState("");
  const [anexosSalvos, setAnexosSalvos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const modalRef = useRef(null);

  // Fechar modal ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (onClose && modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (onClose) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [onClose]);

  // Carregar usuário logado
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome, nickname, avatar_url")
          .eq("id", user.id)
          .single();
        setUserProfile(profile);
      }
    };
    fetchUser();
  }, []);

  // Carregar dados da nota (descrição e anexos)
  useEffect(() => {
    if (!notaAtual?.id) {
      setDescricao("");
      setAnexosSalvos([]);
      return;
    }

    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: nota } = await supabase
          .from("notas")
          .select("descricao")
          .eq("id", notaAtual.id)
          .single();
        if (isMounted) setDescricao(nota?.descricao || "");

        const { data: anexos } = await supabase
          .from("anexos")
          .select("id, file_name, file_url")
          .eq("nota_id", notaAtual.id)
          .order("created_at", { ascending: true });
        if (isMounted) setAnexosSalvos(anexos || []);
      } catch (err) {
        console.error("Erro ao carregar dados da nota:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [notaAtual?.id]);

  // Salvar descrição ao perder foco
  const handleSaveDescricao = async () => {
    if (!notaAtual?.id) return;
    setLoading(true);
    try {
      await supabase
        .from("notas")
        .update({ descricao: descricao || null })
        .eq("id", notaAtual.id);
    } catch (err) {
      console.error("Erro ao salvar descrição:", err);
      alert("Erro ao salvar descrição.");
    } finally {
      setLoading(false);
    }
  };

  // Adicionar anexos (via botão ou drag-and-drop)
  const handleAddAnexos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!notaAtual?.id || !userId || files.length === 0) return;

    setLoading(true);
    try {
      for (const file of files) {
        const sanitizeFileName = (name) => {
          return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_+/g, '_')
            .trim()
            .replace(/^_+|_+$/g, '');
        };

        const originalName = file.name;
        const safeName = sanitizeFileName(originalName);
        const fileName = `anexos/${notaAtual.id}_${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from("anexos").upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("anexos").getPublicUrl(fileName);
        const fileUrl = data.publicUrl;

        const { data: insertedAnexo } = await supabase
          .from("anexos")
          .insert({
            nota_id: notaAtual.id,
            user_id: userId,
            file_name: originalName,
            file_url: fileUrl,
          })
          .select()
          .single();

        setAnexosSalvos((prev) => [...prev, insertedAnexo]);
      }
    } catch (err) {
      console.error("Erro ao enviar anexo:", err);
      alert("Erro ao enviar um ou mais anexos.");
    } finally {
      setLoading(false);
    }
  };

  // Remover anexo
  const handleRemoverAnexo = async (anexoId, fileUrl) => {
    if (!window.confirm("Deseja realmente excluir este anexo?")) return;
    setLoading(true);
    try {
      const url = new URL(fileUrl);
      const fileName = url.pathname.split("/").pop();
      await supabase.storage.from("anexos").remove([fileName]);
      await supabase.from("anexos").delete().eq("id", anexoId).eq("user_id", userId);
      setAnexosSalvos((prev) => prev.filter((a) => a.id !== anexoId));
    } catch (err) {
      console.error("Erro ao excluir anexo:", err);
      alert("Erro ao excluir anexo.");
    } finally {
      setLoading(false);
    }
  };

  const getNomeProjeto = () => projetoAtual?.nome || projetoAtual?.name || "Sem projeto";
  const getNomeNota = () => notaAtual?.nome || notaAtual?.name || "Sem nota";

  // Estado de loading inicial
  if (loading) {
    return (
      <div className="task-modal" ref={modalRef}>
        <div className="task-loading-container">
          <Loading size={200} />
        </div>
      </div>
    );
  }

  return (
    <div className="task-modal" ref={modalRef}>
      <div className="task-header">
        <div className="task-header-titles">
          <span className="project-name">{getNomeProjeto()}</span>
          <div className="sub-info">
            <span className="nota-name">{getNomeNota()}</span>
          </div>
        </div>
        {onClose && (
          <button
            className="listagem-close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <FaTimes />
          </button>
        )}
      </div>

      <h2 className="task-title">{getNomeNota()}</h2>

      {/* Seção de Descrição */}
      <div className="descricao-section">
        <h3>Descrição</h3>
        <textarea
          className="descricao-editor-textarea"
          value={descricao}
          onChange={(e) => {
            setDescricao(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={handleSaveDescricao}
          placeholder="Clique aqui para adicionar uma descrição..."
          rows={3}
          style={{
            minHeight: "3.25em",
            height: "8em",
            resize: "none",
          }}
          disabled={loading}
        />
      </div>

      {/* ✅ Seção de Anexos com drag-and-drop e dois botões */}
      <div
        className="anexos-section"
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('drag-over');
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('drag-over');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('drag-over');
          const files = Array.from(e.dataTransfer.files || []);
          if (files.length > 0) {
            // Simulamos um evento compatível com handleAddAnexos
            const fakeEvent = { target: { files } };
            handleAddAnexos(fakeEvent);
          }
        }}
      >
        <div className="anexos-header">
            <div className="anexos-botoes">
              
            {/* Botão Anexo */}
            <label htmlFor="fileInputAnexo" className="upload-btn checklist-btn">
              <span >Anexo</span>
            </label>
            <input
              type="file"
              id="fileInputAnexo"
              hidden
              multiple
              onChange={handleAddAnexos}
              disabled={loading}
            />

            {/* Botão Checklist (novo) */}
            <button
              type="button"
              className="upload-btn checklist-btn"
              onClick={() => {
                alert("Funcionalidade de checklist em desenvolvimento.");
                // Aqui você implementará a criação de checklist vinculado à nota
              }}
              disabled={loading}
              title="Criar checklist"
            >
              <span>Checklist</span>
            </button>
          </div>
        </div>

        {/* Lista de anexos já salvos */}
        <div className="anexos-lista">
          {anexosSalvos.map((anexo) => (
            <div key={anexo.id} className="anexo-item">
              <a href={anexo.file_url} target="_blank" rel="noopener noreferrer">
                {anexo.file_name}
              </a>
              <button
                type="button"
                title="Remover"
                onClick={() => handleRemoverAnexo(anexo.id, anexo.file_url)}
                aria-label="Remover anexo"
                disabled={loading}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Dica visual para drag-and-drop */}
        <div className="drag-hint">
          Arraste arquivos aqui para anexar
        </div>
      </div>

      {/* Seção de Comentários */}
      {notaAtual?.id && userId && userProfile && (
        <ComentariosSection
          notaId={notaAtual.id}
          userId={userId}
          userProfile={userProfile}
          projetoAtual={projetoAtual}
          containerId={containerId}
          supabaseClient={supabase}
        />
      )}
    </div>
  );
}