// src/components/Agenda.jsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import "./Agenda.css";

const Agenda = ({ user, onClose }) => {
  const [objetivosCompletos, setObjetivosCompletos] = useState(null);
  const [comentariosAgendados, setComentariosAgendados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemType, setEditingItemType] = useState(null);
  const [editingDate, setEditingDate] = useState('');
  const [hideSemData, setHideSemData] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setError("Usuário não autenticado.");
      setLoading(false);
      return;
    }

    try {
      // ========== Objetivos ==========
      const { data: responsaveis, error: err1 } = await supabase
        .from("ata_objetivos_responsaveis_enriquecidos")
        .select("ata_objetivo_id")
        .eq("usuario_id", user.id);

      if (err1) throw err1;

      let objetivosCompletos = [];
      if (responsaveis && Array.isArray(responsaveis)) {
        const objetivoIds = responsaveis
          .map(r => r.ata_objetivo_id)
          .filter(id => id != null);

        if (objetivoIds.length > 0) {
          const { data: objetivos, error: err2 } = await supabase
            .from("ata_objetivos")
            .select("id, texto, data_entrega, ata_id, concluido")
            .in("id", objetivoIds)
            .order("data_entrega", { ascending: true });

          if (err2) throw err2;

          if (objetivos && Array.isArray(objetivos)) {
            const ataIds = [...new Set(objetivos.map(o => o.ata_id).filter(id => id != null))];
            let atasMap = {};
            const projetoIds = new Set();
            const pilhaIds = new Set();

            if (ataIds.length > 0) {
              const { data: atas, error: err3 } = await supabase
                .from("atas")
                .select("id, pilha, nota, projeto_id")
                .in("id", ataIds);

              if (err3) throw err3;
              if (Array.isArray(atas)) {
                atas.forEach(ata => {
                  atasMap[ata.id] = {
                    nota: ata.nota || "Sem nota",
                    pilha_id: ata.pilha,
                    projeto_id: ata.projeto_id,
                  };
                  if (ata.pilha) pilhaIds.add(ata.pilha);
                  if (ata.projeto_id) projetoIds.add(ata.projeto_id);
                });
              }
            }

            let pilhasMap = {};
            if (pilhaIds.size > 0) {
              const { data: pilhas, error: err4 } = await supabase
                .from("pilhas")
                .select("id, title")
                .in("id", Array.from(pilhaIds));
              if (!err4 && Array.isArray(pilhas)) {
                pilhasMap = Object.fromEntries(pilhas.map(p => [p.id, p.title]));
              }
            }

            let projetosMap = {};
            const userIdsDonos = new Set();
            if (projetoIds.size > 0) {
              const { data: projects, error: err5 } = await supabase
                .from("projects")
                .select("id, name, user_id")
                .in("id", Array.from(projetoIds));
              if (!err5 && Array.isArray(projects)) {
                projects.forEach(proj => {
                  projetosMap[proj.id] = {
                    nome: proj.name || "Projeto sem nome",
                    user_id: proj.user_id
                  };
                  if (proj.user_id) userIdsDonos.add(proj.user_id);
                });
              }
            }

            let donosMap = {};
            if (userIdsDonos.size > 0) {
              const { data: profiles, error: err6 } = await supabase
                .from("profiles")
                .select("id, nome, container")
                .in("id", Array.from(userIdsDonos));
              if (!err6 && Array.isArray(profiles)) {
                donosMap = Object.fromEntries(
                  profiles.map(p => [p.id, {
                    nomeDono: p.nome || "Usuário",
                    nomeContainer: p.container || p.nome || "Container sem nome"
                  }])
                );
              }
            }

            objetivosCompletos = objetivos.map(obj => {
              const ata = atasMap[obj.ata_id] || {};
              const projeto = ata.projeto_id ? projetosMap[ata.projeto_id] : null;
              const dono = projeto?.user_id ? donosMap[projeto.user_id] : null;

              return {
                ...obj,
                nomeNota: ata.nota,
                nomePilha: ata.pilha_id ? pilhasMap[ata.pilha_id] || "Pilha não encontrada" : "–",
                nomeProjeto: projeto ? projeto.nome : "–",
                nomeDono: dono ? dono.nomeDono : "Sem dono",
                nomeContainer: dono ? dono.nomeContainer : "Sem container",
                _chaveNota: obj.ata_id,
              };
            });
          }
        }
      }

      // ========== Comentários ==========
      const { data: comentarios, error: errComentarios } = await supabase
        .from("comentarios")
        .select("id, conteudo, created_at, nota_id, user_id, data_entrega")
        .eq("agendado_por", user.id)
        .order("created_at", { ascending: false });

      if (errComentarios) {
        console.warn("Erro ao carregar comentários agendados:", errComentarios);
      }

      let comentariosCompletos = [];
      if (comentarios && Array.isArray(comentarios) && comentarios.length > 0) {
        const userIdsAutores = [...new Set(comentarios.map(c => c.user_id).filter(id => id))];
        const notaIds = [...new Set(comentarios.map(c => c.nota_id).filter(id => id != null))];

        let autoresMap = {};
        if (userIdsAutores.length > 0) {
          const { data: autores, error: errAutores } = await supabase
            .from("profiles")
            .select("id, nome, nickname")
            .in("id", userIdsAutores);
          if (!errAutores && Array.isArray(autores)) {
            autoresMap = Object.fromEntries(
              autores.map(a => [a.id, a.nickname || a.nome || "Usuário"])
            );
          }
        }

        let notasMap = {};
        const pilhaIdsNotas = new Set();
        if (notaIds.length > 0) {
          const { data: notas, error: errNotas } = await supabase
            .from("notas")
            .select("id, nome, pilha_id")
            .in("id", notaIds);
          if (!errNotas && Array.isArray(notas)) {
            notas.forEach(nota => {
              notasMap[nota.id] = {
                nome: nota.nome || "Sem título",
                pilha_id: nota.pilha_id
              };
              if (nota.pilha_id) pilhaIdsNotas.add(nota.pilha_id);
            });
          }
        }

        let pilhasNotasMap = {};
        const projetoIdsDasPilhas = new Set();
        if (pilhaIdsNotas.size > 0) {
          const { data: pilhas, error: errPilhas } = await supabase
            .from("pilhas")
            .select("id, title, project_id")
            .in("id", Array.from(pilhaIdsNotas));
          if (!errPilhas && Array.isArray(pilhas)) {
            pilhas.forEach(p => {
              pilhasNotasMap[p.id] = {
                title: p.title || "Pilha sem nome",
                project_id: p.project_id
              };
              if (p.project_id) projetoIdsDasPilhas.add(p.project_id);
            });
          }
        }

        let projetosNotasMap = {};
        if (projetoIdsDasPilhas.size > 0) {
          const { data: projetos, error: errProjetos } = await supabase
            .from("projects")
            .select("id, name")
            .in("id", Array.from(projetoIdsDasPilhas));
          if (!errProjetos && Array.isArray(projetos)) {
            projetosNotasMap = Object.fromEntries(
              projetos.map(p => [p.id, p.name || "Projeto sem nome"])
            );
          }
        }

        comentariosCompletos = comentarios.map(com => {
          const nota = notasMap[com.nota_id] || {};
          const pilha = nota.pilha_id ? pilhasNotasMap[nota.pilha_id] : null;

          return {
            ...com,
            nomeAutor: autoresMap[com.user_id] || "Usuário",
            nomeNota: nota.nome || (com.nota_id ? "Nota não encontrada" : "Sem nota"),
            nomeProjeto: pilha?.project_id
              ? projetosNotasMap[pilha.project_id] || "Projeto não encontrado"
              : "Sem projeto",
            nomePilha: pilha ? pilha.title : "Sem pilha",
            nomeDono: "Não informado",
            nomeContainer: "Não informado",
            _chaveNota: com.nota_id,
          };
        });
      }

      setObjetivosCompletos(objetivosCompletos);
      setComentariosAgendados(comentariosCompletos);
      setError(null);
    } catch (err) {
      console.error("Erro ao carregar agenda:", err);
      setError({
        message: err.message || "Erro desconhecido",
        details: err.details,
        code: err.code,
      });
      setObjetivosCompletos([]);
      setComentariosAgendados([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =============== Funções auxiliares ===============
  const getMonthNameShort = (monthIndex) => {
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return months[monthIndex - 1] || "???";
  };

  const getFullDateLabel = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const mes = String(month).padStart(2, '0');
    const diasSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    const diaSemana = diasSemana[d.getDay()];
    return `${day}/${mes} - ${diaSemana}`;
  };

  const calcularDiasRestantes = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataAlvo = new Date(year, month - 1, day);
    dataAlvo.setHours(0, 0, 0, 0);
    const diffTime = dataAlvo - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusLabel = (dias, isConcluido) => {
    if (isConcluido) return "✓";
    if (dias === null) return "?";
    if (dias < 0) return `${dias} DIAS`;
    if (dias === 0) return "HOJE";
    return `${dias} DIAS`;
  };

  const getStatusClass = (dias, isConcluido) => {
    if (isConcluido) return "completed-status";
    if (dias === null) return "";
    if (dias < 0) return "overdue";
    if (dias === 0) return "today";
    return "remaining";
  };

  const toggleConcluido = async (item) => {
    if (item.tipo !== 'objetivo' || item.concluido) return;

    const novoValor = true;
    const { error } = await supabase
      .from("ata_objetivos")
      .update({ concluido: novoValor })
      .eq("id", item.id);
    if (error) return console.error("Erro ao atualizar conclusão:", error);
    setObjetivosCompletos(prev =>
      prev.map(obj => obj.id === item.id ? { ...obj, concluido: novoValor } : obj)
    );
  };

  const handleDateClick = (item) => {
    setEditingItemId(item.id);
    setEditingItemType(item.tipo);
    setEditingDate(item.data_entrega || '');
  };

  const handleSave = async () => {
    if (!editingItemId || !editingItemType) return;

    const dateToSave = editingDate || null;
    let error = null;

    if (editingItemType === 'objetivo') {
      ({ error } = await supabase
        .from("ata_objetivos")
        .update({ data_entrega: dateToSave })
        .eq("id", editingItemId));
    } else {
      ({ error } = await supabase
        .from("comentarios")
        .update({ data_entrega: dateToSave })
        .eq("id", editingItemId));
    }

    if (error) return console.error("Erro ao salvar data:", error);

    if (editingItemType === 'objetivo') {
      setObjetivosCompletos(prev =>
        prev.map(obj => obj.id === editingItemId ? { ...obj, data_entrega: dateToSave } : obj)
      );
    } else {
      setComentariosAgendados(prev =>
        prev.map(com => com.id === editingItemId ? { ...com, data_entrega: dateToSave } : com)
      );
    }

    setEditingItemId(null);
    setEditingItemType(null);
    setEditingDate('');
  };

  const handleCancel = () => {
    setEditingItemId(null);
    setEditingItemType(null);
    setEditingDate('');
  };

  // =============== Agrupamento por ano/mês ===============
  const itensComData = [];
  const itensSemData = [];

  objetivosCompletos?.forEach(obj => {
    if (obj.data_entrega) {
      itensComData.push({ ...obj, tipo: 'objetivo', data_ref: obj.data_entrega });
    } else {
      itensSemData.push({ ...obj, tipo: 'objetivo' });
    }
  });

  comentariosAgendados?.forEach(com => {
    if (com.data_entrega) {
      itensComData.push({ ...com, tipo: 'comentario', data_ref: com.data_entrega });
    } else {
      itensSemData.push({ ...com, tipo: 'comentario' });
    }
  });

  // Extrair anos únicos com itens
  const anosComItens = [...new Set(
    itensComData.map(item => parseInt(item.data_ref.split('-')[0], 10))
  )].sort((a, b) => a - b);

  if (anosComItens.length > 0 && !anosComItens.includes(selectedYear)) {
    // Se o ano selecionado não tem dados, ajusta para o primeiro ano disponível
    setSelectedYear(anosComItens[0]);
  }

  // Agrupar por data
  const itensPorData = {};
  itensComData.forEach(item => {
    if (!itensPorData[item.data_ref]) itensPorData[item.data_ref] = [];
    itensPorData[item.data_ref].push(item);
  });

  const datasOrdenadas = Object.keys(itensPorData).sort();
  const diasDoMesSelecionado = datasOrdenadas.filter(dateKey => {
    const [y, m] = dateKey.split('-').map(Number);
    return y === selectedYear && m === selectedMonth;
  });

  // =============== Render ===============
  if (itensComData.length === 0 && itensSemData.length === 0 && !loading && !error) {
    return (
      <div className="agenda-modal-overlay" onClick={onClose}>
        <div className="agenda-modal" onClick={e => e.stopPropagation()}>
          <div className="agenda-header">
            <h2>📅 Minha Agenda</h2>
            <button className="agenda-close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="agenda-content">
            <p className="agenda-empty">Você não tem itens na agenda.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agenda-modal-overlay" onClick={onClose}>
      <div className="agenda-modal" onClick={e => e.stopPropagation()}>
        <div className="agenda-header">
          <h2>📅 Minha Agenda</h2>
          <button className="agenda-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="agenda-content">
          {loading && <p className="agenda-loading">Carregando...</p>}
          {error && <div className="agenda-error"><strong>Erro:</strong> {error.message}</div>}

          {!loading && !error && (
            <div className="container">
              <header>
                <h1>Minha agenda</h1>
              </header>

              {/* Botões de ano */}
              {anosComItens.length > 0 && (
                <div className="years">
                  {anosComItens.map(ano => (
                    <button
                      key={ano}
                      className={`year-btn ${selectedYear === ano ? 'selected' : ''}`}
                      onClick={() => setSelectedYear(ano)}
                    >
                      {ano}
                    </button>
                  ))}
                </div>
              )}

              {/* Botões de mês */}
              <div className="months">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <button
                    key={m}
                    className={`month ${selectedMonth === m ? 'selected' : ''}`}
                    onClick={() => setSelectedMonth(m)}
                  >
                    {getMonthNameShort(m)}
                  </button>
                ))}
              </div>

              {/* Itens com data no mês/ano selecionado */}

              {diasDoMesSelecionado.length > 0 ? (
                diasDoMesSelecionado.map(dateKey => {
                  const itens = itensPorData[dateKey];
                  const grupos = {};
                  itens.forEach(item => {
                    const key = item._chaveNota || `n_${item.id}`;
                    if (!grupos[key]) grupos[key] = [];
                    grupos[key].push(item);
                  });

                  return Object.entries(grupos).map(([key, grupo]) => {
                    const ref = grupo[0];
                    return (
                      <article key={key} className="day" data-month={selectedMonth}>
                        <div className="day-header">
                          <div>
                            <div className="date">{getFullDateLabel(dateKey)}</div>
                            <div className="project">{ref.nomeNota}</div>
                            <div className="project-sub">
                              {ref.nomePilha} • {ref.nomeProjeto} ({ref.nomeDono} • {ref.nomeContainer})
                            </div>
                          </div>
                        </div>
                        {grupo.map(item => {
                          const dias = calcularDiasRestantes(item.data_entrega);
                          const isConcluido = item.tipo === 'objetivo' && item.concluido;
                          return (
                            <div key={`${item.tipo}-${item.id}`} className={`task ${isConcluido ? 'completed' : ''}`}>
                              <div
                                className={`check ${isConcluido ? 'disabled' : ''}`}
                                onClick={() => toggleConcluido(item)}
                              >
                                {isConcluido ? '✓' : ''}
                              </div>
                              <div className="body">
                                <div className="title">
                                  {item.tipo === 'objetivo' ? item.texto : `"${item.conteudo}"`}
                                </div>
                                {item.tipo === 'comentario' && (
                                  <div className="meta small">Autor: {item.nomeAutor}</div>
                                )}
                              </div>
                              <div className={`status ${getStatusClass(dias, isConcluido)}`}>
                                {getStatusLabel(dias, isConcluido)}
                              </div>
                            </div>
                          );
                        })}
                      </article>
                    );
                  });
                })
              ) : (
                <div className="agenda-empty-month">
                  A agenda está vazia para {getMonthNameShort(selectedMonth).toLowerCase()} de {selectedYear}.
                </div>
              )}

              {/* Tarefas sem data */}
              {itensSemData.length > 0 && (
                <>
                  <div
                    className="no-date"
                    style={{
                      backgroundColor: hideSemData ? '#bdbdbd' : '#e6f4ea',
                      color: hideSemData ? '#fff' : '#222',
                    }}
                  >
                    TAREFAS SEM DATA
                    <button
                      className="toggle-sem-data-btn"
                      onClick={() => setHideSemData(!hideSemData)}
                      aria-label={hideSemData ? "Mostrar tarefas sem data" : "Esconder tarefas sem data"}
                    >
                      {hideSemData ? (
                        <i className="fa-solid fa-eye"></i>
                      ) : (
                        <i className="fa-solid fa-eye-slash"></i>
                      )}
                    </button>
                  </div>
                  {!hideSemData && (
                    <>
                      {itensSemData.map(item => {
                        const isConcluido = item.tipo === 'objetivo' && item.concluido;
                        return (
                          <article key={`${item.tipo}-${item.id}`} className="day" data-month="none" style={{ marginTop: '14px' }}>
                            <div className="day-header">
                              <div>
                                {editingItemId === item.id && editingItemType === item.tipo ? (
                                  <div className="date-edit-row">
                                    <input
                                      type="date"
                                      value={editingDate}
                                      readOnly
                                      onChange={e => setEditingDate(e.target.value)}
                                    />
                                    <button onClick={handleSave}>Salvar</button>
                                    <button onClick={handleCancel}>Cancelar</button>
                                  </div>
                                ) : (
                                  <div>
                                    <input
                                      type="date"
                                      readOnly
                                      value=""
                                      onClick={() => handleDateClick(item)}
                                      className="empty-date-input"
                                    />
                                  </div>
                                )}
                                <div className="project">{item.nomeNota}</div>
                                <div className="project-sub">
                                  {item.nomePilha} • {item.nomeProjeto} ({item.nomeDono} • {item.nomeContainer})
                                </div>
                              </div>
                            </div>
                            <div className={`task ${isConcluido ? 'completed' : ''}`}>
                              <div
                                className={`check ${isConcluido ? 'disabled' : ''}`}
                                onClick={() => toggleConcluido(item)}
                              >
                                {isConcluido ? '✓' : ''}
                              </div>
                              <div className="body">
                                <div className="title">
                                  {item.tipo === 'objetivo' ? item.texto : `"${item.conteudo}"`}
                                </div>
                                {item.tipo === 'comentario' && (
                                  <div className="meta small">Autor: {item.nomeAutor}</div>
                                )}
                              </div>
                              <div className={`status ${getStatusClass(null, isConcluido)}`}>
                                {getStatusLabel(null, isConcluido)}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agenda;