import React, { useState, useEffect, useCallback, useRef } from "react";

import { FaTrash, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { TfiDropbox } from "react-icons/tfi";
import { format, addDays, subDays } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";

import { supabase } from "../supabaseClient";

import "./Containers.css";

const USER_PREFERENCES_TABLE = "user_preferences";
const ATA_OBJETIVOS_RESPONSAVEIS_TABLE = "ata_objetivos_responsaveis_enriquecidos";
const ATA_OBJETIVOS_TABLE = "ata_objetivos";
const COMENTARIOS_TABLE = "comentarios";
const NOTAS_TABLE = "notas";
const PERMISSOES_COLABORADORES_TABLE = "permissoes_colaboradores";

const AGENDA_PREFERENCE_KEY = "show_sidebar_agenda";

const normalizarTexto = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "")
    .trim();
};

const useOutsideClick = (ref, onClose) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, onClose]);
};

const useAgendaPreference = (currentUserId, currentContainerId) => {
  const [showAgendaBlock, setShowAgendaBlock] = useState(false);
  const [loadingPreference, setLoadingPreference] = useState(true);

  const loadPreference = useCallback(async () => {
    if (!currentUserId || !currentContainerId) {
      setShowAgendaBlock(false);
      setLoadingPreference(false);
      return;
    }

    try {
      const { data: pref, error } = await supabase
        .from(USER_PREFERENCES_TABLE)
        .select("value")
        .eq("user_id", currentUserId)
        .eq("container_id", currentContainerId)
        .eq("key", AGENDA_PREFERENCE_KEY)
        .single();

      if (!error) {
        setShowAgendaBlock(pref?.value || false);
      } else if (error.code !== "PGRST116") {
        console.warn("Erro ao carregar preferência de agenda no sidebar:", error);
      }
    } catch (err) {
      console.warn("Exceção ao carregar preferência de agenda no sidebar", err);
    } finally {
      setLoadingPreference(false);
    }
  }, [currentUserId, currentContainerId]);

  useEffect(() => {
    loadPreference();
  }, [loadPreference]);

  useEffect(() => {
    const handlePreferenceUpdate = () => {
      loadPreference();
    };
    window.addEventListener('agendaPreferenceUpdated', handlePreferenceUpdate);
    return () => {
      window.removeEventListener('agendaPreferenceUpdated', handlePreferenceUpdate);
    };
  }, [loadPreference]);

  return { showAgendaBlock, loadingPreference, loadPreference };
};

const AgendaBlock = ({ dataExibida, setDataExibida, agendaDoDia, carregandoAgenda }) => (
  <div className="sidebar-agenda-today">
    <div className="agenda-header-side">
      <button
        className="nav-day-btn"
        onClick={() => setDataExibida((prev) => subDays(prev, 1))}
        aria-label="Dia anterior"
      >
        <FaChevronLeft />
      </button>
      <h4 className="agenda-date">
        {format(dataExibida, "EEEE, dd MMM", { locale: ptBR })}
      </h4>
      <button
        className="nav-day-btn"
        onClick={() => setDataExibida((prev) => addDays(prev, 1))}
        aria-label="Próximo dia"
      >
        <FaChevronRight />
      </button>
    </div>

    <div className="agenda-items">
      {carregandoAgenda ? (
        <p className="agenda-empty">Carregando...</p>
      ) : agendaDoDia.length > 0 ? (
        agendaDoDia.map((item) => (
          <div key={`${item.tipo}-${item.id}`} className="agenda-item">
            <span className="item-type">
              {item.tipo === "objetivo" ? "✓" : "💬"}
            </span>
            <span className="item-title">
              {item.tipo === "objetivo" ? item.texto : `"${item.conteudo}"`}
            </span>
            <span className="item-note">{item.nomeNota}</span>
          </div>
        ))
      ) : (
        <p className="agenda-empty">Nenhuma atividade</p>
      )}
    </div>
  </div>
);

