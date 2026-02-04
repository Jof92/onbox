// src/components/Cards.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Cards.css";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { FaPlus } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ModalNota from "./ModalNota";
import ListagemEspelho from "./ListagemEspelho";
import Column from "./CardsColumn";
import CardsHeader from "./CardsHeader";

export default function Cards() {
  const location = useLocation();
  const navigate = useNavigate();

  const [entity, setEntity] = useState(null);
  const [columnsNormais, setColumnsNormais] = useState([]);
  const [columnsArquivadas, setColumnsArquivadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("project");
  const [modoArquivadas, setModoArquivadas] = useState(false);

  const [activeColumnId, setActiveColumnId] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState("");

  const [formData, setFormData] = useState({ nome: "", responsavel: "", tipo: "" });
  const [notaEditData, setNotaEditData] = useState({ id: null, nome: "", responsavel: "", pilhaId: null });
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [usuarioAtual, setUsuarioAtual] = useState("Usuário Atual");
  const [usuarioId, setUsuarioId] = useState(null);
  const [notaProgresso, setNotaProgresso] = useState({});
  const [menuOpenNota, setMenuOpenNota] = useState(null);
  const [menuOpenPilha, setMenuOpenPilha] = useState(null);
  const [projetoOrigem, setProjetoOrigem] = useState(null);
  const [notaOrigem, setNotaOrigem] = useState(null);
  const [donoContainerId, setDonoContainerId] = useState(null);
  const [isNotaRecebidos, setIsNotaRecebidos] = useState(false);

  const [showColorPicker, setShowColorPicker] = useState({});
  const [notasConcluidas, setNotasConcluidas] = useState(new Set());
  const [dataConclusaoEdit, setDataConclusaoEdit] = useState({});
  const [dataConclusaoSalva, setDataConclusaoSalva] = useState({});
  const [membros, setMembros] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddColumnMenu, setShowAddColumnMenu] = useState(false);
  const [dataEntregaEdit, setDataEntregaEdit] = useState({});
  const [dataEntregaSalva, setDataEntregaSalva] = useState({});

  const [expandedColumnId, setExpandedColumnId] = useState(null);
  const [expandedNotaView, setExpandedNotaView] = useState(null);

  const atualizarStatusNota = (notaId, updates) => {
    const setter = modoArquivadas ? setColumnsArquivadas : setColumnsNormais;
    setter(prev =>
      prev.map(col => ({
        ...col,
        notas: col.notas.map(nota => nota.id === notaId ? { ...nota, ...updates } : nota),
      }))
    );
  };

  const updateUrlWithNota = (notaId) => {
    const urlParams = new URLSearchParams(location.search);
    
    if (notaId) {
      urlParams.set('nota', notaId);
    } else {
      urlParams.delete('nota');
    }
    
    const newUrl = `${location.pathname}?${urlParams.toString()}`;
    navigate(newUrl, { replace: false });
  };

  const handleSaveNomeRapida = async (notaId, novoNome) => {
    if (!novoNome.trim()) return;
    const { error } = await supabase.from("notas").update({ nome: novoNome.trim() }).eq("id", notaId);
    if (!error) atualizarStatusNota(notaId, { nome: novoNome.trim() });
  };

  const handleSaveResponsavelRapida = async (notaId, userId) => {
    if (!userId) {
      return;
    }

    const { data: notaAtual, error: fetchError } = await supabase
      .from("notas")
      .select("responsaveis_ids")
      .eq("id", notaId)
      .single();

    if (fetchError) {
      alert("Erro ao atualizar responsável.");
      return;
    }

    const idsExistentes = notaAtual.responsaveis_ids || [];
    const jaTem = idsExistentes.includes(userId);
    const novosIds = jaTem
      ? idsExistentes.filter(id => id !== userId)
      : [...idsExistentes, userId];

    const { error } = await supabase
      .from("notas")
      .update({ responsaveis_ids: novosIds })
      .eq("id", notaId);

    if (!error) {
      atualizarStatusNota(notaId, { responsaveis_ids: novosIds });
    } else {
      alert("Erro ao salvar responsável.");
    }
  };

  const handleSaveDataEntregaRapida = async (notaId, data) => {
    const { error } = await supabase.from("notas").update({ data_entrega: data || null }).eq("id", notaId);
    if (!error) atualizarStatusNota(notaId, { data_entrega: data || null });
  };

  const handleRemoveResponsavelRapida = async (notaId, userIdToRemove = null) => {
    const { data: notaAtual, error: fetchError } = await supabase
      .from("notas")
      .select("responsaveis_ids")
      .eq("id", notaId)
      .single();

    if (fetchError) return;

    let novosIds;
    if (userIdToRemove) {
      novosIds = (notaAtual.responsaveis_ids || []).filter(id => id !== userIdToRemove);
    } else {
      novosIds = [];
    }

    const { error } = await supabase
      .from("notas")
      .update({ responsaveis_ids: novosIds })
      .eq("id", notaId);

    if (!error) {
      atualizarStatusNota(notaId, { responsaveis_ids: novosIds });
    }
  };

  const jaExisteDiario = [...columnsNormais, ...columnsArquivadas].some(
    col => col.tipo_pilha === "diario_obras"
  );

  const handleCreateColumn = async (tipo) => {
    if (!entity) return;
    setShowAddColumnMenu(false);

    if (tipo === "diario_obras" && jaExisteDiario) {
      alert("Já existe uma pilha 'Diário de Obra' neste projeto/setor.");
      return;
    }

    const cols = modoArquivadas ? columnsArquivadas : columnsNormais;
    const outras = cols.filter(c => c.title !== "Recebidos");
    const maxOrdem = outras.length > 0 ? Math.max(...outras.map(c => c.ordem)) : -1;
    const newOrdem = maxOrdem + 1;

    const newPilhaData = {
      title: tipo === "diario_obras" ? "Diário de Obra" : "Nova Pilha",
      ordem: newOrdem,
      arquivada: modoArquivadas,
      tipo_pilha: tipo === "diario_obras" ? "diario_obras" : null,
      ...(entityType === "project" ? { project_id: entity.id } : { setor_id: entity.id })
    };

    const { data: newPilha } = await supabase
      .from("pilhas")
      .insert([newPilhaData])
      .select()
      .single();

    if (newPilha) {
      const novaCol = {
        id: String(newPilha.id),
        title: newPilha.title,
        notas: [],
        cor_fundo: null,
        ordem: newOrdem,
        arquivada: modoArquivadas,
        tipo_pilha: newPilha.tipo_pilha || null
      };
      if (modoArquivadas) {
        setColumnsArquivadas(prev => [...prev, novaCol]);
      } else {
        setColumnsNormais(prev => [...prev, novaCol]);
      }
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      const urlParams = new URLSearchParams(location.search);
      const entityIdFromUrl = urlParams.get('entityId');
      const entityTypeFromUrl = urlParams.get('type');
      const containerIdFromUrl = urlParams.get('containerId');
      const notaIdFromUrl = urlParams.get('nota');

      const {
        projectId,
        setorId,
        projectName,
        setorName,
        projectPhoto,
        setorPhoto,
        entityType: typeFromState,
        containerId: containerIdFromState,
      } = location.state || {};

      const entityId = entityIdFromUrl || projectId || setorId;
      const type = entityTypeFromUrl || typeFromState || (projectId ? "project" : "setor");
      const containerId = containerIdFromUrl || containerIdFromState;

      if (!entityId) {
        navigate("/containers", { replace: true });
        setLoading(false);
        return;
      }

      if (containerId) setDonoContainerId(containerId);

      const needsUrlUpdate = !entityIdFromUrl || !entityTypeFromUrl;
      if (needsUrlUpdate) {
        const newUrl = new URLSearchParams();
        newUrl.set('entityId', entityId);
        newUrl.set('type', type);
        if (containerId) newUrl.set('containerId', containerId);
        if (notaIdFromUrl) newUrl.set('nota', notaIdFromUrl);
        
        const newPath = `${location.pathname}?${newUrl.toString()}`;
        navigate(newPath, { replace: true, state: location.state });
      }

      setEntityType(type);
      setLoading(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        setUsuarioId(currentUserId);

        if (currentUserId) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", currentUserId)
            .single();
          if (profileData?.nome) setUsuarioAtual(profileData.nome);
        }

        let entityData = null;
        if (type === "project") {
          const { data: projData, error: projError } = await supabase
            .from("projects")
            .select("*")
            .eq("id", entityId)
            .single();
          if (projError) {
            throw new Error("Projeto não encontrado");
          }
          entityData = projData;
        } else {
          const { data: setData, error: setError } = await supabase
            .from("setores")
            .select("*")
            .eq("id", entityId)
            .single();
          if (setError) {
            throw new Error("Setor não encontrado");
          }
          entityData = setData;
        }

        const entityName = projectName || setorName || entityData.name;
        const entityPhoto = projectPhoto || setorPhoto || entityData.photo_url;

        let membrosList = [];
        const memberTable = type === "project" ? "project_members" : "setor_members";
        const idField = type === "project" ? "project_id" : "setor_id";
        const { data: membersData } = await supabase
          .from(memberTable)
          .select("user_id")
          .eq(idField, entityId);
        if (membersData?.length > 0) {
          const userIds = membersData.map(m => m.user_id);
          const { data: perfis } = await supabase
            .from("profiles")
            .select("id, nickname, avatar_url")
            .in("id", userIds);
          membrosList = perfis || [];
        }
        setMembros(membrosList);

        const { data: pilhasNormaisNull } = await supabase
          .from("pilhas")
          .select("*")
          .eq(idField, entityId)
          .is("arquivada", null)
          .order("ordem", { ascending: true });

        const { data: pilhasNormaisFalse } = await supabase
          .from("pilhas")
          .select("*")
          .eq(idField, entityId)
          .eq("arquivada", false)
          .order("ordem", { ascending: true });

        const { data: pilhasArquivadasRaw } = await supabase
          .from("pilhas")
          .select("*")
          .eq(idField, entityId)
          .eq("arquivada", true)
          .order("ordem", { ascending: true });

        const pilhasNormais = [
          ...(Array.isArray(pilhasNormaisNull) ? pilhasNormaisNull : []),
          ...(Array.isArray(pilhasNormaisFalse) ? pilhasNormaisFalse : [])
        ];
        const pilhasArquivadas = Array.isArray(pilhasArquivadasRaw) ? pilhasArquivadasRaw : [];

        const fetchNotas = async (pilhas) => {
          return Promise.all(
            pilhas.map(async (pilha) => {
              const { data: notasRaw } = await supabase
                .from("notas")
                .select("*")
                .eq("pilha_id", pilha.id)
                .order("ordem", { ascending: true });
              return { ...pilha, notas: Array.isArray(notasRaw) ? notasRaw : [] };
            })
          );
        };

        const pilhasNormaisComNotas = await fetchNotas(pilhasNormais);
        const pilhasArquivadasComNotas = await fetchNotas(pilhasArquivadas);

        const initEstado = (pilhas) => {
          const progresso = {};
          const concluidas = new Set();
          const dataConclusao = {};
          const dataEntrega = {};
          
          pilhas.forEach(p => {
            p.notas.forEach(n => {
              if (n.progresso != null) progresso[n.id] = n.progresso;
              if (n.concluida) concluidas.add(String(n.id));
              if (n.data_conclusao) dataConclusao[n.id] = n.data_conclusao.split("T")[0];
              if (n.data_entrega) dataEntrega[n.id] = n.data_entrega.split("T")[0];
            });
          });
          return { progresso, concluidas, dataConclusao, dataEntrega };
        };

        const { progresso: progN, concluidas: concN, dataConclusao: dataN, dataEntrega: dataE } = initEstado(pilhasNormaisComNotas);

        setNotaProgresso(progN);
        setNotasConcluidas(concN);
        setDataConclusaoSalva(dataN);
        setDataEntregaSalva(dataE);

        setColumnsNormais(
          pilhasNormaisComNotas.map(p => ({
            id: String(p.id),
            title: p.title,
            notas: p.notas,
            cor_fundo: p.cor_fundo || null,
            ordem: p.ordem || 0,
            arquivada: false,
            tipo_pilha: p.tipo_pilha || null
          }))
        );

        setColumnsArquivadas(
          pilhasArquivadasComNotas.map(p => ({
            id: String(p.id),
            title: p.title,
            notas: p.notas,
            cor_fundo: p.cor_fundo || null,
            ordem: p.ordem || 0,
            arquivada: true,
            tipo_pilha: p.tipo_pilha || null
          }))
        );

        setEntity({
          ...entityData,
          type,
        });

        if (notaIdFromUrl) {
          const buscar = (cols) => cols.flatMap(col => col.notas).find(n => String(n.id) === notaIdFromUrl && n.tipo !== "Nota Rápida");
          const notaNormal = buscar(pilhasNormaisComNotas);
          const notaArquivada = buscar(pilhasArquivadasComNotas);

          if (notaArquivada) {
            setModoArquivadas(true);
            setNotaSelecionada(notaArquivada);
            const col = pilhasArquivadasComNotas.find(c => c.notas.some(n => n.id === notaArquivada.id));
            if (col?.title === "Recebidos") {
              setIsNotaRecebidos(true);
              loadOrigemData(notaArquivada.id);
            }
          } else if (notaNormal) {
            setNotaSelecionada(notaNormal);
            const col = pilhasNormaisComNotas.find(c => c.notas.some(n => n.id === notaNormal.id));
            if (col?.title === "Recebidos") {
              setIsNotaRecebidos(true);
              loadOrigemData(notaNormal.id);
            }
          }
        }
      } catch (err) {
        alert("Erro ao carregar dados. Redirecionando...");
        navigate("/containers", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const columnsAtivas = modoArquivadas ? columnsArquivadas : columnsNormais;

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const notaId = urlParams.get("nota");
    
    if (notaSelecionada && notaId && String(notaSelecionada.id) === notaId) {
      return;
    }
    
    if (!notaId && notaSelecionada) {
      const timer = setTimeout(() => {
        const urlParamsCheck = new URLSearchParams(window.location.search);
        const notaIdCheck = urlParamsCheck.get("nota");
        if (!notaIdCheck && notaSelecionada) {
          setNotaSelecionada(null);
          setIsNotaRecebidos(false);
          setProjetoOrigem(null);
          setNotaOrigem(null);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
    
    if (notaId && columnsAtivas.length > 0) {
      let found = false;
      for (const col of columnsAtivas) {
        const nota = col.notas.find(n => String(n.id) === notaId && n.tipo !== "Nota Rápida");
        if (nota) {
          setNotaSelecionada(nota);
          const isRecebidos = col.title === "Recebidos";
          setIsNotaRecebidos(isRecebidos);
          if (isRecebidos) loadOrigemData(nota.id);
          found = true;
          break;
        }
      }
      
      if (!found && (!notaSelecionada || String(notaSelecionada.id) !== notaId)) {
        const buscarNota = async () => {
          const { data: nota, error } = await supabase
            .from("notas")
            .select("*")
            .eq("id", notaId)
            .single();
            
          if (!error && nota && nota.tipo !== "Nota Rápida") {
            setNotaSelecionada(nota);
            setIsNotaRecebidos(false);
          }
        };
        buscarNota();
      }
    }
  }, [columnsAtivas, location.search]);

  const loadOrigemData = async (notaEspelhoId) => {
    try {
      const { data: notaEspelho } = await supabase
        .from("notas")
        .select("projeto_origem_id, nota_original_id, nome")
        .eq("id", notaEspelhoId)
        .single();
      if (notaEspelho?.projeto_origem_id) {
        const { data: projeto } = await supabase
          .from("projects")
          .select("id, name")
          .eq("id", notaEspelho.projeto_origem_id)
          .single();
        setProjetoOrigem(projeto || null);
      }
      if (notaEspelho?.nota_original_id) {
        const { data: nota } = await supabase
          .from("notas")
          .select("id, nome")
          .eq("id", notaEspelho.nota_original_id)
          .single();
        setNotaOrigem(nota || null);
      } else {
        setNotaOrigem({ id: notaEspelhoId, nome: notaEspelho?.nome || "Sem nome" });
      }
    } catch (err) {
      setProjetoOrigem(null);
      setNotaOrigem(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpenNota && !e.target.closest('.card-menu-dropdown') && !e.target.closest('.card-menu-btn')) {
        setMenuOpenNota(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenNota]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpenPilha && !e.target.closest('.card-menu-dropdown') && !e.target.closest('.column-menu-btn')) {
        setMenuOpenPilha(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenPilha]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        notaSelecionada ||
        activeColumnId ||
        notaEditData.id
      ) {
        return;
      }

      const cardsBody = document.querySelector('.cards-body');
      if (!cardsBody) return;

      const scrollAmount = 300;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        cardsBody.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        cardsBody.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [notaSelecionada, activeColumnId, notaEditData.id]);  

  const toggleConclusaoNota = async (notaId, concluida) => {
    const newConcluida = !concluida;
    const { error } = await supabase.from("notas").update({ concluida: newConcluida }).eq("id", notaId);
    if (!error) {
      setNotasConcluidas(prev => {
        const novo = new Set(prev);
        if (newConcluida) novo.add(String(notaId));
        else novo.delete(String(notaId));
        return novo;
      });
    }
  };

  const handleSaveTask = async () => {
    if (!formData.nome.trim() || !activeColumnId) return;
    if (!usuarioId) return alert("Você precisa estar logado para criar uma nota.");
    try {
      const { nome, tipo } = formData;
      const { data: newNota } = await supabase
        .from("notas")
        .insert([{ nome, tipo, pilha_id: activeColumnId, responsavel: usuarioId, concluida: false, ordem: 0 }])
        .select()
        .single();
      const setter = modoArquivadas ? setColumnsArquivadas : setColumnsNormais;
      setter(prev => prev.map(c => c.id === activeColumnId ? { ...c, notas: [newNota, ...c.notas] } : c));
      if (["Atas", "Tarefas", "Lista", "Metas"].includes(newNota.tipo)) {
        setNotaSelecionada(newNota);
        updateUrlWithNota(newNota.id);
        setIsNotaRecebidos(false);
        setProjetoOrigem(null);
        setNotaOrigem(null);
      }
      setFormData({ nome: "", responsavel: "", tipo: "Lista" });
      setActiveColumnId(null);
    } catch (err) {
      alert(`Erro ao criar nota: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleDeleteNota = async (notaId, pilhaId) => {
    if (!window.confirm("Excluir esta nota?")) return;
    const setter = modoArquivadas ? setColumnsArquivadas : setColumnsNormais;
    setter(prev => prev.map(c => c.id === pilhaId ? { ...c, notas: c.notas.filter(n => n.id !== notaId) } : c));
    setMenuOpenNota(null);
    setNotaProgresso(prev => { const u = { ...prev }; delete u[notaId]; return u; });
    setNotasConcluidas(prev => { const u = new Set(prev); u.delete(String(notaId)); return u; });
    if (notaSelecionada?.id === notaId) {
      setNotaSelecionada(null);
      setIsNotaRecebidos(false);
      setProjetoOrigem(null);
      setNotaOrigem(null);
      updateUrlWithNota(null);
    }
    await supabase.from("notas").delete().eq("id", notaId);
  };

  const handleEditNota = (nota, pilhaId) => {
    setNotaEditData({ id: nota.id, nome: nota.nome, responsavel: nota.responsavel || "", pilhaId });
  };

  const saveEditedNota = async () => {
    const { id, nome, responsavel, pilhaId } = notaEditData;
    if (!nome.trim()) return alert("Digite o nome da nota!");
    const { error } = await supabase.from("notas").update({ nome, responsavel }).eq("id", id);
    if (!error) {
      const setter = modoArquivadas ? setColumnsArquivadas : setColumnsNormais;
      setter(prev => prev.map(c => c.id === pilhaId ? { ...c, notas: c.notas.map(n => n.id === id ? { ...n, nome, responsavel } : n) } : c));
      if (notaSelecionada?.id === id) setNotaSelecionada(prev => ({ ...prev, nome, responsavel }));
      setNotaEditData({ id: null, nome: "", responsavel: "", pilhaId: null });
    } else {
      alert("Erro ao salvar alterações.");
    }
  };

  const saveDataConclusao = async (notaId, data) => {
    const { error } = await supabase.from("notas").update({ data_conclusao: data || null }).eq("id", notaId);
    if (!error) {
      setDataConclusaoSalva(prev => ({ ...prev, [notaId]: data || "" }));
      setDataConclusaoEdit(prev => { const cp = { ...prev }; delete cp[notaId]; return cp; });
    }
  };

  const saveDataEntrega = async (notaId, data) => {
    const { error } = await supabase.from("notas").update({ data_entrega: data || null }).eq("id", notaId);
    if (!error) {
      setDataEntregaSalva(prev => ({ ...prev, [notaId]: data || "" }));
      setDataEntregaEdit(prev => { const cp = { ...prev }; delete cp[notaId]; return cp; });
      
      const updateColumns = (setter) => {
        setter(prev =>
          prev.map(col => ({
            ...col,
            notas: col.notas.map(n => n.id === notaId ? { ...n, data_entrega: data || null } : n),
          }))
        );
      };
      updateColumns(setColumnsNormais);
      updateColumns(setColumnsArquivadas);
    }
  };

  useEffect(() => {
    const handleClickOutsideDate = (e) => {
      Object.keys(dataConclusaoEdit).forEach(id => {
        const el = document.querySelector(`.data-conclusao-container[data-nota-id="${id}"]`);
        if (el && !el.contains(e.target)) saveDataConclusao(id, dataConclusaoEdit[id]);
      });
    };
    if (Object.keys(dataConclusaoEdit).length > 0) {
      document.addEventListener("mousedown", handleClickOutsideDate);
      return () => document.removeEventListener("mousedown", handleClickOutsideDate);
    }
  }, [dataConclusaoEdit]);

  const saveColumnsOrder = async (newColumns) => {
    const updates = newColumns
      .filter(col => col.title !== "Recebidos")
      .map((col, index) => ({ id: col.id, ordem: index }));

    try {
      for (const { id, ordem } of updates) {
        const { error } = await supabase
          .from("pilhas")
          .update({ ordem })
          .eq("id", id);
        if (error) throw error;
      }

      const setter = modoArquivadas ? setColumnsArquivadas : setColumnsNormais;
      setter(prev => prev.map(col => {
        const updated = updates.find(u => u.id === col.id);
        return updated ? { ...col, ordem: updated.ordem } : col;
      }));
    } catch (error) {
      alert("Erro ao salvar posição das pilhas.");
    }
  };

  const onDragEnd = useCallback(async (result) => {
    const { source, destination, type } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;

    const cols = modoArquivadas ? columnsArquivadas : columnsNormais;
    const setCols = modoArquivadas ? setColumnsArquivadas : setColumnsNormais;

    if (type === "COLUMN") {
      const newColumns = Array.from(cols);
      const [moved] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, moved);
      const recebidosIndex = newColumns.findIndex(col => col.title === "Recebidos");
      if (recebidosIndex > 0) {
        const recebidosCol = newColumns.splice(recebidosIndex, 1)[0];
        newColumns.unshift(recebidosCol);
      }
      setCols(newColumns);
      saveColumnsOrder(newColumns);
      return;
    }

    if (type === "CARD") {
      const nextColumns = cols.map(c => ({ ...c, notas: [...c.notas] }));
      const sourceCol = nextColumns.find(c => c.id === source.droppableId);
      const [movedNote] = sourceCol.notas.splice(source.index, 1);
      const destCol = nextColumns.find(c => c.id === destination.droppableId);
      destCol.notas.splice(destination.index, 0, movedNote);
      setCols(nextColumns);

      try {
        for (const [idx, nota] of destCol.notas.entries()) {
          await supabase.from('notas').update({ pilha_id: destCol.id, ordem: idx }).eq('id', nota.id);
        }
        if (source.droppableId !== destination.droppableId) {
          for (const [idx, nota] of sourceCol.notas.entries()) {
            await supabase.from('notas').update({ ordem: idx }).eq('id', nota.id);
          }
        }

        if (notaSelecionada?.id === movedNote.id && movedNote.tipo !== "Nota Rápida") {
          setNotaSelecionada(prev => ({ ...prev, pilha_id: destCol.id }));
          const destIsRecebidos = destCol.title === "Recebidos";
          setIsNotaRecebidos(destIsRecebidos);
          if (destIsRecebidos) loadOrigemData(movedNote.id);
          else { setProjetoOrigem(null); setNotaOrigem(null); }
        }
      } catch (err) {
        alert("Erro ao salvar posição das notas. Atualize a página.");
      }
    }
  }, [columnsNormais, columnsArquivadas, modoArquivadas, notaSelecionada]);

  const handleOpenNota = (nota) => {
    if (nota.tipo === "Nota Rápida") {
      return;
    }

    let isRecebidos = false;
    for (const col of columnsAtivas) {
      if (col.notas.some(n => n.id === nota.id)) {
        isRecebidos = col.title === "Recebidos";
        break;
      }
    }

    updateUrlWithNota(nota.id);
    
    setNotaSelecionada(nota);
    setIsNotaRecebidos(isRecebidos);
    
    if (isRecebidos) {
      loadOrigemData(nota.id);
    } else {
      setProjetoOrigem(null);
      setNotaOrigem(null);
    }
  };

  const handleCloseNota = () => {
    setNotaSelecionada(null);
    setIsNotaRecebidos(false);
    setProjetoOrigem(null);
    setNotaOrigem(null);
    updateUrlWithNota(null);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ║  FUNÇÃO: RENDERIZAR CONTEÚDO COMPLETO DA NOTA NO PAINEL LATERAL
  // ╚══════════════════════════════════════════════════════════════════════════
  const renderNotaContent = (nota, onClose) => {
    if (!nota) return null;

    console.log('🔍 Cards.renderNotaContent - Renderizando nota completa:', {
      id: nota.id,
      nome: nota.nome,
      tipo: nota.tipo
    });

    // Usa o ModalNota em modo inline para renderizar o conteúdo completo
    return (
      <ModalNota
        inline={true}
        showVisualizarNota={true}
        onCloseVisualizarNota={onClose}
        notaSelecionada={nota}
        project={{ ...entity, tipo: entity?.type === "project" ? "projeto" : "setor" }}
        usuarioAtual={usuarioAtual}
        usuarioId={usuarioId}
        notaProgresso={notaProgresso}
        setNotaProgresso={setNotaProgresso}
        donoContainerId={donoContainerId}
        onStatusUpdate={atualizarStatusNota}
        setColumns={modoArquivadas ? setColumnsArquivadas : setColumnsNormais}
        setColumnsNormais={setColumnsNormais}
        setColumnsArquivadas={setColumnsArquivadas}
        showNovaNota={false}
        showEditarNota={false}
        onCloseNovaNota={() => {}}
        onCloseEditarNota={() => {}}
      />
    );
  };

  if (loading) return <Loading />;

  const filteredColumns = searchTerm
    ? columnsAtivas.map(col => ({
        ...col,
        notas: col.notas.filter(nota => nota.nome.toLowerCase().includes(searchTerm.toLowerCase())),
      }))
    : columnsAtivas;

  const allColumns = [...columnsNormais, ...columnsArquivadas];
  const isCardsPageArquivo = modoArquivadas;

  return (
    <div className={`cards-page ${isCardsPageArquivo ? 'arquivo-cards-page' : ''}`}>
      <CardsHeader
        entity={entity}
        membros={membros}
        donoContainerId={donoContainerId}
        onSearch={setSearchTerm}
        onToggleArquivadas={() => setModoArquivadas(prev => !prev)}
        modoArquivadas={modoArquivadas}
      />

      {/* Botão flutuante que só aparece no modo normal (desaparece no modo expandido) */}
      {!expandedColumnId && (
        <div className="floating-add-column-container">
          <button
            className="floating-add-column-btn"
            onClick={() => setShowAddColumnMenu(prev => !prev)}
            title="Adicionar pilha"
          >
            <FaPlus />
          </button>

          {showAddColumnMenu && (
            <div className="add-column-menu">
              <button onClick={() => handleCreateColumn("normal")}>
                Pilha normal
              </button>
              {!jaExisteDiario && (
                <button onClick={() => handleCreateColumn("diario_obras")}>
                  Diário de Obra
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="all-columns" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div className="cards-body" ref={provided.innerRef} {...provided.droppableProps}>
              {filteredColumns.map((col, index) => (
                <Column
                  key={col.id}
                  col={col}
                  index={index}
                  columns={allColumns}
                  notasConcluidas={notasConcluidas}
                  notaProgresso={notaProgresso}
                  dataConclusaoEdit={dataConclusaoEdit}
                  dataConclusaoSalva={dataConclusaoSalva}
                  showColorPicker={showColorPicker}
                  menuOpenPilha={menuOpenPilha}
                  menuOpenNota={menuOpenNota}
                  editingColumnId={editingColumnId}
                  columnTitleDraft={columnTitleDraft}
                  setMenuOpenPilha={setMenuOpenPilha}
                  setMenuOpenNota={setMenuOpenNota}
                  setActiveColumnId={setActiveColumnId}
                  setEditingColumnId={setEditingColumnId}
                  setColumnTitleDraft={setColumnTitleDraft}
                  setShowColorPicker={setShowColorPicker}
                  setColumns={modoArquivadas ? setColumnsArquivadas : setColumnsNormais}
                  toggleConclusaoNota={toggleConclusaoNota}
                  setDataConclusaoEdit={setDataConclusaoEdit}
                  saveDataConclusao={saveDataConclusao}
                  handleOpenNota={handleOpenNota}
                  handleEditNota={handleEditNota}
                  handleDeleteNota={handleDeleteNota}
                  onSaveResponsavelRapida={handleSaveResponsavelRapida}
                  onSaveDataEntregaRapida={handleSaveDataEntregaRapida}
                  onRemoveResponsavelRapida={handleRemoveResponsavelRapida}
                  modoArquivadas={modoArquivadas}
                  donoContainerId={donoContainerId}
                  usuarioId={usuarioId}
                  entityType={entityType}
                  entity={entity}
                  columnsNormais={columnsNormais}
                  columnsArquivadas={columnsArquivadas}
                  dataEntregaEdit={dataEntregaEdit}
                  dataEntregaSalva={dataEntregaSalva}
                  setDataEntregaEdit={setDataEntregaEdit}
                  saveDataEntrega={saveDataEntrega}
                  expandedColumnId={expandedColumnId}
                  setExpandedColumnId={setExpandedColumnId}
                  expandedNotaView={expandedNotaView}
                  setExpandedNotaView={setExpandedNotaView}
                  renderNotaContent={renderNotaContent}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {isNotaRecebidos && notaSelecionada ? (
        <div className="modal-overlay">
          <div className="modal-content listagem-espelho-modal">
            <ListagemEspelho
              projetoOrigem={projetoOrigem}
              notaOrigem={notaOrigem}
              notaEspelhoId={notaSelecionada.id}
              onClose={handleCloseNota}
              onStatusUpdate={atualizarStatusNota}
            />
          </div>
        </div>
      ) : (
        <ModalNota
          showNovaNota={!!activeColumnId}
          showEditarNota={!!notaEditData.id && !notaSelecionada}
          showVisualizarNota={!!notaSelecionada}
          onCloseNovaNota={() => setActiveColumnId(null)}
          onCloseEditarNota={() => setNotaEditData({ id: null, nome: "", responsavel: "", pilhaId: null })}
          onCloseVisualizarNota={handleCloseNota}
          formData={formData}
          setFormData={setFormData}
          handleSaveTask={handleSaveTask}
          notaEditData={notaEditData}
          setNotaEditData={setNotaEditData}
          saveEditedNota={saveEditedNota}
          notaSelecionada={notaSelecionada}
          project={{ ...entity, tipo: entity?.type === "project" ? "projeto" : "setor" }}
          usuarioAtual={usuarioAtual}
          usuarioId={usuarioId}
          notaProgresso={notaProgresso}
          setNotaProgresso={setNotaProgresso}
          donoContainerId={donoContainerId}
          onStatusUpdate={atualizarStatusNota}
          setColumnsNormais={setColumnsNormais}
          setColumnsArquivadas={setColumnsArquivadas}
        />
      )}
    </div>
  );
}