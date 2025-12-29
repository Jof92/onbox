// src/components/NotaRapidaCard.jsx
import React, { useState, useEffect, useRef } from "react";
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

  // Estados para menção de responsável
  const [showResponsavelInput, setShowResponsavelInput] = useState(false);
  const [inputResponsavel, setInputResponsavel] = useState("");
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState([]);
  const [loadingSugestoes, setLoadingSugestoes] = useState(false);
  const inputRef = useRef(null);
  const sugestoesRef = useRef(null);

  useEffect(() => {
    setDescricaoEdit(nota.descricao || "");
  }, [nota.descricao]);

  useEffect(() => {
    setImagemUrl(nota.imagem_url || "");
  }, [nota.imagem_url]);

  // Fecha o input de responsável ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target) &&
        sugestoesRef.current &&
        !sugestoesRef.current.contains(e.target)
      ) {
        setShowResponsavelInput(false);
        setInputResponsavel("");
        setSugestoesResponsavel([]);
      }
    };
    if (showResponsavelInput) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showResponsavelInput]);

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

  // Lógica de menção com @
  const handleResponsavelInputChange = async (e) => {
    const valor = e.target.value;
    setInputResponsavel(valor);

    if (!containerId || isConcluida) {
      setSugestoesResponsavel([]);
      return;
    }

    if (valor.startsWith("@") && valor.length > 1) {
      const termo = valor.slice(1).toLowerCase().trim();
      if (!termo) {
        setSugestoesResponsavel([]);
        return;
      }

      setLoadingSugestoes(true);
      try {
        const { data: convites, error: convitesError } = await supabase
          .from("convites")
          .select("user_id")
          .eq("container_id", containerId)
          .eq("status", "aceito");

        if (convitesError) {
          console.error("Erro ao buscar convites:", convitesError);
          setSugestoesResponsavel([]);
          return;
        }

        const userIds = convites.map(c => c.user_id).filter(Boolean);
        if (userIds.length === 0) {
          setSugestoesResponsavel([]);
          return;
        }

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nickname, nome")
          .in("id", userIds);

        if (profilesError) {
          console.error("Erro ao buscar perfis:", profilesError);
          setSugestoesResponsavel([]);
          return;
        }

        const sugestoes = profiles.filter(p =>
          (p.nickname?.toLowerCase().includes(termo)) ||
          (p.nome?.toLowerCase().includes(termo))
        );

        const seen = new Set();
        const unicos = sugestoes.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        setSugestoesResponsavel(unicos.slice(0, 10));
      } finally {
        setLoadingSugestoes(false);
      }
    } else {
      setSugestoesResponsavel([]);
    }
  };

  const handleKeyDownResponsavel = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const valor = inputResponsavel.trim();
      if (valor && !valor.startsWith("@")) {
        // Nome externo: salva o texto digitado
        onSaveResponsavel(nota.id, null, valor);
        setShowResponsavelInput(false);
        setInputResponsavel("");
      } else if (sugestoesResponsavel.length === 1) {
        // Auto-seleciona se só houver uma sugestão
        const user = sugestoesResponsavel[0];
        const nomeExibicao = user.nickname || user.nome;
        onSaveResponsavel(nota.id, null, nomeExibicao);
        setShowResponsavelInput(false);
        setInputResponsavel("");
      }
    }
  };

  const handleSelectResponsavel = (user) => {
    const nomeExibicao = user.nickname || user.nome;
    onSaveResponsavel(nota.id, null, nomeExibicao);
    setShowResponsavelInput(false);
    setInputResponsavel("");
  };

  const handleAddResponsavelClick = (e) => {
    e.stopPropagation();
    if (nota.responsavel) {
      onRemoveResponsavel(nota.id);
    } else {
      setShowResponsavelInput(true);
    }
  };

  const borderColor = COR_POR_TIPO[nota.tipo] || "#cbd5e1";

  const handleExcluirNota = () => {
    if (window.confirm("Excluir esta nota?")) {
      setMenuOpenNota(null);
      handleDeleteNota(nota.id, pilhaId);
    }
  };

  return (
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
          title={nota.responsavel || "Adicionar responsável"}
        >
          {nota.responsavel ? (
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

      {/* Input flutuante para adicionar responsável */}
      {showResponsavelInput && !isConcluida && (
        <div className="responsavel-mention-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={inputResponsavel}
            onChange={handleResponsavelInputChange}
            onKeyDown={handleKeyDownResponsavel}
            placeholder="Digite nome ou @ para mencionar"
            autoFocus
            className="quick-note-responsavel-input"
          />
          {sugestoesResponsavel.length > 0 && (
            <div ref={sugestoesRef} className="sugestoes-list">
              {sugestoesResponsavel.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSelectResponsavel(user)}
                  className="sugestao-item"
                >
                  @{user.nickname || user.nome}
                </div>
              ))}
            </div>
          )}
          {loadingSugestoes && (
            <div className="sugestoes-loading">Buscando...</div>
          )}
        </div>
      )}

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
  );
}