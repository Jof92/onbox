// src/components/Agenda.jsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import "./Agenda.css";
import { FaTimes } from "react-icons/fa";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const Agenda = ({ user, currentContainerId, onClose }) => {
  const [objetivosCompletos, setObjetivosCompletos] = useState(null);
  const [comentariosAgendados, setComentariosAgendados] = useState(null);
  const [notasRapidasCompletas, setNotasRapidasCompletas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemType, setEditingItemType] = useState(null);
  const [editingDate, setEditingDate] = useState('');
  const [hideSemData, setHideSemData] = useState(true);
  const [hoveredNotaId, setHoveredNotaId] = useState(null);
  const [showSidebarAgenda, setShowSidebarAgenda] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (e.target.classList.contains("agenda-modal-overlay")) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const normalizarTexto = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w]/g, "")
      .trim();
  };

  const fetchData = useCallback(async () => {
    if (!user?.id || !currentContainerId) {
      setError("Usuário ou container não definidos.");
      setLoading(false);
      return;
    }

    try {
      const { data: pref, error: prefErr } = await supabase
        .from("user_preferences")
        .select("value")
        .eq("user_id", user.id)
        .eq("container_id", currentContainerId)
        .eq("key", "show_sidebar_agenda")
        .single();

      if (!prefErr) {
        setShowSidebarAgenda(pref?.value || false);
      } else if (prefErr.code !== "PGRST116") {
        console.warn("Erro ao carregar preferência:", prefErr);
      }
    } catch (err) {
      console.warn("Exceção ao carregar preferência", err);
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
            const mapaUnicos = new Map();
            objetivos.forEach(obj => {
              if (obj.texto?.startsWith("[EXCLUIDO]")) return;
              const norm = normalizarTexto(obj.texto);
              if (!mapaUnicos.has(norm) || obj.id > mapaUnicos.get(norm).id) {
                mapaUnicos.set(norm, obj);
              }
            });
            const objetivosUnicos = Array.from(mapaUnicos.values());

            const ataIds = [...new Set(objetivosUnicos.map(o => o.ata_id).filter(id => id != null))];
            let atasMap = {};
            const projetoIds = new Set();
            const pilhaIds = new Set();
            const notaIds = new Set();

            if (ataIds.length > 0) {
              const { data: atas, error: err3 } = await supabase
                .from("atas")
                .select("id, nota_id, pilha_id, projeto_id, setor_id")
                .in("id", ataIds);

              if (err3) throw err3;
              if (Array.isArray(atas)) {
                atas.forEach(ata => {
                  atasMap[ata.id] = {
                    nota_id: ata.nota_id,
                    pilha_id: ata.pilha_id,
                    projeto_id: ata.projeto_id,
                    setor_id: ata.setor_id,
                  };
                  if (ata.nota_id) notaIds.add(ata.nota_id);
                  if (ata.pilha_id) pilhaIds.add(ata.pilha_id);
                  if (ata.projeto_id) projetoIds.add(ata.projeto_id);
                });
              }
            }

            let notasMap = {};
            if (notaIds.size > 0) {
              const { data: notas, error: errNotas } = await supabase
                .from("notas")
                .select("id, nome")
                .in("id", Array.from(notaIds));
              if (!errNotas && Array.isArray(notas)) {
                notasMap = Object.fromEntries(
                  notas.map(n => [n.id, n.nome || "Nota sem título"])
                );
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

            objetivosCompletos = objetivosUnicos.map(obj => {
              const ata = atasMap[obj.ata_id] || {};
              const projeto = ata.projeto_id ? projetosMap[ata.projeto_id] : null;
              const dono = projeto?.user_id ? donosMap[projeto.user_id] : null;
              const nomeNota = ata.nota_id ? (notasMap[ata.nota_id] || "Nota não encontrada") : "Nota não associada";

              return {
                ...obj,
                nomeNota,
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

        // ========== Notas Rápidas ==========
        // Busca todas as notas rápidas com data_entrega
        const { data: todasNotasRapidas, error: errNotasRapidas } = await supabase
          .from("notas")
          .select("id, nome, descricao, data_entrega, pilha_id, responsavel_id, responsaveis_ids, created_at, concluida")
          .eq("tipo", "Nota Rápida")
          .not("data_entrega", "is", null)
          .order("data_entrega", { ascending: true });

        console.log("🔍 Todas notas rápidas:", todasNotasRapidas);
        console.log("🔍 User ID:", user.id);

        // Filtra apenas as que o usuário é responsável ou está na lista de responsáveis
        const notasRapidas = todasNotasRapidas?.filter(nota => {
          const eResponsavel = nota.responsavel_id === user.id;
          const estaNoArray = nota.responsaveis_ids && Array.isArray(nota.responsaveis_ids) && nota.responsaveis_ids.includes(user.id);
          
          console.log(`Nota ${nota.id}:`, {
            responsavel_id: nota.responsavel_id,
            responsaveis_ids: nota.responsaveis_ids,
            eResponsavel,
            estaNoArray,
            passa: eResponsavel || estaNoArray
          });
          
          return eResponsavel || estaNoArray;
        }) || [];

        console.log("✅ Notas filtradas:", notasRapidas);
      
      if (notasRapidas && Array.isArray(notasRapidas) && notasRapidas.length > 0) {
        const pilhaIdsNotas = [...new Set(notasRapidas.map(n => n.pilha_id).filter(id => id))];
        
        let pilhasMap = {};
        const projetoIdsDasPilhas = new Set();
        
        if (pilhaIdsNotas.length > 0) {
          const { data: pilhas, error: errPilhas } = await supabase
            .from("pilhas")
            .select("id, title, project_id")
            .in("id", pilhaIdsNotas);
            
          if (!errPilhas && Array.isArray(pilhas)) {
            pilhas.forEach(p => {
              pilhasMap[p.id] = {
                title: p.title || "Pilha sem nome",
                project_id: p.project_id
              };
              if (p.project_id) projetoIdsDasPilhas.add(p.project_id);
            });
          }
        }
        
        let projetosMap = {};
        const userIdsDonos = new Set();
        
        if (projetoIdsDasPilhas.size > 0) {
          const { data: projetos, error: errProjetos } = await supabase
            .from("projects")
            .select("id, name, user_id")
            .in("id", Array.from(projetoIdsDasPilhas));
            
          if (!errProjetos && Array.isArray(projetos)) {
            projetos.forEach(proj => {
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
          const { data: profiles, error: errProfiles } = await supabase
            .from("profiles")
            .select("id, nome, container")
            .in("id", Array.from(userIdsDonos));
            
          if (!errProfiles && Array.isArray(profiles)) {
            donosMap = Object.fromEntries(
              profiles.map(p => [p.id, {
                nomeDono: p.nome || "Usuário",
                nomeContainer: p.container || p.nome || "Container sem nome"
              }])
            );
          }
        }
        
        notasRapidasCompletas = notasRapidas.map(nota => {
          const pilha = nota.pilha_id ? pilhasMap[nota.pilha_id] : null;
          const projeto = pilha?.project_id ? projetosMap[pilha.project_id] : null;
          const dono = projeto?.user_id ? donosMap[projeto.user_id] : null;
          
          return {
            ...nota,
            nomeNota: nota.nome || "Nota rápida sem título",
            nomePilha: pilha ? pilha.title : "Sem pilha",
            nomeProjeto: projeto ? projeto.nome : "Sem projeto",
            nomeDono: dono ? dono.nomeDono : "Sem dono",
            nomeContainer: dono ? dono.nomeContainer : "Sem container",
            _chaveNota: nota.id,
          };
        });
      }

      // ========== Comentários ==========
      const { data: comentarios, error: errComentarios } = await supabase
        .from("comentarios")
        .select("id, conteudo, created_at, nota_id, user_id, data_entrega")
        .eq("agendado_por", user.id)
        .order("created_at", { ascending: false });

      if (errComentarios && errComentarios.code !== "PGRST116") {
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
      setNotasRapidasCompletas(notasRapidasCompletas);
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
      setNotasRapidasCompletas([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, currentContainerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getMonthNameShort = (monthIndex) => {
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return months[monthIndex - 1] || "???";
  };

  const getFullDateLabel = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const mes = String(month).padStart(2, '0');
    const diasSemana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    const diaSemana = diasSemana[new Date(year, month - 1, day).getDay()];
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
    if (dias === null) return "";
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
    if (item.concluido || item.concluida) return;

    const novoValor = true;
    let error = null;

    if (item.tipo === 'objetivo') {
      ({ error } = await supabase
        .from("ata_objetivos")
        .update({ concluido: novoValor })
        .eq("id", item.id));
        
      if (!error) {
        setObjetivosCompletos(prev =>
          prev.map(obj => obj.id === item.id ? { ...obj, concluido: novoValor } : obj)
        );
      }
    } else if (item.tipo === 'nota_rapida') {
      ({ error } = await supabase
        .from("notas")
        .update({ concluida: novoValor })
        .eq("id", item.id));
        
      if (!error) {
        setNotasRapidasCompletas(prev =>
          prev.map(nota => nota.id === item.id ? { ...nota, concluida: novoValor } : nota)
        );
      }
    }
    
    if (error) {
      console.error("Erro ao atualizar conclusão:", error);
    }
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
        
      if (!error) {
        setObjetivosCompletos(prev =>
          prev.map(obj => obj.id === editingItemId ? { ...obj, data_entrega: dateToSave } : obj)
        );
      }
    } else if (editingItemType === 'comentario') {
      ({ error } = await supabase
        .from("comentarios")
        .update({ data_entrega: dateToSave })
        .eq("id", editingItemId));
        
      if (!error) {
        setComentariosAgendados(prev =>
          prev.map(com => com.id === editingItemId ? { ...com, data_entrega: dateToSave } : com)
        );
      }
    } else if (editingItemType === 'nota_rapida') {
      ({ error } = await supabase
        .from("notas")
        .update({ data_entrega: dateToSave })
        .eq("id", editingItemId));
        
      if (!error) {
        setNotasRapidasCompletas(prev =>
          prev.map(nota => nota.id === editingItemId ? { ...nota, data_entrega: dateToSave } : nota)
        );
      }
    }

    if (error) {
      console.error("Erro ao salvar data:", error);
      return;
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

  const handleExcluirDaAgenda = async (item) => {
    const descricao = item.tipo === 'objetivo' 
      ? item.texto 
      : item.tipo === 'comentario'
      ? item.conteudo
      : item.descricao || item.nome || "esta nota";
      
    if (window.confirm(`Deseja remover "${descricao}" da agenda?`)) {
      let error = null;

      if (item.tipo === 'objetivo') {
        ({ error } = await supabase
          .from("ata_objetivos")
          .update({ texto: `[EXCLUIDO] ${item.texto}` })
          .eq("id", item.id));
          
        if (!error) {
          setObjetivosCompletos(prev => prev.filter(obj => obj.id !== item.id));
        }
      } else if (item.tipo === 'comentario') {
        ({ error } = await supabase
          .from("comentarios")
          .update({ agendado_por: null })
          .eq("id", item.id));
          
        if (!error) {
          setComentariosAgendados(prev => prev.filter(com => com.id !== item.id));
        }
      } else if (item.tipo === 'nota_rapida') {
        ({ error } = await supabase
          .from("notas")
          .update({ data_entrega: null })
          .eq("id", item.id));
          
        if (!error) {
          setNotasRapidasCompletas(prev => prev.filter(nota => nota.id !== item.id));
        }
      }

      if (error) {
        console.error("Erro ao excluir da agenda:", error);
        alert("Erro ao remover item da agenda.");
      }
    }
  };

  const toggleSidebarAgenda = async (checked) => {
    if (!user?.id || !currentContainerId) return;

    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          container_id: currentContainerId,
          key: "show_sidebar_agenda",
          value: checked,
        },
        { onConflict: "user_id,container_id,key" }
      );

    if (error) {
      console.error("Erro ao salvar preferência:", error);
      return;
    }

    setShowSidebarAgenda(checked);
    window.dispatchEvent(new CustomEvent('agendaPreferenceUpdated'));
  };

  // =============== Agrupamento ===============
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

  notasRapidasCompletas?.forEach(nota => {
    if (nota.data_entrega) {
      itensComData.push({ ...nota, tipo: 'nota_rapida', data_ref: nota.data_entrega });
    } else {
      itensSemData.push({ ...nota, tipo: 'nota_rapida' });
    }
  });

  const anosComItens = [...new Set(
    itensComData.map(item => parseInt(item.data_ref.split('-')[0], 10))
  )].sort((a, b) => a - b);

  if (anosComItens.length > 0 && !anosComItens.includes(selectedYear)) {
    setSelectedYear(anosComItens[0]);
  }

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

  if (itensComData.length === 0 && itensSemData.length === 0 && !loading && !error) {
    return (
      <div className="agenda-modal-overlay">
        <div className="agenda-modal">
          <div className="agenda-header">
            <h2>Minha Agenda</h2>
            <button className="agenda-close-btn" onClick={onClose} aria-label="Fechar">
              <FaTimes />
            </button>
          </div>
          <div className="agenda-content">
            <p className="agenda-empty">Você não tem itens na agenda.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agenda-modal-overlay">
      <div className="agenda-modal">
        <div className="agenda-header">
          <h2>Minha Agenda</h2>
          <button className="agenda-close-btn" onClick={onClose} aria-label="Fechar">
            <FaTimes />
          </button>
        </div>

        <div className="agenda-content">
          {loading && (
            <div className="agenda-loading-animation">
              <DotLottieReact
                src="https://lottie.host/9780c0a4-579c-4cdb-a974-4205aa670757/qDN0lkVs2V.lottie"
                loop
                autoplay
                style={{ width: '120px', height: '120px', justifyContent: "center" }}
              />
            </div>
          )}
          {error && <div className="agenda-error"><strong>Erro:</strong> {error.message}</div>}

          {!loading && !error && (
            <div className="container">
              <div className="agenda-sidebar-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={showSidebarAgenda}
                    onChange={(e) => toggleSidebarAgenda(e.target.checked)}
                  />
                  &nbsp;exibir agenda no container?
                </label>
              </div>

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
                            <div className="project">
                              <div
                                className="agenda-project-item"
                                onMouseEnter={() => setHoveredNotaId(ref._chaveNota)}
                                onMouseLeave={() => setHoveredNotaId(null)}
                              >
                                <span>{ref.nomeNota}</span>
                                {hoveredNotaId === ref._chaveNota && (
                                  <svg
                                    className="delete-icon"
                                    stroke="currentColor"
                                    fill="currentColor"
                                    strokeWidth="0"
                                    viewBox="0 0 448 512"
                                    height="1em"
                                    width="1em"
                                    xmlns="http://www.w3.org/2000/svg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExcluirDaAgenda(grupo[0]);
                                    }}
                                    title="Remover da agenda"
                                    aria-label="Remover da agenda"
                                  >
                                    <path d="M432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16zM53.2 467a48 48 0 0 0 47.9 45h245.8a48 48 0 0 0 47.9-45L416 128H32z"></path>
                                  </svg>
                                )}
                              </div>
                            </div>
                            <div className="project-sub">
                              {ref.nomePilha} • {ref.nomeProjeto} ({ref.nomeDono} • {ref.nomeContainer})
                            </div>
                          </div>
                        </div>
                        {grupo.map(item => {
                          const dias = calcularDiasRestantes(item.data_entrega);
                          const isConcluido = (item.tipo === 'objetivo' && item.concluido) || 
                                             (item.tipo === 'nota_rapida' && item.concluida);
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
                                  {item.tipo === 'objetivo' 
                                    ? item.texto 
                                    : item.tipo === 'comentario'
                                    ? `"${item.conteudo}"`
                                    : item.descricao || item.nome || "Nota rápida"}
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

              {itensSemData.length > 0 && (
                <>
                  <div
                    className="no-date"
                    style={{
                      backgroundColor: hideSemData ? '#bdbdbd' : '#e6f4ea',
                      color: hideSemData ? '#fff' : '#222',
                    }}
                  >
                    TAREFAS SEM DATA ({itensSemData.length})
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
                        const isConcluido = (item.tipo === 'objetivo' && item.concluido) || 
                                           (item.tipo === 'nota_rapida' && item.concluida);
                        const isEditing = editingItemId === item.id && editingItemType === item.tipo;

                        return (
                          <article key={`${item.tipo}-${item.id}`} className="day" data-month="none" style={{ marginTop: '14px' }}>
                            <div className="day-header">
                              <div>
                                {isEditing ? (
                                  <div className="date-edit-row">
                                    <input
                                      type="date"
                                      value={editingDate}
                                      onChange={(e) => setEditingDate(e.target.value)}
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
                                      placeholder="Adicionar data"
                                    />
                                  </div>
                                )}
                                <div className="project">
                                  <div
                                    className="agenda-project-item"
                                    onMouseEnter={() => setHoveredNotaId(item._chaveNota)}
                                    onMouseLeave={() => setHoveredNotaId(null)}
                                  >
                                    <span>{item.nomeNota}</span>
                                    {hoveredNotaId === item._chaveNota && (
                                      <svg
                                        className="delete-icon"
                                        stroke="currentColor"
                                        fill="currentColor"
                                        strokeWidth="0"
                                        viewBox="0 0 448 512"
                                        height="1em"
                                        width="1em"
                                        xmlns="http://www.w3.org/2000/svg"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleExcluirDaAgenda(item);
                                        }}
                                        title="Remover da agenda"
                                        aria-label="Remover da agenda"
                                      >
                                        <path d="M432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16zM53.2 467a48 48 0 0 0 47.9 45h245.8a48 48 0 0 0 47.9-45L416 128H32z"></path>
                                      </svg>
                                    )}
                                  </div>
                                </div>
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
                                  {item.tipo === 'objetivo' 
                                    ? item.texto 
                                    : item.tipo === 'comentario'
                                    ? `"${item.conteudo}"`
                                    : item.descricao || item.nome || "Nota rápida"}
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