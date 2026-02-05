// src/components/ModalEventoCalendario.jsx
import React, { useState, useEffect } from "react";
import { FaTimes, FaTrash, FaPlus, FaChevronDown, FaChevronUp, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./ModalEventoCalendario.css";
import "./Listagem.css";

export default function ModalEventoCalendario({
  notaId,
  selectedDate,
  editingEvent,
  membros = [],
  usuarioId,
  onClose,
  onSave,
  projetoNome,
  notaNome,
  notaAtual,
  projetoAtual
}) {
  const nomeProjetoFinal = projetoNome || projetoAtual?.name || projetoAtual?.nome || "Projeto";
  const nomeNotaFinal = notaNome || notaAtual?.nome || "Calendário";
  const notaIdFinal = notaId || notaAtual?.id;

  const [formEvento, setFormEvento] = useState({
    evento: "",
    responsavel_id: "",
    horario_inicio: "",
    horario_termino: "",
    local: "",
    observacoes: ""
  });

  const [eventosNoDia, setEventosNoDia] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [statusSalvamento, setStatusSalvamento] = useState(null);
  const [dataSelecionada, setDataSelecionada] = useState(selectedDate);
  const [diasNavegacao, setDiasNavegacao] = useState([]);
  const [formularioExpandido, setFormularioExpandido] = useState(false);
  const [offsetDias, setOffsetDias] = useState(0);
  const [eventosDoMes, setEventosDoMes] = useState({});

  useEffect(() => {
    if (selectedDate) {
      const dataBase = new Date(selectedDate + 'T00:00:00');
      const dias = [];
      
      for (let i = -3; i <= 3; i++) {
        const data = new Date(dataBase);
        data.setDate(dataBase.getDate() + i + offsetDias);
        
        const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'short' });
        const diaMes = data.getDate();
        const mes = data.toLocaleDateString('pt-BR', { month: 'short' });
        const dataStr = data.toISOString().split('T')[0];
        
        const hoje = new Date().toISOString().split('T')[0];
        
        dias.push({
          data: dataStr,
          diaSemana,
          diaMes,
          mes,
          ehHoje: dataStr === hoje,
          ehSelecionado: dataStr === dataSelecionada
        });
      }
      
      setDiasNavegacao(dias);
    }
  }, [selectedDate, offsetDias, dataSelecionada]);

  useEffect(() => {
    loadEventosDoMes();
  }, [notaIdFinal, selectedDate, offsetDias]);

  useEffect(() => {
    if (editingEvent) {
      setFormEvento({
        evento: editingEvent.evento,
        responsavel_id: editingEvent.responsavel_id || "",
        horario_inicio: editingEvent.horario_inicio || "",
        horario_termino: editingEvent.horario_termino || "",
        local: editingEvent.local || "",
        observacoes: editingEvent.observacoes || ""
      });
      setFormularioExpandido(true);
    } else {
      setFormEvento({
        evento: "",
        responsavel_id: usuarioId || "",
        horario_inicio: "",
        horario_termino: "",
        local: "",
        observacoes: ""
      });
      setFormularioExpandido(false);
    }

    loadEventosNoDia();
  }, [editingEvent, dataSelecionada]);

  const loadEventosDoMes = async () => {
    if (!notaIdFinal) return;

    const dataBase = new Date(selectedDate + 'T00:00:00');
    const dataInicio = new Date(dataBase);
    dataInicio.setDate(dataBase.getDate() - 30 + offsetDias);
    const dataFim = new Date(dataBase);
    dataFim.setDate(dataBase.getDate() + 30 + offsetDias);

    const { data, error } = await supabase
      .from("eventos_calendario")
      .select("data")
      .eq("nota_id", notaIdFinal)
      .gte("data", dataInicio.toISOString().split('T')[0])
      .lte("data", dataFim.toISOString().split('T')[0]);

    if (!error && data) {
      const contagem = {};
      data.forEach(evento => {
        contagem[evento.data] = (contagem[evento.data] || 0) + 1;
      });
      setEventosDoMes(contagem);
    }
  };

  const loadEventosNoDia = async () => {
    if (!dataSelecionada || !notaIdFinal) return;

    const { data, error } = await supabase
      .from("eventos_calendario")
      .select("*")
      .eq("nota_id", notaIdFinal)
      .eq("data", dataSelecionada)
      .order("horario_inicio", { ascending: true });

    if (!error && data) {
      setEventosNoDia(data);
    }
  };

  const handleMudarDia = (data) => {
    setDataSelecionada(data);
  };

  const handleNavegacaoAnterior = () => {
    setOffsetDias(prev => prev - 1);
  };

  const handleNavegacaoProxima = () => {
    setOffsetDias(prev => prev + 1);
  };

  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatarHorario = (horario) => {
    if (!horario) return "";
    return horario.replace(":", "h");
  };

  const enviarNotificacoesEvento = async (eventoData, isNovo = true) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("nickname, nome")
        .eq("id", user.id)
        .single();

      const nomeUsuario = userProfile?.nickname || userProfile?.nome || "Usuário";

      const { data: nota } = await supabase
        .from("notas")
        .select("container_id")
        .eq("id", notaIdFinal)
        .single();

      if (!nota?.container_id) return;

      const { data: convites } = await supabase
        .from("convites")
        .select("user_id")
        .eq("container_id", nota.container_id)
        .eq("status", "aceito");

      if (!convites || convites.length === 0) return;

      const dataEvento = new Date(eventoData.data + 'T00:00:00');
      const diaFormatado = dataEvento.getDate();
      const mesFormatado = dataEvento.toLocaleDateString('pt-BR', { month: 'long' });

      const horarioTexto = eventoData.horario_inicio && eventoData.horario_termino
        ? `, no horário de ${eventoData.horario_inicio} às ${eventoData.horario_termino}`
        : eventoData.horario_inicio
        ? `, às ${eventoData.horario_inicio}`
        : "";

      const localTexto = eventoData.local ? `, no local ${eventoData.local}` : "";

      const mensagem = isNovo
        ? `${diaFormatado} de ${mesFormatado} - ${nomeUsuario} criou um novo evento chamado "${eventoData.evento}", para este dia${horarioTexto}${localTexto}.`
        : `${diaFormatado} de ${mesFormatado} - ${nomeUsuario} cancelou o evento "${eventoData.evento}".`;

      const notificacoes = convites
        .filter(c => c.user_id !== user.id)
        .map(c => ({
          user_id: c.user_id,
          remetente_id: user.id,
          mensagem: mensagem,
          tipo: "evento_calendario",
          tipo_nota: "Calendário",
          nota_id: notaIdFinal,
          container_id: nota.container_id,
          lido: false,
          created_at: new Date().toISOString()
        }));

      if (notificacoes.length > 0) {
        await supabase.from("notificacoes").insert(notificacoes);
      }
    } catch (err) {
      console.error("Erro ao enviar notificações:", err);
    }
  };

  const handleSaveEvento = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Você precisa estar autenticado para salvar eventos.");
      return;
    }

    if (!formEvento.evento.trim()) {
      alert("Por favor, preencha o nome do evento.");
      return;
    }

    if (formEvento.horario_inicio && formEvento.horario_termino) {
      const inicio = formEvento.horario_inicio.split(':').map(Number);
      const termino = formEvento.horario_termino.split(':').map(Number);
      
      const inicioMinutos = inicio[0] * 60 + inicio[1];
      const terminoMinutos = termino[0] * 60 + termino[1];
      
      if (terminoMinutos <= inicioMinutos) {
        alert("O horário de término deve ser posterior ao horário de início.");
        return;
      }
    }

    setStatusSalvamento("salvando");
    setSalvando(true);

    try {
      if (editingEvent) {
        const { error } = await supabase
          .from("eventos_calendario")
          .update({
            evento: formEvento.evento.trim(),
            responsavel_id: formEvento.responsavel_id || null,
            horario_inicio: formEvento.horario_inicio || null,
            horario_termino: formEvento.horario_termino || null,
            local: formEvento.local || null,
            observacoes: formEvento.observacoes || null
          })
          .eq("id", editingEvent.id);

        if (error) throw error;
      } else {
        const eventoData = {
          nota_id: notaIdFinal,
          data: dataSelecionada,
          evento: formEvento.evento.trim(),
          responsavel_id: formEvento.responsavel_id || null,
          horario_inicio: formEvento.horario_inicio || null,
          horario_termino: formEvento.horario_termino || null,
          local: formEvento.local || null,
          observacoes: formEvento.observacoes || null
        };

        const { error } = await supabase
          .from("eventos_calendario")
          .insert([eventoData]);

        if (error) throw error;

        await enviarNotificacoesEvento(eventoData, true);
      }

      setStatusSalvamento("sucesso");
      
      setFormEvento({
        evento: "",
        responsavel_id: usuarioId || "",
        horario_inicio: "",
        horario_termino: "",
        local: "",
        observacoes: ""
      });
      
      await loadEventosNoDia();
      await loadEventosDoMes();
      
      setTimeout(() => {
        setStatusSalvamento(null);
        setFormularioExpandido(false);
        onSave();
      }, 1000);
    } catch (err) {
      console.error("Erro ao salvar evento:", err);
      alert(`Erro ao salvar evento: ${err.message}`);
      setStatusSalvamento(null);
    } finally {
      setSalvando(false);
    }
  };

  const handleDeleteEvento = async (eventoId) => {
    if (!window.confirm("Deseja realmente excluir este evento?")) return;

    try {
      const { error } = await supabase
        .from("eventos_calendario")
        .delete()
        .eq("id", eventoId);

      if (!error) {
        await loadEventosNoDia();
        await loadEventosDoMes();
        if (editingEvent?.id === eventoId) {
          onClose();
        }
      }
    } catch (err) {
      console.error("Erro ao deletar evento:", err);
      alert("Erro ao deletar evento.");
    }
  };

  const handleEditarEvento = (evento) => {
    setFormEvento({
      evento: evento.evento,
      responsavel_id: evento.responsavel_id || "",
      horario_inicio: evento.horario_inicio || "",
      horario_termino: evento.horario_termino || "",
      local: evento.local || "",
      observacoes: evento.observacoes || ""
    });
    
    setFormularioExpandido(true);
  };

  const handleCancelar = () => {
    if (editingEvent) {
      onClose();
    } else {
      setFormularioExpandido(false);
      setFormEvento({
        evento: "",
        responsavel_id: usuarioId || "",
        horario_inicio: "",
        horario_termino: "",
        local: "",
        observacoes: ""
      });
    }
  };

  const renderBolinhasEventos = (quantidadeEventos) => {
    if (!quantidadeEventos || quantidadeEventos === 0) return null;
    
    const quantidade = Math.min(quantidadeEventos, 5);
    return (
      <div className="eventos-bolinhas">
        {Array.from({ length: quantidade }).map((_, index) => (
          <span key={index} className="bolinha-evento"></span>
        ))}
        {quantidadeEventos > 5 && <span className="mais-eventos">+</span>}
      </div>
    );
  };

  return (
    <div className="modal-overlay-evento" onClick={onClose}>
      <div className="modal-evento" onClick={(e) => e.stopPropagation()}>
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{nomeProjetoFinal}</span>
            <div className="sub-info">
              <span className="nota-name">{nomeNotaFinal}</span>
            </div>
          </div>
          <button
            className="listagem-close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <FaTimes />
          </button>
        </div>

        <div className="dias-navegacao-wrapper">
          <button 
            className="navegacao-seta navegacao-anterior"
            onClick={handleNavegacaoAnterior}
            title="Dia anterior"
          >
            <FaChevronLeft />
          </button>
          
          <div className="dias-navegacao-container">
            {diasNavegacao.map((dia, index) => {
              const quantidadeEventos = eventosDoMes[dia.data] || 0;
              
              return (
                <button
                  key={index}
                  className={`dia-navegacao-btn ${dia.ehSelecionado ? 'selecionado' : ''} ${dia.ehHoje ? 'hoje' : ''}`}
                  onClick={() => handleMudarDia(dia.data)}
                  title={`${dia.data} - ${quantidadeEventos} evento(s)`}
                >
                  <div className="dia-semana">{dia.diaSemana}</div>
                  <div className="dia-numero">{dia.diaMes}</div>
                  <div className="dia-mes">{dia.mes}</div>
                  {renderBolinhasEventos(quantidadeEventos)}
                </button>
              );
            })}
          </div>

          <button 
            className="navegacao-seta navegacao-proxima"
            onClick={handleNavegacaoProxima}
            title="Próximo dia"
          >
            <FaChevronRight />
          </button>
        </div>

        <div className="modal-evento-body">
          <div className="form-group">
            <div className="data-display-header">
              {dataSelecionada ? formatDateDisplay(dataSelecionada) : ""}
            </div>
          </div>

          {!editingEvent && (
            <button 
              className="btn-toggle-formulario"
              onClick={() => setFormularioExpandido(!formularioExpandido)}
            >
              <FaPlus />
              <span>Adicionar Evento</span>
              {formularioExpandido ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          )}

          {formularioExpandido && (
            <div className="formulario-evento-container">
              <div className="form-group">
                <label>Evento *</label>
                <input
                  type="text"
                  value={formEvento.evento}
                  onChange={(e) => setFormEvento(prev => ({ ...prev, evento: e.target.value }))}
                  placeholder="Nome do evento"
                  autoFocus
                />
              </div>

              <div className="form-group-horarios">
                <label>Horários</label>
                <div className="horarios-container">
                  <div className="horario-field">
                    <span className="horario-label">Início</span>
                    <input
                      type="time"
                      value={formEvento.horario_inicio}
                      onChange={(e) => setFormEvento(prev => ({ ...prev, horario_inicio: e.target.value }))}
                      placeholder="00:00"
                    />
                  </div>
                  <div className="horario-separator">—</div>
                  <div className="horario-field">
                    <span className="horario-label">Término</span>
                    <input
                      type="time"
                      value={formEvento.horario_termino}
                      onChange={(e) => setFormEvento(prev => ({ ...prev, horario_termino: e.target.value }))}
                      placeholder="00:00"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Responsável</label>
                <select
                  value={formEvento.responsavel_id}
                  onChange={(e) => setFormEvento(prev => ({ ...prev, responsavel_id: e.target.value }))}
                >
                  <option value="">Selecione um responsável</option>
                  {membros.map(membro => (
                    <option key={membro.id} value={membro.id}>
                      {membro.nickname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Local</label>
                <input
                  type="text"
                  value={formEvento.local}
                  onChange={(e) => setFormEvento(prev => ({ ...prev, local: e.target.value }))}
                  placeholder="Local do evento"
                />
              </div>

              <div className="form-group">
                <label>Observações</label>
                <textarea
                  value={formEvento.observacoes}
                  onChange={(e) => setFormEvento(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Observações sobre o evento..."
                  rows="4"
                />
              </div>

              <div className="form-action-buttons">
                <button
                  className="send-btn"
                  onClick={handleSaveEvento}
                  disabled={salvando || statusSalvamento === "salvando"}
                >
                  {editingEvent ? "Salvar" : "Criar"}
                  {statusSalvamento === "salvando" && (
                    <span className="loader-inline"></span>
                  )}
                </button>
                
                {editingEvent && (
                  <button 
                    className="btn-delete-evento" 
                    onClick={() => handleDeleteEvento(editingEvent.id)}
                  >
                    <FaTrash /> Excluir
                  </button>
                )}
                
                <button 
                  className="btn-cancelar" 
                  onClick={handleCancelar}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {eventosNoDia.length > 0 && (
            <div className="eventos-dia-lista">
              <h4>Eventos neste dia:</h4>
              {eventosNoDia.map(evento => {
                const responsavel = membros.find(m => m.id === evento.responsavel_id);
                return (
                  <div 
                    key={evento.id} 
                    className="evento-dia-item"
                    onClick={() => handleEditarEvento(evento)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="evento-dia-info">
                      <strong>{evento.evento}</strong>
                      {(evento.horario_inicio || evento.horario_termino) && (
                        <span>
                          🕐 {formatarHorario(evento.horario_inicio)} - {formatarHorario(evento.horario_termino)}
                        </span>
                      )}
                      {responsavel && <span>👤 {responsavel.nickname}</span>}
                      {evento.local && <span>📍 {evento.local}</span>}
                    </div>
                    <button
                      className="btn-delete-mini"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvento(evento.id);
                      }}
                      title="Excluir"
                    >
                      <FaTrash />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {eventosNoDia.length === 0 && !formularioExpandido && (
            <div className="sem-eventos-mensagem">
              <p>Nenhum evento neste dia.</p>
              <p>Clique em "Adicionar Evento" para criar um novo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}