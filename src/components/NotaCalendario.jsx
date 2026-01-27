// src/components/NotaCalendario.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { FaEllipsisV, FaTrash } from "react-icons/fa";
import "./NotaCalendario.css";
import ModalEventoCalendario from "./ModalEventoCalendario";

export default function NotaCalendarioCard({ 
  nota,
  pilhaId,
  usuarioId,
  membros = [],
  onDelete
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventosDoMes, setEventosDoMes] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

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
        .order("horario", { ascending: true });

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

      days.push(
        <div
          key={day}
          className={`cal-day ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
          onClick={() => handleDayClick(day)}
          title={hasEvents ? `${eventosNoDia.length} evento(s)` : 'Clique para adicionar evento'}
        >
          <span className="day-num">{day}</span>
          {hasEvents && (
            <div className="event-dot">
              {eventosNoDia.length}
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
        {/* ✅ HEADER SIMPLES */}
        <div className="calendario-header-simples">
          <h3 className="calendario-titulo">Calendario - {nota.nome}</h3>
          
          <div className="calendario-menu-container">
            <button 
              className="card-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(prev => !prev);
              }}
              aria-label="Menu"
            >
              <FaEllipsisV />
            </button>
            
            {menuOpen && (
              <div className="card-menu-dropdown">
                <button 
                  onClick={handleDeleteNota}
                  style={{ color: "#black" }}
                >
                  <FaTrash /> Excluir
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Header de navegação do mês */}
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

        {/* Dias da semana */}
        <div className="cal-weekdays">
          <div>D</div>
          <div>S</div>
          <div>T</div>
          <div>Q</div>
          <div>Q</div>
          <div>S</div>
          <div>S</div>
        </div>

        {/* Grid do calendário */}
        <div className="cal-grid">
          {loading ? (
            <div className="cal-loading">Carregando...</div>
          ) : (
            renderCalendar()
          )}
        </div>

        {/* Lista resumida de eventos do mês */}
        {eventosDoMes.length > 0 && (
          <div className="cal-eventos-resumo">
            <h4>Próximos eventos</h4>
            <div className="eventos-lista-resumo">
              {eventosDoMes.slice(0, 3).map(evento => {
                const responsavel = membros.find(m => m.id === evento.responsavel_id);
                const dataFormatada = new Date(evento.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short'
                });

                return (
                  <div 
                    key={evento.id} 
                    className="evento-resumo-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditEvent(evento);
                    }}
                  >
                    <div className="evento-resumo-date">{dataFormatada}</div>
                    <div className="evento-resumo-info">
                      <div className="evento-resumo-nome">{evento.evento}</div>
                      {evento.horario && (
                        <div className="evento-resumo-horario">🕐 {evento.horario}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {eventosDoMes.length > 3 && (
              <div className="ver-mais-eventos">
                +{eventosDoMes.length - 3} eventos este mês
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Evento */}
      {showEventModal && (
        <ModalEventoCalendario
          notaId={nota.id}
          selectedDate={selectedDate}
          editingEvent={editingEvent}
          membros={membros}
          usuarioId={usuarioId}
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