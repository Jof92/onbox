// src/components/EntityDetails.jsx
import React, { useState, useEffect } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./Containers.css";

// Gera cor consistente baseada no ID
const getConsistentColor = (str) => {
  if (!str) return "#81C784";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 60%)`;
};

// Formata data para exibição amigável (dd/mm/aaaa)
const formatarData = (data) => {
  if (!data) return "Não definida";
  const d = new Date(data);
  if (isNaN(d.getTime())) return "Data inválida";
  return d.toLocaleDateString("pt-BR");
};

export default function EntityDetails({
  entityType,
  entity,
  onBack,
  onEdit,
  children,
  canEdit = false,
}) {
  const isProject = entityType === "project";
  const name = entity.name || (isProject ? "Projeto" : "Setor");

  // Estado para o engenheiro completo
  const [engenheiro, setEngenheiro] = useState(null);

  // Dados do projeto
  const dataInicio = isProject ? entity.data_inicio : null;
  const dataFinalizacao = isProject ? entity.data_finalizacao : null;
  const pavimentos = isProject ? entity.pavimentos || [] : [];
  const eap = isProject ? entity.eap || [] : [];
  const membros = isProject
    ? Array.isArray(entity.membrosSelecionados)
      ? entity.membrosSelecionados
      : Array.isArray(entity.membros)
      ? entity.membros
      : []
    : [];

  // Carrega engenheiro a partir de engenheiro_id
  useEffect(() => {
  if (!isProject) return;

  const engenheiroId = entity.engenheiro_id;

  if (!engenheiroId) {
    setEngenheiro(null);
    return;
  }

  const fetchEngenheiro = async () => {
    try {
      // ✅ CORRIGIDO: busca 'nickname' ao invés de 'nome'
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url") // ✅ 'nickname'
        .eq("id", engenheiroId)
        .single();

      if (error) throw error;
      setEngenheiro(data);
    } catch (err) {
      console.error("Erro ao carregar engenheiro:", err);
      setEngenheiro(null);
    }
  };

  fetchEngenheiro();
}, [isProject, entity.engenheiro_id]);

  return (
    <div className="project-details">
      <button className="back-btn" onClick={onBack}>
        <FaArrowLeft />
      </button>

      <div
        className="details-photo"
        style={{
          backgroundColor: entity.photo_url ? undefined : getConsistentColor(entity.id),
        }}
      >
        {entity.photo_url ? (
          <img src={entity.photo_url} alt={name} />
        ) : (
          name.charAt(0).toUpperCase() || "?"
        )}
      </div>

      <h2>{name}</h2>

      {isProject && (
        <>
          {/* Datas */}
          <div className="project-dates-section">
            <div className="date-item">
              <h4 className="date-label">Início</h4>
              <p className="date-value">{formatarData(dataInicio)}</p>
            </div>
            <div className="date-item">
              <h4 className="date-label">Término</h4>
              <p className="date-value">{formatarData(dataFinalizacao)}</p>
            </div>
          </div>

          {/* Engenheiro Responsável */}
          {engenheiro && (
            <div className="project-engineer-section">
              <h3 className="section-title">Engenheiro Responsável</h3>
              <div className="engineer-info">
                {engenheiro.avatar_url ? (
                  <img
                    src={engenheiro.avatar_url}
                    alt={engenheiro.nickname || "Engenheiro"}
                    className="engineer-avatar"
                  />
                ) : (
                  <div className="engineer-avatar-placeholder">
                    {engenheiro.nickname?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <span className="engineer-name">{engenheiro.nickname}</span>
              </div>
            </div>
          )}

          {/* Membros */}
          {membros.length > 0 && (
            <div className="project-members-section">
              <h3 className="section-title">Membros</h3>
              <div className="members-list">
                {membros.map((membro) => {
                  if (!membro?.id) return null;
                  return (
                    <div key={membro.id} className="member-item">
                      {membro.avatar_url ? (
                        <img
                          src={membro.avatar_url}
                          alt={membro.nickname || "Membro"}
                          className="member-avatar"
                        />
                      ) : (
                        <div className="member-avatar-placeholder">
                          {membro.nickname?.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                      <span className="member-name">{membro.nickname}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}         
        </>
      )}

      {children}

      {canEdit && (
        <button className="edit-btn" onClick={onEdit}>
          Editar
        </button>
      )}
    </div>
  );
}