const BoxMenu = ({
  hasEditPermissions,
  showBoxMenu,
  setShowBoxMenu,
  handleCreateProject,
  handleCreateSetor,
  boxMenuRef,
}) => {
  if (!hasEditPermissions) return null;

  return (
    <div className="box-menu-container" ref={boxMenuRef}>
      <button
        className="sidebar-btn box-btn"
        onClick={() => setShowBoxMenu(!showBoxMenu)}
      >
        <TfiDropbox className="icon" /> Box
      </button>

      {showBoxMenu && (
        <div className="box-dropdown">
          <button className="box-dropdown-item" onClick={handleCreateProject}>
            Novo Projeto
          </button>
          <button className="box-dropdown-item" onClick={handleCreateSetor}>
            Novo Setor
          </button>
        </div>
      )}
    </div>
  );
};

const ProjectsList = ({
  projects,
  selectedProject,
  onProjectSelect,
  onDeleteProject,
  hasEditPermissions,
}) => (
  <div className="sidebar-projects">
    {projects.map((proj) => (
      <div
        key={proj.id}
        className={`sidebar-project ${
          selectedProject?.id === proj.id ? "active" : ""
        }`}
        onClick={() => onProjectSelect(proj)}
      >
        <span className="project-name">{proj.name || "Projeto"}</span>
        {hasEditPermissions && (
          <FaTrash
            className="delete-icon"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteProject(proj.id);
            }}
          />
        )}
      </div>
    ))}
  </div>
);

