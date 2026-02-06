// src/components/ProjectForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { FaPlus, FaTrash, FaCamera } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./ProjectForm.css";

export default function ProjectForm({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  containerAtual,
  profile,
  isEditing = false,
}) {
  const inputRef = useRef(null);
  const engenheiroInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    engenheiroResponsavel: null,
    engenheiroTexto: "",
    dataInicio: "",
    dataFinalizacao: "",
    pavimentos: [],
    eap: [],
    photoFile: null,
    photoUrl: null,
    membrosTexto: "",
    membrosSelecionados: [],
  });

  const [sugestoesMembros, setSugestoesMembros] = useState([]);
  const [mostrarSugestoesMembros, setMostrarSugestoesMembros] = useState(false);

  const [sugestoesEngenheiro, setSugestoesEngenheiro] = useState([]);
  const [mostrarSugestoesEngenheiro, setMostrarSugestoesEngenheiro] = useState(false);

  // Função reutilizável para buscar membros do container com convite aceito
  const buscarMembrosDoContainer = async (termo) => {
    if (!termo.trim() || !containerAtual) return [];

    try {
      const { data: convites } = await supabase
        .from("convites")
        .select("user_id")
        .eq("remetente_id", containerAtual)
        .eq("status", "aceito");

      const userIds = convites?.map((c) => c.user_id).filter(Boolean) || [];
      if (userIds.length === 0) return [];

      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds)
        .ilike("nickname", `%${termo}%`)
        .limit(5);

      return perfis || [];
    } catch (err) {
      console.error("Erro ao buscar membros do container:", err);
      return [];
    }
  };

  // Atualiza estado quando o modal abre ou initialData muda
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        name: initialData.name || "",
        engenheiroResponsavel: initialData.engenheiroResponsavel || null,
        engenheiroTexto: initialData.engenheiroResponsavel
          ? `@${initialData.engenheiroResponsavel.nickname}`
          : "",
        dataInicio: initialData.dataInicio || "",
        dataFinalizacao: initialData.dataFinalizacao || "",
        pavimentos: initialData.pavimentos || [],
        eap: initialData.eap || [],
        photoFile: null,
        photoUrl: initialData.photoUrl || null,
        membrosTexto: "",
        membrosSelecionados: initialData.membrosSelecionados || [],
      });
    } else if (isOpen && !isEditing) {
      setFormData({
        name: "",
        engenheiroResponsavel: null,
        engenheiroTexto: "",
        dataInicio: "",
        dataFinalizacao: "",
        pavimentos: [],
        eap: [],
        photoFile: null,
        photoUrl: null,
        membrosTexto: "",
        membrosSelecionados: [],
      });
    }
  }, [isOpen, initialData, isEditing]);

  // Focar input ao abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const adicionarItem = (lista, setLista) => {
    setLista([...lista, ""]);
  };

  const atualizarItem = (lista, setLista, index, valor) => {
    const novaLista = [...lista];
    novaLista[index] = valor;
    setLista(novaLista);
  };

  const removerItem = (lista, setLista, index) => {
    const novaLista = lista.filter((_, i) => i !== index);
    setLista(novaLista);
  };

  // === Membros ===
  const buscarSugestoesMembros = async (termo) => {
    const resultados = await buscarMembrosDoContainer(termo);
    setSugestoesMembros(resultados);
  };

  const handleMembrosChange = (e) => {
    const valor = e.target.value;
    const pos = e.target.selectionStart;
    setFormData((prev) => ({ ...prev, membrosTexto: valor }));

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
    if (formData.membrosSelecionados.some((m) => m.id === perfil.id)) {
      setMostrarSugestoesMembros(false);
      setFormData((prev) => ({ ...prev, membrosTexto: "" }));
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    const novoMembrosSelecionados = [
      ...formData.membrosSelecionados,
      { id: perfil.id, nickname: perfil.nickname, avatar_url: perfil.avatar_url },
    ];

    setFormData((prev) => ({
      ...prev,
      membrosTexto: "",
      membrosSelecionados: novoMembrosSelecionados,
    }));

    setMostrarSugestoesMembros(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ✅ Função para remover membro
  const removerMembro = (membroId) => {
    setFormData((prev) => ({
      ...prev,
      membrosSelecionados: prev.membrosSelecionados.filter((m) => m.id !== membroId),
    }));
  };

  // === Engenheiro ===
  const buscarSugestoesEngenheiro = async (termo) => {
    const resultados = await buscarMembrosDoContainer(termo);
    setSugestoesEngenheiro(resultados);
  };

  const handleEngenheiroChange = (e) => {
    const valor = e.target.value;
    setFormData((prev) => ({
      ...prev,
      engenheiroTexto: valor,
      engenheiroResponsavel: null,
    }));

    const pos = e.target.selectionStart;
    const antes = valor.substring(0, pos);
    const ultimaArroba = antes.lastIndexOf("@");
    if (ultimaArroba !== -1) {
      const termo = antes.substring(ultimaArroba + 1).trim();
      if (termo) {
        setMostrarSugestoesEngenheiro(true);
        buscarSugestoesEngenheiro(termo);
      } else {
        setMostrarSugestoesEngenheiro(false);
      }
    } else {
      setMostrarSugestoesEngenheiro(false);
    }
  };

  const inserirEngenheiro = (perfil) => {
    setFormData((prev) => ({
      ...prev,
      engenheiroResponsavel: perfil,
      engenheiroTexto: `@${perfil.nickname}`,
    }));
    setMostrarSugestoesEngenheiro(false);
  };

  const removerEngenheiro = () => {
    setFormData((prev) => ({
      ...prev,
      engenheiroResponsavel: null,
      engenheiroTexto: "",
    }));
    setTimeout(() => engenheiroInputRef.current?.focus(), 0);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        photoFile: file,
        photoUrl: URL.createObjectURL(file),
      }));
    }
  };

  const handleSubmit = () => {
    onSave({
      name: formData.name,
      engenheiroResponsavel: formData.engenheiroResponsavel,
      dataInicio: formData.dataInicio,
      dataFinalizacao: formData.dataFinalizacao,
      pavimentos: formData.pavimentos,
      eap: formData.eap,
      photoFile: formData.photoFile,
      photoUrl: formData.photoUrl,
      membrosSelecionados: formData.membrosSelecionados,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="project-modal-overlay" onClick={onClose}>
      <div className="project-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{isEditing ? "EDITAR PROJETO" : "Novo Projeto"}</h2>

        {/* Foto */}
        <div className="project-photo-upload">
          <label htmlFor="photo-upload" className="project-photo-circle">
            {formData.photoUrl ? (
              <img src={formData.photoUrl} alt="Foto do projeto" />
            ) : (
              <FaCamera />
            )}
          </label>
          <input
            type="file"
            id="photo-upload"
            accept="image/*"
            onChange={handlePhotoChange}
            hidden
          />
        </div>

        {/* Nome */}
        <div className="form-group">
          <label>Nome do Projeto</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder=""
          />
        </div>

        {/* Engenheiro + Avatar lado a lado */}
        <div className="form-group">
          <label>Engenheiro Responsável</label>
          <div className="engineer-row">
            <div className="engineer-input-wrapper">
              <input
                ref={engenheiroInputRef}
                type="text"
                value={formData.engenheiroTexto}
                onChange={handleEngenheiroChange}
                placeholder="Digite @ para mencionar"
                autoComplete="off"
                onBlur={() => setTimeout(() => setMostrarSugestoesEngenheiro(false), 200)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && mostrarSugestoesEngenheiro && sugestoesEngenheiro.length > 0) {
                    e.preventDefault();
                    inserirEngenheiro(sugestoesEngenheiro[0]);
                  }
                }}
              />
              {mostrarSugestoesEngenheiro && sugestoesEngenheiro.length > 0 && (
                <div className="suggestions-dropdown">
                  {sugestoesEngenheiro.map((sug) => (
                    <div
                      key={sug.id}
                      onClick={() => inserirEngenheiro(sug)}
                      onMouseDown={(e) => e.preventDefault()}
                      className="suggestion-item"
                    >
                      {sug.avatar_url ? (
                        <img src={sug.avatar_url} alt="" />
                      ) : (
                        <div className="suggestion-avatar-placeholder">
                          {sug.nickname?.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                      {sug.nickname}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formData.engenheiroResponsavel && (
              <div className="engineer-avatar-container">
                {formData.engenheiroResponsavel.avatar_url ? (
                  <img
                    src={formData.engenheiroResponsavel.avatar_url}
                    alt={formData.engenheiroResponsavel.nickname}
                  />
                ) : (
                  <div className="engineer-avatar-placeholder">
                    {formData.engenheiroResponsavel.nickname?.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  className="remove-engineer-btn"
                  onClick={removerEngenheiro}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Datas lado a lado */}
        <div className="form-row">
          <div className="form-group">
            <label>Data de Início</label>
            <input
              type="date"
              value={formData.dataInicio}
              onChange={(e) => setFormData((prev) => ({ ...prev, dataInicio: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Data de Finalização</label>
            <input
              type="date"
              value={formData.dataFinalizacao}
              onChange={(e) => setFormData((prev) => ({ ...prev, dataFinalizacao: e.target.value }))}
            />
          </div>
        </div>

        {/* Membros */}
        <div className="form-group">
          <label>Adicionar membros (digite @)</label>
          <div className="members-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={formData.membrosTexto}
              onChange={handleMembrosChange} 
              placeholder=""
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
              <div className="suggestions-dropdown">
                {sugestoesMembros.map((sug) => (
                  <div
                    key={sug.id}
                    onClick={() => inserirMembro(sug)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="suggestion-item"
                  >
                    {sug.avatar_url ? (
                      <img src={sug.avatar_url} alt="" />
                    ) : (
                      <div className="suggestion-avatar-placeholder">
                        {sug.nickname?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    {sug.nickname}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Avatares dos membros - centralizados com botão X */}
          {formData.membrosSelecionados.length > 0 && (
            <div className="selected-members">
              {formData.membrosSelecionados.map((membro) => (
                <div key={membro.id} className="member-avatar-item">
                  {membro.avatar_url ? (
                    <img src={membro.avatar_url} alt={membro.nickname} />
                  ) : (
                    <div className="member-avatar-placeholder">
                      {membro.nickname?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{membro.nickname}</span>
                  {/* ✅ Botão de remover membro */}
                  <button
                    type="button"
                    className="remove-member-btn"
                    onClick={() => removerMembro(membro.id)}
                    title={`Remover ${membro.nickname}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pavimentos e EAP lado a lado */}
        <div className="form-row">
          <div className="form-group">
            <div className="list-header">
              Pavimentos{" "}
              <FaPlus
                className="add-icon"
                onClick={() =>
                  adicionarItem(formData.pavimentos, (v) =>
                    setFormData((prev) => ({ ...prev, pavimentos: v }))
                  )
                }
              />
            </div>
            <div className="list-container">
              {formData.pavimentos.map((p, i) => (
                <div key={i} className="list-item">
                  <input
                    type="text"
                    placeholder={`Pavimento ${i + 1}`}
                    value={p}
                    onChange={(e) =>
                      atualizarItem(
                        formData.pavimentos,
                        (v) => setFormData((prev) => ({ ...prev, pavimentos: v })),
                        i,
                        e.target.value
                      )
                    }
                  />
                  <FaTrash
                    className="delete-icon"
                    onClick={() =>
                      removerItem(
                        formData.pavimentos,
                        (v) => setFormData((prev) => ({ ...prev, pavimentos: v })),
                        i
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="list-header">
              EAP{" "}
              <FaPlus
                className="add-icon"
                onClick={() =>
                  adicionarItem(formData.eap, (v) => setFormData((prev) => ({ ...prev, eap: v })))
                }
              />
            </div>
            <div className="list-container">
              {formData.eap.map((e, i) => (
                <div key={i} className="list-item">
                  <input
                    type="text"
                    placeholder={`EAP ${i + 1}`}
                    value={e}
                    onChange={(ev) =>
                      atualizarItem(
                        formData.eap,
                        (v) => setFormData((prev) => ({ ...prev, eap: v })),
                        i,
                        ev.target.value
                      )
                    }
                  />
                  <FaTrash
                    className="delete-icon"
                    onClick={() =>
                      removerItem(formData.eap, (v) => setFormData((prev) => ({ ...prev, eap: v })), i)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="modal-actions">
          <button className="save-btn" onClick={handleSubmit}>
            Salvar
          </button>
          <button className="cancel-btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}