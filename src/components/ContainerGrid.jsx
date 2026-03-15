// src/components/ContainerGrid.jsx
import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../supabaseClient";

const getConsistentColor = (str) => {
  if (!str) return "#81C784";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 60%)`;
};

// ── Ícone de livro (Font Awesome fal book — SVG inline para não depender de lib) ──
function BookIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 448 512"
      width="15"
      height="15"
      fill="currentColor"
    >
      <path d="M448 360V24c0-13.3-10.7-24-24-24H96C43 0 0 43 0 96v320c0 53 43 96 96 96h328c13.3 0 24-10.7 24-24v-16c0-7.5-3.5-14.3-8.9-18.7-4.2-15.4-4.2-59.3 0-74.7 5.4-4.3 8.9-11.1 8.9-18.6zM128 134c0-3.3 2.7-6 6-6h212c3.3 0 6 2.7 6 6v20c0 3.3-2.7 6-6 6H134c-3.3 0-6-2.7-6-6v-20zm0 64c0-3.3 2.7-6 6-6h212c3.3 0 6 2.7 6 6v20c0 3.3-2.7 6-6 6H134c-3.3 0-6-2.7-6-6v-20zm253.4 250H96c-26.5 0-48-21.5-48-48s21.5-48 48-48h285.4c-1.9 17.1-1.9 78.9 0 96z"/>
    </svg>
  );
}

// ── Card de Projeto Arrastável ──
function SortableProjectCard({ proj, onProjectClick, onViewDetails }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: proj.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="project-box"
      onClick={() => onProjectClick?.(proj)}
    >
      {/* Botão de livro — abre EntityDetails */}
      {onViewDetails && (
        <button
          className="project-box__details-btn"
          title="Ver detalhes do projeto"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(proj);
          }}
          onPointerDown={(e) => e.stopPropagation()} // evita acionar drag
        >
          <BookIcon />
        </button>
      )}

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
  );
}

// ── Card de Setor Arrastável ──
function SortableSetorCard({
  setor,
  onSetorClick,
  onSetorAction,
  menuSetorAberto,
  setMenuSetorAberto,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: setor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="project-box"
      onClick={() => onSetorClick?.(setor)}
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

      <div {...listeners}>
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
    </div>
  );
}

export default function ContainerGrid({
  projects = [],
  setores = [],
  onProjectClick,
  onSetorClick,
  onSetorAction,
  onViewProjectDetails,   // ← nova prop: abre EntityDetails
  menuSetorAberto,
  setMenuSetorAberto,
  containerId,
  currentUserId,
  onReorderProjects,
  onReorderSetores,
}) {
  const [projetosFiltrados, setProjetosFiltrados] = useState([]);
  const [setoresFiltrados, setSetoresFiltrados]   = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [activeId, setActiveId]                   = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const filtrarPorPermissoes = async () => {
      if (!currentUserId || !containerId) {
        setProjetosFiltrados([]);
        setSetoresFiltrados([]);
        setLoading(false);
        return;
      }

      try {
        if (currentUserId === containerId) {
          setProjetosFiltrados(projects);
          setSetoresFiltrados(setores);
          setLoading(false);
          return;
        }

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

        const projetosPermitidos = permissoes.filter((p) => p.projeto_id).map((p) => p.projeto_id);
        const setoresPermitidos  = permissoes.filter((p) => p.setor_id).map((p) => p.setor_id);

        setProjetosFiltrados(projects.filter((p) => projetosPermitidos.includes(p.id)));
        setSetoresFiltrados(setores.filter((s) => setoresPermitidos.includes(s.id)));
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

  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const isProject = projetosFiltrados.some((p) => p.id === active.id);
    if (isProject) {
      const oldIndex = projetosFiltrados.findIndex((p) => p.id === active.id);
      const newIndex = projetosFiltrados.findIndex((p) => p.id === over.id);
      const newOrder = arrayMove(projetosFiltrados, oldIndex, newIndex);
      setProjetosFiltrados(newOrder);
      onReorderProjects?.(newOrder);
    } else {
      const oldIndex = setoresFiltrados.findIndex((s) => s.id === active.id);
      const newIndex = setoresFiltrados.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(setoresFiltrados, oldIndex, newIndex);
      setSetoresFiltrados(newOrder);
      onReorderSetores?.(newOrder);
    }
  };

  if (loading) return <p className="no-projects">Carregando...</p>;

  const temConteudo = projetosFiltrados.length > 0 || setoresFiltrados.length > 0;
  if (!temConteudo) return <p className="no-projects">Tudo calmo por aqui ainda...</p>;

  return (
    <>
      {projetosFiltrados.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={projetosFiltrados.map((p) => p.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="projects-grid">
              {projetosFiltrados.map((proj) => (
                <SortableProjectCard
                  key={proj.id}
                  proj={proj}
                  onProjectClick={onProjectClick}
                  onViewDetails={onViewProjectDetails}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {setoresFiltrados.length > 0 && (
        <>
          {projetosFiltrados.length > 0 && <hr className="setores-divider" />}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={setoresFiltrados.map((s) => s.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="projects-grid">
                {setoresFiltrados.map((setor) => (
                  <SortableSetorCard
                    key={setor.id}
                    setor={setor}
                    onSetorClick={onSetorClick}
                    onSetorAction={onSetorAction}
                    menuSetorAberto={menuSetorAberto}
                    setMenuSetorAberto={setMenuSetorAberto}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </>
  );
}