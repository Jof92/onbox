// src/components/ContainerGrid.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

// ✅ Nova função: gera cor suave e única com base no ID
const getConsistentColor = (str) => {
  if (!str) return "#81C784";

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 60%)`;
};

export default function ContainerGrid({
  projects = [],
  setores = [],
  onProjectClick,
  onSetorClick,
  onSetorAction,
  menuSetorAberto,
  setMenuSetorAberto,
  containerId,
  currentUserId,
}) {
  const [projetosFiltrados, setProjetosFiltrados] = useState([]);
  const [setoresFiltrados, setSetoresFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const filtrarPorPermissoes = async () => {
      if (!currentUserId || !containerId) {
        setProjetosFiltrados([]);
        setSetoresFiltrados([]);
        setLoading(false);
        return;
      }

      try {
        // Se o usuário é o dono do container, mostra tudo
        if (currentUserId === containerId) {
          setProjetosFiltrados(projects);
          setSetoresFiltrados(setores);
          setLoading(false);
          return;
        }

        // Busca as permissões do colaborador
        const { data: permissoes, error } = await supabase
          .from("permissoes_colaboradores")
          .select("projeto_id, setor_id")
          .eq("colaborador_id", currentUserId)
          .eq("container_id", containerId);

        if (error) {
          console.error("Erro ao buscar permissões:", error);
          setProjetosFiltrados([]);
          setSetoresFiltrados([]);
          setLoading(false);
          return;
        }

        // Extrai os IDs permitidos
        const projetosPermitidos = permissoes
          .filter(p => p.projeto_id)
          .map(p => p.projeto_id);

        const setoresPermitidos = permissoes
          .filter(p => p.setor_id)
          .map(p => p.setor_id);

        // Filtra os arrays
        const projetosFiltrados = projects.filter(p => 
          projetosPermitidos.includes(p.id)
        );

        const setoresFiltrados = setores.filter(s => 
          setoresPermitidos.includes(s.id)
        );

        setProjetosFiltrados(projetosFiltrados);
        setSetoresFiltrados(setoresFiltrados);
      } catch (err) {
        console.error("Erro ao filtrar permissões:", err);
        setProjetosFiltrados([]);
        setSetoresFiltrados([]);
      } finally {
        setLoading(false);
      }
    };

    filtrarPorPermissoes();
  }, [projects, setores, currentUserId, containerId]);

  if (loading) {
    return <p className="no-projects">Carregando...</p>;
  }

  const temConteudo = projetosFiltrados.length > 0 || setoresFiltrados.length > 0;

  if (!temConteudo) {
    return <p className="no-projects">Tudo calmo por aqui ainda...</p>;
  }

  return (
    <>
      {projetosFiltrados.length > 0 && (
        <div className="projects-grid">
          {projetosFiltrados.map((proj) => (
            <div
              key={proj.id}
              className="project-box"
              onClick={() => onProjectClick?.(proj)}
            >
              <div
                className="project-photo"
                style={{
                  backgroundColor: proj.photo_url ? undefined : getConsistentColor(proj.id),
                  color: "#fff",
                }}
              >
                {proj.photo_url ? (
                  <img src={proj.photo_url} alt={proj.name || "Projeto"} />
                ) : (
                  proj.name?.charAt(0).toUpperCase() || "?"
                )}
              </div>
              <h3>{proj.name || "Projeto"}</h3>
              <p>Projeto</p>
            </div>
          ))}
        </div>
      )}

      {setoresFiltrados.length > 0 && (
        <>
          {projetosFiltrados.length > 0 && <hr className="setores-divider" />}
          <div className="projects-grid">
            {setoresFiltrados.map((setor) => (
              <div
                key={setor.id}
                className="project-box"
                onClick={() => onSetorClick?.(setor)}
                style={{ position: "relative", cursor: "pointer" }}
              >
                <div
                  className="setor-actions-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuSetorAberto?.(menuSetorAberto === setor.id ? null : setor.id);
                  }}
                >
                  <span className="setor-actions-dots">⋯</span>
                </div>

                {menuSetorAberto === setor.id && (
                  <div className="setor-actions-menu">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetorAction?.("verPerfil", setor);
                        setMenuSetorAberto?.(null);
                      }}
                    >
                      Ver perfil
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetorAction?.("delete", setor);
                        setMenuSetorAberto?.(null);
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                )}

                <div
                  className="project-photo"
                  style={{
                    backgroundColor: setor.photo_url ? undefined : getConsistentColor(setor.id),
                    color: "#fff",
                  }}
                >
                  {setor.photo_url ? (
                    <img src={setor.photo_url} alt={setor.name || "Setor"} />
                  ) : (
                    setor.name?.charAt(0).toUpperCase() || "?"
                  )}
                </div>
                <h3>{setor.name || "Setor"}</h3>
                <p>Setor</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}