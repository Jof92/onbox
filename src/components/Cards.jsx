// src/components/Cards.jsx - CORREÇÃO FINAL
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

  const [formData, setFormData] = useState({ nome: "", responsavel: "", tipo: "Lista" });
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
    if (notaId) urlParams.set('nota', notaId);
    else urlParams.delete('nota');
    navigate(`${location.pathname}?${urlParams.toString()}`, { replace: false });
  };

  const handleSaveNomeRapida = async (notaId, novoNome) => {
    if (!novoNome.trim()) return;
    const { error } = await supabase.from("notas").update({ nome: novoNome.trim() }).eq("id", notaId);
    if (!error) atualizarStatusNota(notaId, { nome: novoNome.trim() });
  };

const handleSaveResponsavelRapida = async (notaId, userId, nomeExterno) => {
  if (!userId) {
    console.warn("Tentativa de salvar responsável sem ID");
    return;
  }

  // Busca a nota atual para obter a lista existente
  const { data: notaAtual, error: fetchError } = await supabase
    .from("notas")
    .select("responsaveis_ids")
    .eq("id", notaId)
    .single();

  if (fetchError) {
    console.error("Erro ao buscar nota:", fetchError);
    alert("Erro ao atualizar responsável.");
    return;
  }

  const idsExistentes = notaAtual.responsaveis_ids || [];
  const jaTem = idsExistentes.includes(userId);

  let novosIds;
  if (jaTem) {
    // Remove o usuário (toggle off)
    novosIds = idsExistentes.filter(id => id !== userId);
  } else {
    // Adiciona o usuário
    novosIds = [...idsExistentes, userId];
  }

  const { error } = await supabase
    .from("notas")
    .update({ responsaveis_ids: novosIds })
    .eq("id", notaId);

  if (!error) {
    atualizarStatusNota(notaId, { responsaveis_ids: novosIds });
  } else {
    console.error("Erro ao salvar responsáveis:", error);
    alert("Erro ao salvar responsável.");
  }
};

  const handleSaveDataEntregaRapida = async (notaId, data) => {
    const { error } = await supabase.from("notas").update({ data_entrega: data || null }).eq("id", notaId);
    if (!error) atualizarStatusNota(notaId, { data_entrega: data || null });
  };

const handleRemoveResponsavelRapida = async (notaId, userIdToRemove = null) => {
  // Se userIdToRemove for fornecido, remove só ele; senão, limpa todos
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
        navigate(`${location.pathname}?${newUrl.toString()}`, { replace: true });
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
          pilhas.forEach(p => {
            p.notas.forEach(n => {
              if (n.progresso != null) progresso[n.id] = n.progresso;
              if (n.concluida) concluidas.add(String(n.id));
              if (n.data_conclusao) dataConclusao[n.id] = n.data_conclusao.split("T")[0];
            });
          });
          return { progresso, concluidas, dataConclusao };
        };

        const { progresso: progN, concluidas: concN, dataConclusao: dataN } = initEstado(pilhasNormaisComNotas);

        setNotaProgresso(progN);
        setNotasConcluidas(concN);
        setDataConclusaoSalva(dataN);

        setColumnsNormais(
          pilhasNormaisComNotas.map(p => ({
            id: String(p.id),
            title: p.title,
            notas: p.notas,
            cor_fundo: p.cor_fundo || null,
            ordem: p.ordem || 0,
            arquivada: false
          }))
        );

        setColumnsArquivadas(
          pilhasArquivadasComNotas.map(p => ({
            id: String(p.id),
            title: p.title,
            notas: p.notas,
            cor_fundo: p.cor_fundo || null,
            ordem: p.ordem || 0,
            arquivada: true
          }))
        );

        setEntity({ id: entityId, name: entityName, photo_url: entityPhoto, type });

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
      if (!found && notaSelecionada) {
        const newUrl = new URLSearchParams(location.search);
        newUrl.delete('nota');
        navigate(`${location.pathname}?${newUrl.toString()}`, { replace: true });
      }
    } else if (notaSelecionada && !notaId) {
      setNotaSelecionada(null);
      setIsNotaRecebidos(false);
      setProjetoOrigem(null);
      setNotaOrigem(null);
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

  const handleAddColumn = async () => {
    if (!entity) return;
    const cols = modoArquivadas ? columnsArquivadas : columnsNormais;
    const outras = cols.filter(c => c.title !== "Recebidos");
    const maxOrdem = outras.length > 0 ? Math.max(...outras.map(c => c.ordem)) : -1;
    const newOrdem = maxOrdem + 1;

    const newPilhaData = {
      title: "Nova Pilha",
      ordem: newOrdem,
      arquivada: modoArquivadas,
      ...(entityType === "project" ? { project_id: entity.id } : { setor_id: entity.id })
    };

    const { data: newPilha } = await supabase
      .from("pilhas")
      .insert([newPilhaData])
      .select()
      .single();

    if (newPilha) {
      const novaCol = { id: String(newPilha.id), title: newPilha.title, notas: [], cor_fundo: null, ordem: newOrdem };
      if (modoArquivadas) {
        setColumnsArquivadas(prev => [...prev, novaCol]);
      } else {
        setColumnsNormais(prev => [...prev, novaCol]);
      }
    }
  };

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
  // Filtra "Recebidos" e mapeia apenas id (UUID) e ordem (número)
  const updates = newColumns
    .filter(col => col.title !== "Recebidos")
    .map((col, index) => ({
      id: col.id,        // string UUID válida
      ordem: index       // número inteiro
    }));

  // ✅ Atualiza apenas a coluna 'ordem' para cada pilha existente
  try {
    // Atualiza cada pilha individualmente (mais seguro com RLS)
    for (const { id, ordem } of updates) {
      const { error } = await supabase
        .from("pilhas")
        .update({ ordem })
        .eq("id", id);
      if (error) throw error;
    }

    // Atualiza o estado local
    const setter = modoArquivadas ? setColumnsArquivadas : setColumnsNormais;
    setter(prev => prev.map(col => {
      const updated = updates.find(u => u.id === col.id);
      return updated ? { ...col, ordem: updated.ordem } : col;
    }));
  } catch (error) {
    console.error("Erro ao salvar posição das pilhas:", error);
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
    if (nota.tipo === "Nota Rápida") return;
    let isRecebidos = false;
    for (const col of columnsAtivas) {
      if (col.notas.some(n => n.id === nota.id)) {
        isRecebidos = col.title === "Recebidos";
        break;
      }
    }
    setNotaSelecionada(nota);
    setIsNotaRecebidos(isRecebidos);
    if (isRecebidos) loadOrigemData(nota.id);
    else { setProjetoOrigem(null); setNotaOrigem(null); }
    updateUrlWithNota(nota.id);
  };

  const handleCloseNota = () => {
    setNotaSelecionada(null);
    setIsNotaRecebidos(false);
    setProjetoOrigem(null);
    setNotaOrigem(null);
    updateUrlWithNota(null);
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

      <button className="floating-add-column-btn" onClick={handleAddColumn} title="Adicionar pilha">
        <FaPlus />
      </button>

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
                  onSaveNomeRapida={handleSaveNomeRapida}
                  onSaveResponsavelRapida={handleSaveResponsavelRapida}
                  onSaveDataEntregaRapida={handleSaveDataEntregaRapida}
                  onRemoveResponsavelRapida={handleRemoveResponsavelRapida}
                  modoArquivadas={modoArquivadas}
                  donoContainerId={donoContainerId}
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
        />
      )}
    </div>
  );
}