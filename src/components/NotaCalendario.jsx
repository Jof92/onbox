// src/components/NotaCalendario.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { FaEllipsisV } from "react-icons/fa";
import "./NotaCalendario.css";
import ModalEventoCalendario from "./ModalEventoCalendario";

export default function NotaCalendarioCard({ 
  nota,
  pilhaId,
  usuarioId,
  membros = [],
  onDelete,
  containerId
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventosDoMes, setEventosDoMes] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membrosContainer, setMembrosContainer] = useState([]);
  const [reprogramandoId, setReprogramandoId] = useState(null);
  const [novaDataReprogramacao, setNovaDataReprogramacao] = useState("");

  // Buscar membros do container
  useEffect(() => {
    const loadMembrosContainer = async () => {
      if (!containerId) return;

      try {
        const { data: convites, error: convitesError } = await supabase
          .from("convites")
          .select("user_id")
          .eq("container_id", containerId)
          .eq("status", "aceito");

        if (convitesError) {
          console.error("Erro ao buscar convites:", convitesError);
          return;
        }

        const userIds = convites
          .map(c => c.user_id)
          .filter(id => id);

        if (userIds.length === 0) {
          setMembrosContainer([]);
          return;
        }

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nickname, nome")
          .in("id", userIds);

        if (profilesError) {
          console.error("Erro ao buscar perfis:", profilesError);
          return;
        }

        setMembrosContainer(profiles || []);
      } catch (err) {
        console.error("Erro ao carregar membros:", err);
      }
    };

    loadMembrosContainer();
  }, [containerId]);

  useEffect(() => {
    loadEventos();
  }, [nota.id, currentDate]);

  const loadEventos = async () => {
    setLoading(true);
    try {
      const inicio = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const fim = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from("eventos_calendario")
        .select("*")
        .eq("nota_id", nota.id)
        .gte("data", inicio.toISOString().split('T')[0])
        .lte("data", fim.toISOString().split('T')[0])
        .order("data", { ascending: true })
        .order("horario_inicio", { ascending: true });

      if (!error && data) {
        setEventos(data);
        setEventosDoMes(data);
      }
    } catch (err) {
      console.error("Erro ao carregar eventos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNota = async () => {
    if (!window.confirm("Deseja realmente excluir este calendário?")) return;
    
    setMenuOpen(false);
    
    try {
      await supabase
        .from("eventos_calendario")
        .delete()
        .eq("nota_id", nota.id);
      
      const { error } = await supabase
        .from("notas")
        .delete()
        .eq("id", nota.id);
      
      if (error) throw error;
      
      if (onDelete) onDelete();
      
    } catch (err) {
      console.error("Erro ao excluir calendário:", err);
      alert("Erro ao excluir calendário.");
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpen && !e.target.closest('.calendario-menu-container')) {
        setMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getEventosNaData = (day) => {
    const dateStr = formatDateToISO(currentDate.getFullYear(), currentDate.getMonth(), day);
    return eventos.filter(e => e.data === dateStr);
  };

  const formatDateToISO = (year, month, day) => {
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0];
  };

  const handleDayClick = (day) => {
    const dateStr = formatDateToISO(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(dateStr);
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleEditEvent = (evento) => {
    setSelectedDate(evento.data);
    setEditingEvent(evento);
    setShowEventModal(true);
  };

  const handleToggleEventStatus = async (eventoId, currentStatus) => {
    const newStatus = currentStatus === 'concluido' ? null : 'concluido';
    
    try {
      const { error } = await supabase
        .from("eventos_calendario")
        .update({ status: newStatus })
        .eq("id", eventoId);

      if (error) throw error;

      await loadEventos();
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      alert("Erro ao atualizar status do evento.");
    }
  };

  const handleCancelarEvento = async (eventoId) => {
    if (!window.confirm("Deseja cancelar este evento?")) return;

    try {
      const { error } = await supabase
        .from("eventos_calendario")
        .update({ status: 'cancelado' })
        .eq("id", eventoId);

      if (error) throw error;

      await loadEventos();
    } catch (err) {
      console.error("Erro ao cancelar evento:", err);
      alert("Erro ao cancelar evento.");
    }
  };

  const handleReprogramarEvento = async (eventoId, novaData) => {
    try {
      const { error } = await supabase
        .from("eventos_calendario")
        .update({ 
          data: novaData,
          status: null
        })
        .eq("id", eventoId);

      if (error) throw error;

      await loadEventos();
      setReprogramandoId(null);
      setNovaDataReprogramacao("");
    } catch (err) {
      console.error("Erro ao reprogramar evento:", err);
      alert("Erro ao reprogramar evento.");
    }
  };

  const handleDeleteEvento = async (eventoId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Deseja realmente excluir este evento?")) return;

    try {
      const { error } = await supabase
        .from("eventos_calendario")
        .delete()
        .eq("id", eventoId);

      if (error) throw error;

      await loadEventos();
    } catch (err) {
      console.error("Erro ao deletar evento:", err);
      alert("Erro ao deletar evento.");
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    }

    const today = new Date();
    const isCurrentMonth = currentDate.getMonth() === today.getMonth() && 
                          currentDate.getFullYear() === today.getFullYear();

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && day === today.getDate();
      const eventosNoDia = getEventosNaData(day);
      const hasEvents = eventosNoDia.length > 0;
      const numEventos = eventosNoDia.length;
      const maxDotsToShow = 3;

      days.push(
        <div
          key={day}
          className={`cal-day ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
          onClick={() => handleDayClick(day)}
          title={hasEvents ? `${numEventos} evento(s)` : 'Clique para adicionar evento'}
        >
          <span className="day-num">{day}</span>
          
          {hasEvents && (
            <div className="event-dots-container">
              {eventosNoDia.slice(0, maxDotsToShow).map((evento, index) => (
                <div 
                  key={`dot-${evento.id}-${index}`} 
                  className="event-dot"
                  title={evento.evento}
                />
              ))}
              
              {numEventos > maxDotsToShow && (
                <div className="event-dot-more" title={`${numEventos} eventos`}>
                  +{numEventos - maxDotsToShow}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <>
      <div className="nota-calendario-card">
        <div className="calendario-header-simples">
          <h3 className="calendario-titulo">Calendario - {nota.nome}</h3>
          
          <div className="calendario-menu-container">
            <button 
              className="calendario-menu-btn-simples"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(prev => !prev);
              }}
              aria-label="Menu"
            >
              <FaEllipsisV />
            </button>
            
            {menuOpen && (
              <div className="calendario-menu-dropdown">
                <button 
                  className="calendario-menu-item delete"
                  onClick={handleDeleteNota}
                >
                  <span className="material-symbols-outlined">delete</span>
                  Excluir calendário
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="cal-header">
          <button onClick={previousMonth} className="cal-nav-btn">
            ◀
          </button>
          <div className="cal-month-title">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </div>
          <button onClick={nextMonth} className="cal-nav-btn">
            ▶
          </button>
        </div>

        <div className="cal-weekdays">
          <div>D</div>
          <div>S</div>
          <div>T</div>
          <div>Q</div>
          <div>Q</div>
          <div>S</div>
          <div>S</div>
        </div>

        <div className="cal-grid">
          {loading ? (
            <div className="cal-loading">Carregando...</div>
          ) : (
            renderCalendar()
          )}
        </div>

        {eventosDoMes.length > 0 && (
          <div className="cal-eventos-resumo">
            <h4>Próximos eventos</h4>
            <div className="eventos-lista-resumo">
              {eventosDoMes.slice(0, 5).map(evento => {
                const membrosList = membrosContainer.length > 0 ? membrosContainer : membros;
                const responsavel = membrosList.find(m => m.id === evento.responsavel_id);
                const dataFormatada = new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short'
                });

                const statusEvento = evento.status || null;
                const isConcluido = statusEvento === 'concluido';
                const isCancelado = statusEvento === 'cancelado';
                const isReprogramando = reprogramandoId === evento.id;

                return (
                  <div 
                    key={evento.id} 
                    className={`evento-resumo-item ${isConcluido ? 'concluido' : ''} ${isCancelado ? 'cancelado' : ''}`}
                    onClick={(e) => {
                      if (!isReprogramando) {
                        e.stopPropagation();
                        handleEditEvent(evento);
                      }
                    }}
                  >
                    <div className="evento-resumo-content">
                      <div className="evento-resumo-left">
                        <div className="evento-resumo-date">{dataFormatada}</div>
                        <div className="evento-resumo-info">
                          <div className="evento-resumo-nome">{evento.evento}</div>
                          {evento.horario_inicio && (
                            <div className="evento-resumo-detail horario">
                              <span className="material-symbols-outlined">schedule</span>
                              {evento.horario_inicio}
                              {evento.horario_termino && ` - ${evento.horario_termino}`}
                            </div>
                          )}
                          {responsavel && (
                            <div className="evento-resumo-detail responsavel">
                              <span className="material-symbols-outlined">person</span>
                              {responsavel.nickname || responsavel.nome}
                            </div>
                          )}
                          {evento.local && (
                            <div className="evento-resumo-detail local">
                              <span className="material-symbols-outlined">location_on</span>
                              {evento.local}
                            </div>
                          )}
                          {isConcluido && (
                            <div className="evento-status-badge concluido">
                              <span className="material-symbols-outlined">check_circle</span>
                              Concluído
                            </div>
                          )}
                          {isCancelado && (
                            <div className="evento-status-badge cancelado">
                              <span className="material-symbols-outlined">cancel</span>
                              Cancelado
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="evento-resumo-actions">
                        {!isCancelado && (
                          <label className="evento-checkbox-container">
                            <input
                              type="checkbox"
                              checked={isConcluido}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleEventStatus(evento.id, statusEvento);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="evento-checkbox-custom"></span>
                          </label>
                        )}

                        {!isConcluido && (
                          <>
                            {isReprogramando ? (
                              <div className="reprogramar-container" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="date"
                                  value={novaDataReprogramacao}
                                  onChange={(e) => setNovaDataReprogramacao(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="reprogramar-input"
                                />
                                <button
                                  className="reprogramar-confirm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (novaDataReprogramacao) {
                                      handleReprogramarEvento(evento.id, novaDataReprogramacao);
                                    }
                                  }}
                                >
                                  <span className="material-symbols-outlined">check</span>
                                </button>
                                <button
                                  className="reprogramar-cancel"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReprogramandoId(null);
                                    setNovaDataReprogramacao("");
                                  }}
                                >
                                  <span className="material-symbols-outlined">close</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                className="evento-action-btn reprogramar"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReprogramandoId(evento.id);
                                  setNovaDataReprogramacao(evento.data);
                                }}
                                title="Reprogramar"
                              >
                                <span className="material-symbols-outlined">calendar_month</span>
                              </button>
                            )}

                            <button
                              className="evento-action-btn cancelar"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelarEvento(evento.id);
                              }}
                              title="Cancelar evento"
                            >
                              <span className="material-symbols-outlined">cancel</span>
                            </button>
                          </>
                        )}

                        <button
                          className="evento-action-btn delete"
                          onClick={(e) => handleDeleteEvento(evento.id, e)}
                          title="Excluir evento"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {eventosDoMes.length > 5 && (
              <div className="ver-mais-eventos">
                +{eventosDoMes.length - 5} eventos este mês
              </div>
            )}
          </div>
        )}
      </div>

      {showEventModal && (
        <ModalEventoCalendario
          notaId={nota.id}
          selectedDate={selectedDate}
          editingEvent={editingEvent}
          membros={membrosContainer.length > 0 ? membrosContainer : membros}
          usuarioId={usuarioId}
          containerId={containerId}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
          }}
          onSave={() => {
            loadEventos();
            setShowEventModal(false);
            setEditingEvent(null);
          }}
        />
      )}
    </>
  );
}