export default function Sidebar({
  projects,
  selectedProject,
  onCreateProject,
  onProjectSelect,
  onDeleteProject,
  onOpenSetoresManager,
  currentUserId,
  containerOwnerId,
  gerenteContainerId,
  currentContainerId,
}) {
  const [dataExibida, setDataExibida] = useState(new Date());
  const [agendaDoDia, setAgendaDoDia] = useState([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);
  const [showBoxMenu, setShowBoxMenu] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const boxMenuRef = useRef(null);

  useOutsideClick(boxMenuRef, () => setShowBoxMenu(false));
  const { showAgendaBlock, loadingPreference } = useAgendaPreference(
    currentUserId,
    currentContainerId
  );

  const hasEditPermissions =
    currentUserId &&
    (currentUserId === containerOwnerId || currentUserId === gerenteContainerId);

  const filterProjectsByPermissions = useCallback(async () => {
    setLoadingProjects(true);
    if (!currentUserId || !currentContainerId) {
      setFilteredProjects([]);
      setLoadingProjects(false);
      return;
    }

    try {
      if (hasEditPermissions) {
        setFilteredProjects(projects);
        return;
      }

      const { data: permissoes, error } = await supabase
        .from(PERMISSOES_COLABORADORES_TABLE)
        .select("projeto_id")
        .eq("colaborador_id", currentUserId)
        .eq("container_id", currentContainerId);

      if (error) {
        console.error("Erro ao buscar permissões de projetos:", error);
        setFilteredProjects([]);
        return;
      }

      const projetosPermitidosIds = permissoes
        .filter((p) => p.projeto_id)
        .map((p) => p.projeto_id);

      const filtered = projects.filter((p) =>
        projetosPermitidosIds.includes(p.id)
      );
      setFilteredProjects(filtered);
    } catch (err) {
      console.error("Erro ao filtrar projetos por permissões:", err);
      setFilteredProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [
    projects,
    currentUserId,
    currentContainerId,
    hasEditPermissions,
  ]);

  useEffect(() => {
    filterProjectsByPermissions();
  }, [filterProjectsByPermissions]);

  const fetchAgendaForDate = useCallback(
    async (userId, dateStr) => {
      if (!userId || !dateStr) return [];

      try {
        const { data: responsaveis, error: err1 } = await supabase
          .from(ATA_OBJETIVOS_RESPONSAVEIS_TABLE)
          .select("ata_objetivo_id")
          .eq("usuario_id", userId);

        if (err1) throw err1;

        let objetivosDoDia = [];
        if (responsaveis?.length > 0) {
          const objetivoIds = responsaveis
            .map((r) => r.ata_objetivo_id)
            .filter(Boolean);

          if (objetivoIds.length > 0) {
            const { data: objetivos, error: err2 } = await supabase
              .from(ATA_OBJETIVOS_TABLE)
              .select("id, texto, ata_id, concluido")
              .in("id", objetivoIds)
              .eq("data_entrega", dateStr);

            if (err2) throw err2;

            const mapaUnicos = new Map();
            (objetivos || []).forEach((obj) => {
              if (obj.texto?.startsWith("[EXCLUIDO]")) return;
              const norm = normalizarTexto(obj.texto);
              if (!mapaUnicos.has(norm) || obj.id > mapaUnicos.get(norm).id) {
                mapaUnicos.set(norm, { ...obj, tipo: "objetivo" });
              }
            });
            objetivosDoDia = Array.from(mapaUnicos.values());
          }
        }

        const { data: comentarios, error: err3 } = await supabase
          .from(COMENTARIOS_TABLE)
          .select("id, conteudo, nota_id")
          .eq("agendado_por", userId)
          .eq("data_entrega", dateStr);

        if (err3 && err3.code !== "PGRST116") {
          console.warn("Erro ao carregar comentários do dia:", err3);
        }

        const comentariosDoDia = (comentarios || []).map((c) => ({
          ...c,
          tipo: "comentario",
        }));

        const notaIds = [
          ...new Set([
            ...objetivosDoDia.map((o) => o.ata_id).filter(Boolean),
            ...comentariosDoDia.map((c) => c.nota_id).filter(Boolean),
          ]),
        ];

        let notasMap = {};
        if (notaIds.length > 0) {
          const { data: notas } = await supabase
            .from(NOTAS_TABLE)
            .select("id, nome")
            .in("id", notaIds);

          if (notas) {
            notasMap = Object.fromEntries(
              notas.map((n) => [n.id, n.nome || "Sem título"])
            );
          }
        }

        return [
          ...objetivosDoDia.map((o) => ({
            ...o,
            nomeNota: notasMap[o.ata_id] || "Nota não associada",
          })),
          ...comentariosDoDia.map((c) => ({
            ...c,
            nomeNota: notasMap[c.nota_id] || "Sem nota",
          })),
        ];
      } catch (err) {
        console.error("Erro ao buscar agenda do dia:", err);
        return [];
      }
    },
    []
  );

  useEffect(() => {
    if (!currentUserId || !showAgendaBlock) {
      setAgendaDoDia([]);
      return;
    }

    const dateStr = format(dataExibida, "yyyy-MM-dd");
    setCarregandoAgenda(true);
    fetchAgendaForDate(currentUserId, dateStr)
      .then((itens) => setAgendaDoDia(itens))
      .finally(() => setCarregandoAgenda(false));
  }, [dataExibida, currentUserId, fetchAgendaForDate, showAgendaBlock]);

  const handleCreateProject = useCallback(() => {
    onCreateProject();
    setShowBoxMenu(false);
  }, [onCreateProject]);

  const handleCreateSetor = useCallback(() => {
    onOpenSetoresManager();
    setShowBoxMenu(false);
  }, [onOpenSetoresManager]);

  return (
    <aside className="containers-sidebar">
      {!loadingPreference && showAgendaBlock && (
        <AgendaBlock
          dataExibida={dataExibida}
          setDataExibida={setDataExibida}
          agendaDoDia={agendaDoDia}
          carregandoAgenda={carregandoAgenda}
        />
      )}

      <BoxMenu
        hasEditPermissions={hasEditPermissions}
        showBoxMenu={showBoxMenu}
        setShowBoxMenu={setShowBoxMenu}
        handleCreateProject={handleCreateProject}
        handleCreateSetor={handleCreateSetor}
        boxMenuRef={boxMenuRef}
      />

      {loadingProjects ? (
        <p className="sidebar-loading-projects"></p>
      ) : filteredProjects.length > 0 ? (
        <ProjectsList
          projects={filteredProjects}
          selectedProject={selectedProject}
          onProjectSelect={onProjectSelect}
          onDeleteProject={onDeleteProject}
          hasEditPermissions={hasEditPermissions}
        />
      ) : (
        <p className="sidebar-no-projects"></p>
      )}
    </aside>
  );
}