// src/components/Sidebar.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaTrash, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { TfiDropbox } from "react-icons/tfi";
import { supabase } from "../supabaseClient";
import { format, addDays, subDays } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";
import "./Containers.css";

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
  const hasEditPermissions = currentUserId && (
    currentUserId === containerOwnerId || 
    currentUserId === gerenteContainerId
  );

  const [dataExibida, setDataExibida] = useState(new Date());
  const [agendaDoDia, setAgendaDoDia] = useState([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);
  const [showBoxMenu, setShowBoxMenu] = useState(false);
  const [showAgendaBlock, setShowAgendaBlock] = useState(false);
  const [loadingPreference, setLoadingPreference] = useState(true);
  const boxMenuRef = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (boxMenuRef.current && !boxMenuRef.current.contains(event.target)) {
        setShowBoxMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Carrega preferência inicial
  const loadPreference = useCallback(async () => {
    if (!currentUserId || !currentContainerId) {
      setShowAgendaBlock(false);
      setLoadingPreference(false);
      return;
    }

    try {
      const { data: pref, error } = await supabase
        .from("user_preferences")
        .select("value")
        .eq("user_id", currentUserId)
        .eq("container_id", currentContainerId)
        .eq("key", "show_sidebar_agenda")
        .single();

      if (!error) {
        setShowAgendaBlock(pref?.value || false);
      } else if (error.code !== "PGRST116") {
        console.warn("Erro ao carregar preferência no sidebar:", error);
      }
    } catch (err) {
      console.warn("Erro ao carregar preferência no sidebar", err);
    } finally {
      setLoadingPreference(false);
    }
  }, [currentUserId, currentContainerId]);

  // Carrega na montagem
  useEffect(() => {
    loadPreference();
  }, [loadPreference]);

  // ✅ ESCUTA EVENTO GLOBAL PARA ATUALIZAR IMEDIATAMENTE
  useEffect(() => {
    const handlePreferenceUpdate = () => {
      loadPreference();
    };

    window.addEventListener('agendaPreferenceUpdated', handlePreferenceUpdate);
    return () => {
      window.removeEventListener('agendaPreferenceUpdated', handlePreferenceUpdate);
    };
  }, [loadPreference]);

  const normalizarTexto = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w]/g, "")
      .trim();
  };

  const fetchAgendaForDate = useCallback(async (userId, dateStr) => {
    if (!userId || !dateStr) return [];

    try {
      const { data: responsaveis, error: err1 } = await supabase
        .from("ata_objetivos_responsaveis_enriquecidos")
        .select("ata_objetivo_id")
        .eq("usuario_id", userId);

      if (err1) throw err1;

      let objetivosDoDia = [];
      if (responsaveis?.length > 0) {
        const objetivoIds = responsaveis
          .map(r => r.ata_objetivo_id)
          .filter(id => id != null);

        if (objetivoIds.length > 0) {
          const { data: objetivos, error: err2 } = await supabase
            .from("ata_objetivos")
            .select("id, texto, ata_id, concluido")
            .in("id", objetivoIds)
            .eq("data_entrega", dateStr);

          if (err2) throw err2;

          const mapaUnicos = new Map();
          (objetivos || []).forEach(obj => {
            if (obj.texto?.startsWith("[EXCLUIDO]")) return;
            const norm = normalizarTexto(obj.texto);
            if (!mapaUnicos.has(norm) || obj.id > mapaUnicos.get(norm).id) {
              mapaUnicos.set(norm, { ...obj, tipo: 'objetivo' });
            }
          });
          objetivosDoDia = Array.from(mapaUnicos.values());
        }
      }

      const { data: comentarios, error: err3 } = await supabase
        .from("comentarios")
        .select("id, conteudo, nota_id")
        .eq("agendado_por", userId)
        .eq("data_entrega", dateStr);

      if (err3 && err3.code !== "PGRST116") {
        console.warn("Erro ao carregar comentários do dia:", err3);
      }

      const comentariosDoDia = (comentarios || []).map(c => ({
        ...c,
        tipo: 'comentario'
      }));

      const notaIds = [
        ...new Set([
          ...objetivosDoDia.map(o => o.ata_id).filter(Boolean),
          ...comentariosDoDia.map(c => c.nota_id).filter(Boolean)
        ])
      ];

      let notasMap = {};
      if (notaIds.length > 0) {
        const { data: notas } = await supabase
          .from("notas")
          .select("id, nome")
          .in("id", notaIds);

        if (notas) {
          notasMap = Object.fromEntries(
            notas.map(n => [n.id, n.nome || "Sem título"])
          );
        }
      }

      return [
        ...objetivosDoDia.map(o => ({
          ...o,
          nomeNota: notasMap[o.ata_id] || "Nota não associada"
        })),
        ...comentariosDoDia.map(c => ({
          ...c,
          nomeNota: notasMap[c.nota_id] || "Sem nota"
        }))
      ];
    } catch (err) {
      console.error("Erro ao buscar agenda do dia:", err);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setAgendaDoDia([]);
      return;
    }

    const dateStr = format(dataExibida, "yyyy-MM-dd");
    setCarregandoAgenda(true);
    fetchAgendaForDate(currentUserId, dateStr)
      .then(itens => setAgendaDoDia(itens))
      .finally(() => setCarregandoAgenda(false));
  }, [dataExibida, currentUserId, fetchAgendaForDate]);

  const handleCreateProject = () => {
    onCreateProject();
    setShowBoxMenu(false);
  };

  const handleCreateSetor = () => {
    onOpenSetoresManager();
    setShowBoxMenu(false);
  };

  return (
    <aside className="containers-sidebar">
      {/* === BLOCO DE AGENDA DO DIA (CONDICIONAL) === */}
      {!loadingPreference && showAgendaBlock && (
        <div className="sidebar-agenda-today">
          <div className="agenda-header-side">
            <button
              className="nav-day-btn"
              onClick={() => setDataExibida(prev => subDays(prev, 1))}
              aria-label="Dia anterior"
            >
              <FaChevronLeft />
            </button>
            <h4 className="agenda-date">
              {format(dataExibida, "EEEE, dd MMM", { locale: ptBR })}
            </h4>
            <button
              className="nav-day-btn"
              onClick={() => setDataExibida(prev => addDays(prev, 1))}
              aria-label="Próximo dia"
            >
              <FaChevronRight />
            </button>
          </div>

          <div className="agenda-items">
            {carregandoAgenda ? (
              <p className="agenda-empty">Carregando...</p>
            ) : agendaDoDia.length > 0 ? (
              agendaDoDia.map(item => (
                <div key={`${item.tipo}-${item.id}`} className="agenda-item">
                  <span className="item-type">
                    {item.tipo === 'objetivo' ? '✓' : '💬'}
                  </span>
                  <span className="item-title">
                    {item.tipo === 'objetivo' ? item.texto : `"${item.conteudo}"`}
                  </span>
                  <span className="item-note">{item.nomeNota}</span>
                </div>
              ))
            ) : (
              <p className="agenda-empty">Nenhuma atividade</p>
            )}
          </div>
        </div>
      )}

      {/* === Botão "+ Box" === */}
      {hasEditPermissions && (
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
      )}

      <div className="sidebar-projects">
        {projects.map((proj) => (
          <div
            key={proj.id}
            className={`sidebar-project ${selectedProject?.id === proj.id ? "active" : ""}`}
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
    </aside>
  );
}