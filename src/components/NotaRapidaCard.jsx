// src/components/NotaRapidaCard.jsx
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaImage, FaTrash, FaEllipsisV } from "react-icons/fa";
import { MdPersonAddAlt1 } from "react-icons/md";
import { supabase } from "../supabaseClient";
import "./NotaRapidaCard.css";

const COR_POR_TIPO = {
  "Atas": "#22c55e",
  "Lista": "#3b82f6",
  "Tarefas": "#facc15",
  "Metas": "#8b5cf6",
  "Diário de Obra": "#f87171",
  "Diário de obra": "#f87171",
  "Medição": "#8b5cf6",
  "Medicao": "#8b5cf6",
  "Nota Rápida": "#f63bcc",
};

const renderMarkdown = (text) => {
  if (!text) return "";
  return text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>');
};

export default function NotaRapidaCard({
  nota,
  onSaveResponsavel,
  onSaveDataEntrega,
  onSaveDescricao,
  onRemoveResponsavel,
  handleDeleteNota,
  toggleConclusaoNota,
  isConcluida,
  isEditingDate,
  dataConclusaoEdit,
  dataConclusaoSalva,
  setDataConclusaoEdit,
  saveDataConclusao,
  menuOpenNota,
  setMenuOpenNota,
  pilhaId,
  dragHandleProps,
  containerId,
}) {
  const [descricaoEdit, setDescricaoEdit] = useState(nota.descricao || "");
  const [isEditingDescricao, setIsEditingDescricao] = useState(false);
  const [wasDoubleClick, setWasDoubleClick] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagemUrl, setImagemUrl] = useState(nota.imagem_url || "");

  // === Estados para menção flutuante ===
  const [showResponsavelInput, setShowResponsavelInput] = useState(false);
  const [inputResponsavel, setInputResponsavel] = useState("");
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState([]);
  const inputRef = useRef(null);
  const [inputPosition, setInputPosition] = useState({ x: 0, y: 0 });

  // === Estado para múltiplos avatares ===
  const [responsaveisAvatares, setResponsaveisAvatares] = useState([]);

  // === Carregar avatares de todos os responsáveis ===
  useEffect(() => {
    const fetchAvatares = async () => {
      const ids = nota.responsaveis_ids || [];
      if (ids.length === 0) {
        setResponsaveisAvatares([]);
        return;
      }

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, avatar_url")
        .in("id", ids);

      if (error || !profiles) {
        setResponsaveisAvatares([]);
        return;
      }

      // Garante a ordem original dos IDs
      const avataresOrdenados = ids
        .map(id => {
          const perfil = profiles.find(p => p.id === id);
          return perfil?.avatar_url || null;
        })
        .filter(url => url !== null);

      setResponsaveisAvatares(avataresOrdenados);
    };

    fetchAvatares();
  }, [nota.responsaveis_ids]);

  // === Atualiza descrição e imagem quando a nota muda ===
  useEffect(() => {
    setDescricaoEdit(nota.descricao || "");
  }, [nota.descricao]);

  useEffect(() => {
    setImagemUrl(nota.imagem_url || "");
  }, [nota.imagem_url]);

  // === Busca sugestões de membros ao digitar @ ===
  useEffect(() => {
    if (!inputResponsavel.startsWith("@") || inputResponsavel.length <= 1 || !containerId || isConcluida) {
      setSugestoesResponsavel([]);
      return;
    }

    const termo = inputResponsavel.slice(1).trim().toLowerCase();
    if (!termo) {
      setSugestoesResponsavel([]);
      return;
    }

    const fetchSugestoes = async () => {
      const { data: convites, error: convitesError } = await supabase
        .from("convites")
        .select("user_id")
        .eq("container_id", containerId)
        .eq("status", "aceito")
        .not("user_id", "is", null);

      if (convitesError || !convites?.length) {
        setSugestoesResponsavel([]);
        return;
      }

      const userIds = [...new Set(convites.map(c => c.user_id))];
      if (userIds.length === 0) {
        setSugestoesResponsavel([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname, nome")
        .in("id", userIds);

      if (profilesError) {
        setSugestoesResponsavel([]);
        return;
      }

      const sugestoes = profiles
        .filter(p =>
          (p.nickname && p.nickname.toLowerCase().includes(termo)) ||
          (p.nome && p.nome.toLowerCase().includes(termo))
        )
        .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
        .slice(0, 10);

      setSugestoesResponsavel(sugestoes);
    };

    const debounce = setTimeout(fetchSugestoes, 150);
    return () => clearTimeout(debounce);
  }, [inputResponsavel, containerId, isConcluida]);

  // === Fecha input ao clicar fora ===
  useEffect(() => {
    if (!showResponsavelInput) return;

    const handleClickOutside = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowResponsavelInput(false);
        setInputResponsavel("");
        setSugestoesResponsavel([]);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showResponsavelInput]);

  // === Ações de descrição ===
  const handleDescricaoClick = () => {
    if (wasDoubleClick) {
      setIsEditingDescricao(true);
      setWasDoubleClick(false);
    } else {
      setWasDoubleClick(true);
      setTimeout(() => setWasDoubleClick(false), 300);
    }
  };

  const handleDescricaoBlur = () => {
    const novoTexto = descricaoEdit.trim();
    if (novoTexto !== nota.descricao) {
      onSaveDescricao(nota.id, novoTexto);
    }
    setIsEditingDescricao(false);
  };

  const handleTextareaClick = (e) => e.stopPropagation();

  // === Ações de data ===
  const handleDataClick = () => {
    if (!isEditingDate) {
      setDataConclusaoEdit((prev) => ({
        ...prev,
        [nota.id]: dataConclusaoSalva[nota.id] || "",
      }));
    }
  };

  const handleDataChange = (e) => {
    const val = e.target.value;
    setDataConclusaoEdit((prev) => ({
      ...prev,
      [nota.id]: val,
    }));
  };

  const saveData = () => {
    saveDataConclusao(nota.id, dataConclusaoEdit[nota.id] || null);
  };

  const cancelData = () => {
    setDataConclusaoEdit((prev) => {
      const cp = { ...prev };
      delete cp[nota.id];
      return cp;
    });
  };

  // === Upload de imagem ===
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${nota.id}_${Date.now()}.${fileExt}`;
    const filePath = `quick-notes/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("notas-imagens")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setUploading(false);
      return;
    }

    const { data } = await supabase.storage
      .from("notas-imagens")
      .getPublicUrl(filePath);

    if (data?.publicUrl) {
      const { error: updateError } = await supabase
        .from("notas")
        .update({ imagem_url: data.publicUrl })
        .eq("id", nota.id);

      if (!updateError) {
        setImagemUrl(data.publicUrl);
      }
    }
    setUploading(false);
  };

  const handleRemoveImage = async () => {
    if (!window.confirm("Remover esta imagem?")) return;

    const { error: updateError } = await supabase
      .from("notas")
      .update({ imagem_url: null })
      .eq("id", nota.id);

    if (!updateError) {
      setImagemUrl("");
    }
  };

  // === Responsável: abrir input flutuante (sempre abre) ===
  const handleAddResponsavelClick = (e) => {
    e.stopPropagation();
    console.log("containerId atual:", containerId);
    const rect = e.currentTarget.getBoundingClientRect();
    setInputPosition({
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 4,
    });
    setShowResponsavelInput(true);
    setInputResponsavel("@");
  };

  // === Selecionar um responsável da lista ===
  const handleSelectResponsavel = (user) => {
    onSaveResponsavel(nota.id, user.id, user.nickname || user.nome);
    setShowResponsavelInput(false);
    setInputResponsavel("");
  };

  // === Só permite Enter se houver exatamente uma sugestão ===
  const handleKeyDownResponsavel = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (sugestoesResponsavel.length === 1) {
        handleSelectResponsavel(sugestoesResponsavel[0]);
      }
    }
  };

  // === Exclusão ===
  const handleExcluirNota = () => {
    if (window.confirm("Excluir esta nota?")) {
      setMenuOpenNota(null);
      handleDeleteNota(nota.id, pilhaId);
    }
  };

  // === Estilo da borda ===
  const borderColor = COR_POR_TIPO[nota.tipo] || "#cbd5e1";

  return (
    <>
      {/* === CARD PRINCIPAL === */}
      <div
        className={`card-item tipo-nota-rapida ${isConcluida ? "concluida" : ""}`}
        style={{ borderRight: `6px solid ${borderColor}` }}
        {...dragHandleProps}
      >
        <div
          className="concluir-checkbox-wrapper"
          onClick={(e) => {
            e.stopPropagation();
            toggleConclusaoNota(nota.id, isConcluida);
          }}
        >
          <input
            type="checkbox"
            checked={isConcluida}
            readOnly
            className="concluir-checkbox"
          />
        </div>

        {imagemUrl && (
          <div className="quick-note-image-wrapper">
            <img src={imagemUrl} alt="" className="quick-note-image" />
          </div>
        )}

        <div className="quick-note-actions-row">
          <label className="quick-note-btn-icon">
            {uploading ? <span style={{ fontSize: "0.8em" }}>...</span> : <FaImage size={14} />}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />
          </label>

          {imagemUrl && (
            <button
              className="quick-note-btn-icon remove-image-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveImage();
              }}
              title="Remover imagem"
            >
              <FaTrash size={14} />
            </button>
          )}

          <button
            className="quick-note-btn-icon"
            onClick={handleAddResponsavelClick}
            title={`${nota.responsaveis_ids?.length || 0} responsável(is)`}
          >
            {nota.responsaveis_ids?.length > 0 ? (
              <span style={{ fontSize: "0.8em" }}>👤</span>
            ) : (
              <MdPersonAddAlt1 size={16} />
            )}
          </button>

          {!isConcluida && (
            <button
              className="quick-note-btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenNota(menuOpenNota === nota.id ? null : nota.id);
              }}
              title="Mais ações"
            >
              <FaEllipsisV size={14} />
            </button>
          )}
        </div>

        {isEditingDescricao ? (
          <textarea
            value={descricaoEdit}
            onChange={(e) => setDescricaoEdit(e.target.value)}
            onBlur={handleDescricaoBlur}
            onClick={handleTextareaClick}
            autoFocus
            className="quick-note-descricao-textarea"
            rows={5}
          />
        ) : (
          <div
            className="quick-note-descricao-rendered"
            onClick={handleDescricaoClick}
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(descricaoEdit || "Clique duas vezes para editar...")
            }}
          />
        )}

        <div className="quick-note-tipo">{nota.tipo}</div>

        {/* Avatares dos responsáveis */}
        {responsaveisAvatares.length > 0 && (
          <div className="quick-note-responsaveis-avatars">
            {responsaveisAvatares.map((avatarUrl, index) => (
              <img
                key={index}
                src={avatarUrl}
                alt=""
                className="avatar-circulo-pequeno"
                onClick={(e) => {
                  e.stopPropagation();
                  if (nota.responsaveis_ids?.[index]) {
                    onRemoveResponsavel(nota.id, nota.responsaveis_ids[index]);
                  }
                }}
                title="Clique para remover"
              />
            ))}
          </div>
        )}

        <div
          className="data-conclusao-container"
          data-nota-id={nota.id}
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditingDate) handleDataClick();
          }}
        >
          {isEditingDate ? (
            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
              <input
                type="date"
                value={dataConclusaoEdit[nota.id] || ""}
                onChange={handleDataChange}
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: "0.85em", padding: "2px 4px" }}
              />
              <button onClick={(e) => { e.stopPropagation(); saveData(); }} style={{ fontSize: "0.8em" }}>
                ✓
              </button>
              <button onClick={(e) => { e.stopPropagation(); cancelData(); }} style={{ fontSize: "0.8em", color: "#e53e3e" }}>
                ✖
              </button>
            </div>
          ) : (
            <div
              style={{
                marginTop: "4px",
                fontSize: "0.85em",
                color: dataConclusaoSalva[nota.id] ? "#444" : "#999",
                fontStyle: dataConclusaoSalva[nota.id] ? "normal" : "italic",
              }}
            >
              {dataConclusaoSalva[nota.id]
                ? new Date(dataConclusaoSalva[nota.id]).toLocaleDateString("pt-BR")
                : "Data da entrega"}
            </div>
          )}
        </div>

        {/* Menu de ações (excluir) */}
        {!isConcluida && menuOpenNota === nota.id && (
          <div
            className="card-menu-dropdown1"
            style={{
              position: "absolute",
              top: "auto",
              bottom: "8px",
              right: "8px",
              zIndex: 9999,
              pointerEvents: "auto",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={handleExcluirNota}
            >
              <FaTrash size={12} /> Excluir
            </button>
          </div>
        )}
      </div>

      {/* === INPUT FLUTUANTE NO BODY (PORTAL) === */}
      {showResponsavelInput && !isConcluida && createPortal(
        <div
          ref={inputRef}
          style={{
            position: 'fixed',
            left: `${inputPosition.x}px`,
            top: `${inputPosition.y}px`,
            width: '220px',
            zIndex: 10000,
            background: 'white',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '4px',
            fontSize: '0.9em',
          }}
        >
          <input
            type="text"
            value={inputResponsavel}
            onChange={(e) => setInputResponsavel(e.target.value)}
            onKeyDown={handleKeyDownResponsavel}
            placeholder="Ex: @joao"
            autoFocus
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {sugestoesResponsavel.length > 0 && (
            <div
              style={{
                marginTop: '4px',
                maxHeight: '140px',
                overflowY: 'auto',
                border: '1px solid #eee',
                borderRadius: '4px',
                background: 'white',
              }}
            >
              {sugestoesResponsavel.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSelectResponsavel(user)}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f5f5f5',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f9ff'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  @{user.nickname || user.nome}
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}