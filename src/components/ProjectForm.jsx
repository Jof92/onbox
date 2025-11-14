// src/components/ProjectForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { FaPlus, FaTrash, FaCamera } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./Containers.css";

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

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    type: initialData?.type || "vertical",
    pavimentos: initialData?.pavimentos || [],
    eap: initialData?.eap || [],
    photoFile: null,
    photoUrl: initialData?.photoUrl || null,
    membrosTexto: initialData?.membrosTexto || "",
    membrosSelecionados: initialData?.membrosSelecionados || [],
  });

  const [sugestoesMembros, setSugestoesMembros] = useState([]);
  const [mostrarSugestoesMembros, setMostrarSugestoesMembros] = useState(false);

  // Atualiza estado quando initialData muda (ex: ao editar)
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        name: initialData.name || "",
        type: initialData.type || "vertical",
        pavimentos: initialData.pavimentos || [],
        eap: initialData.eap || [],
        photoFile: null,
        photoUrl: initialData.photoUrl || null,
        membrosTexto: initialData.membrosTexto || "",
        membrosSelecionados: initialData.membrosSelecionados || [],
      });
    } else if (isOpen && !isEditing) {
      // Novo projeto
      setFormData({
        name: "",
        type: "vertical",
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

  const buscarSugestoesMembros = async (termo) => {
  if (!termo.trim() || !containerAtual) {
    setSugestoesMembros([]);
    return;
  }

  try {
    // Busca convites ACEITOS enviados PELO containerAtual (remetente_id = containerAtual)
    const { data: convites } = await supabase
      .from("convites")
      .select("user_id") // 👈 Queremos os IDs dos membros (user_id)
      .eq("remetente_id", containerAtual) // 👈 Quem enviou é o dono do container
      .eq("status", "aceito");

    if (!convites?.length) {
      setSugestoesMembros([]);
      return;
    }

    const userIds = convites.map((c) => c.user_id).filter(Boolean); // remove nulls

    if (userIds.length === 0) {
      setSugestoesMembros([]);
      return;
    }

    // Busca perfis desses membros
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url")
      .in("id", userIds)
      .ilike("nickname", `%${termo}%`)
      .limit(5);

    setSugestoesMembros(perfis || []);
  } catch (err) {
    console.error("Erro ao buscar sugestões:", err);
    setSugestoesMembros([]);
  }
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

  // ✅ Função atualizada: limpa o input ao selecionar um membro
  const inserirMembro = (perfil) => {
    // Evita duplicatas
    if (formData.membrosSelecionados.some((m) => m.id === perfil.id)) {
      setMostrarSugestoesMembros(false);
      return;
    }

    const novoMembrosSelecionados = [
      ...formData.membrosSelecionados,
      { id: perfil.id, nickname: perfil.nickname, avatar_url: perfil.avatar_url },
    ];

    setFormData((prev) => ({
      ...prev,
      membrosTexto: "", // ✅ Limpa o campo de texto
      membrosSelecionados: novoMembrosSelecionados,
    }));

    setMostrarSugestoesMembros(false);

    // Devolve o foco para o input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
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
      type: formData.type,
      pavimentos: formData.pavimentos,
      eap: formData.eap,
      photoFile: formData.photoFile,
      photoUrl: formData.photoUrl,
      membrosSelecionados: formData.membrosSelecionados,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay1" onClick={onClose}>
      <div
        className="modal-content1"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        <h2>{isEditing ? "Editar Projeto" : "Novo Projeto"}</h2>

        {/* Foto */}
        <div className="project-photo-upload">
          <label htmlFor="photo-upload" className="photo-circle">
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
        <label>Nome do Projeto</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Ex: Torre Central"
        />

        {/* Membros */}
        <label>Adicionar membros (digite @)</label>
        <div style={{ position: "relative" }}>
          <input
            ref={inputRef}
            id="membros-input"
            type="text"
            value={formData.membrosTexto}
            onChange={handleMembrosChange}
            placeholder="Ex: @joao, @maria"
            style={{ width: "100%", padding: "8px", marginTop: "4px" }}
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
                  onMouseDown={(e) => e.preventDefault()} // previne blur do input
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

        {/* Avatares dos membros selecionados */}
        {formData.membrosSelecionados.length > 0 && (
          <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {formData.membrosSelecionados.map((membro) => (
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
              </div>
            ))}
          </div>
        )}

        {/* Tipo */}
        <label>Tipo de Projeto</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
        >
          <option value="vertical">Edificação Vertical</option>
          <option value="horizontal">Edificação Horizontal</option>
        </select>

        {/* Pavimentos */}
        {formData.type === "vertical" && (
          <div>
            <div className="list-header">
              Pavimentos{" "}
              <FaPlus
                className="add-icon"
                onClick={() => adicionarItem(formData.pavimentos, (v) => setFormData((prev) => ({ ...prev, pavimentos: v })))}
              />
            </div>
            <div className="list-container">
              {formData.pavimentos.map((p, i) => (
                <div key={i} className="list-item">
                  <input
                    type="text"
                    placeholder={`Pavimento ${i + 1}`}
                    value={p}
                    onChange={(e) => atualizarItem(formData.pavimentos, (v) => setFormData((prev) => ({ ...prev, pavimentos: v })), i, e.target.value)}
                  />
                  <FaTrash
                    className="delete-icon"
                    onClick={() => removerItem(formData.pavimentos, (v) => setFormData((prev) => ({ ...prev, pavimentos: v })), i)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EAP */}
        <div className="list-header">
          EAP{" "}
          <FaPlus
            className="add-icon"
            onClick={() => adicionarItem(formData.eap, (v) => setFormData((prev) => ({ ...prev, eap: v })))}
          />
        </div>
        <div className="list-container">
          {formData.eap.map((e, i) => (
            <div key={i} className="list-item">
              <input
                type="text"
                placeholder={`EAP ${i + 1}`}
                value={e}
                onChange={(ev) => atualizarItem(formData.eap, (v) => setFormData((prev) => ({ ...prev, eap: v })), i, ev.target.value)}
              />
              <FaTrash
                className="delete-icon"
                onClick={() => removerItem(formData.eap, (v) => setFormData((prev) => ({ ...prev, eap: v })), i)}
              />
            </div>
          ))}
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