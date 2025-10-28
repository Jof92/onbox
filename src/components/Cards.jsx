// Cards.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Cards.css";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { FaPlus, FaArrowLeft, FaTimes, FaEllipsisV, FaEdit, FaTrash } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Listagem from "./Listagem";
import AtaCard from "./AtaCard";
import Task from "./Task";
import Loading from "./Loading";

export default function Cards() {
  const location = useLocation();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [columns, setColumns] = useState([]); // [{ id, title, notas: [] }]
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState(null);
  const [formData, setFormData] = useState({ nome: "", responsavel: "", tipo: "Lista" });

  const [editingColumnId, setEditingColumnId] = useState(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState("");

  const [menuOpenNota, setMenuOpenNota] = useState(null);
  const [editNotaModal, setEditNotaModal] = useState(false);
  const [notaEditData, setNotaEditData] = useState({ id: null, nome: "", responsavel: "", pilhaId: null });

  const [showModalNota, setShowModalNota] = useState(false);
  const [pilhaSelecionada, setPilhaSelecionada] = useState(null);
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [usuarioAtual, setUsuarioAtual] = useState("Usuário Atual");

  // progresso exibido ao lado do nome (ata)
  const [notaProgresso, setNotaProgresso] = useState({}); // { notaId: percent }

  // --- LOAD PROJECT + PILHAS (COM NOTAS) ---
  useEffect(() => {
    const projectId = location.state?.projectId;
    if (!projectId) return navigate("/containers", { replace: true });

    (async () => {
      setLoading(true);
      try {
        const { data: projectData } = await supabase.from("projects").select("*").eq("id", projectId).single();
        if (!projectData) return navigate("/containers", { replace: true });

        const [{ photo_url } = {}] =
          (await supabase.from("projects_photos").select("photo_url").eq("project_id", projectId).order("created_at").limit(1)).data || [];

        const pavimentos = (await supabase.from("pavimentos").select("*").eq("project_id", projectId).order("created_at")).data || [];
        const eap = (await supabase.from("eap").select("*").eq("project_id", projectId).order("created_at")).data || [];

        const { data: userData } = await supabase.from("profiles").select("nome").limit(1).single();
        if (userData?.nome) setUsuarioAtual(userData.nome);

        // buscar pilhas com notas embutidas (é o que você já fazia)
        const pilhasData = (await supabase.from("pilhas").select("*, notas(*)").eq("project_id", projectId).order("created_at")).data || [];

        // normalizar para o formato que usamos
        setColumns(pilhasData.map(p => ({ id: String(p.id), title: p.title, notas: p.notas || [] })));
        setProject({ ...projectData, photo_url, pavimentos, eap });
      } catch (err) {
        console.error("Erro ao carregar projeto/pilhas:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [location.state, navigate]);

  // --- HELPERS CRUD ---
  const handleAddColumn = async () => {
    if (!project) return;
    const { data: newPilha, error } = await supabase.from("pilhas").insert([{ project_id: project.id, title: "Nova Pilha" }]).select().single();
    if (error) return console.error(error);
    setColumns(prev => [...prev, { id: String(newPilha.id), title: newPilha.title, notas: [] }]);
  };

  const saveColumnTitle = async (id) => {
    if (!columnTitleDraft.trim()) return setEditingColumnId(null);
    const { error } = await supabase.from("pilhas").update({ title: columnTitleDraft }).eq("id", id);
    if (!error) setColumns(prev => prev.map(c => (c.id === id ? { ...c, title: columnTitleDraft } : c)));
    setEditingColumnId(null);
  };

  const handleSaveTask = async () => {
    if (!formData.nome.trim() || !activeColumnId) return;
    try {
      const { data: newNota, error } = await supabase.from("notas").insert([{ ...formData, pilha_id: activeColumnId }]).select().single();
      if (error) throw error;
      setColumns(prev => prev.map(c => (c.id === activeColumnId ? { ...c, notas: [newNota, ...c.notas] } : c)));
      if (["Atas", "Tarefas"].includes(newNota.tipo)) {
        setPilhaSelecionada(columns.find(c => c.id === activeColumnId)?.title);
        setNotaSelecionada(newNota);
        setShowModalNota(true);
      }
    } catch (err) {
      console.error("Erro criar nota:", err);
      alert("Erro ao criar nota");
    } finally {
      setFormData({ nome: "", responsavel: "", tipo: "Lista" });
      setShowForm(false);
    }
  };

  const handleDeleteNota = async (notaId, pilhaId) => {
    if (!window.confirm("Deseja realmente excluir esta nota?")) return;
    const { error } = await supabase.from("notas").delete().eq("id", notaId);
    if (!error) {
      setColumns(prev => prev.map(c => (c.id === pilhaId ? { ...c, notas: c.notas.filter(n => n.id !== notaId) } : c)));
      setMenuOpenNota(null);
      setNotaProgresso(p => { const cp = { ...p }; delete cp[notaId]; return cp; });
    }
  };

  const handleEditNota = (nota, pilhaId) => {
    setNotaEditData({ id: nota.id, nome: nota.nome, responsavel: nota.responsavel || "", pilhaId });
    setEditNotaModal(true);
    setMenuOpenNota(null);
  };

  const saveEditedNota = async () => {
    const { id, nome, responsavel, pilhaId } = notaEditData;
    if (!nome.trim()) return alert("Digite o nome da nota!");
    const { error } = await supabase.from("notas").update({ nome, responsavel }).eq("id", id);
    if (!error) {
      setColumns(prev => prev.map(c => c.id === pilhaId ? { ...c, notas: c.notas.map(n => (n.id === id ? { ...n, nome, responsavel } : n)) } : c));
      setEditNotaModal(false);
    }
  };

  // --- DRAG & DROP ---
  // onDragEnd: atualiza UI otimistamente e persiste pilha_id quando mudou de coluna
  const onDragEnd = useCallback(async ({ source, destination }) => {
    if (!destination) return;

    // mesma coluna + mesma posição => nada
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // copia state
    let movedNote = null;
    const nextColumns = columns.map(c => {
      if (c.id === source.droppableId) {
        const notas = Array.from(c.notas);
        [movedNote] = notas.splice(source.index, 1);
        return { ...c, notas };
      }
      return c;
    }).map(c => {
      if (c.id === destination.droppableId && movedNote) {
        const notas = Array.from(c.notas);
        notas.splice(destination.index, 0, movedNote);
        return { ...c, notas };
      }
      return c;
    });

    // otimista: atualizar UI imediatamente
    setColumns(nextColumns);

    // se mudou de coluna, persistir pilha_id no banco
    const movedToDifferentColumn = movedNote && source.droppableId !== destination.droppableId;
    if (movedToDifferentColumn) {
      try {
        const updatePayload = { pilha_id: destination.droppableId };
        const { error } = await supabase.from("notas").update(updatePayload).eq("id", movedNote.id);
        if (error) throw error;
        // tudo ok — já está no state
      } catch (err) {
        // rollback se erro
        console.error("Erro ao atualizar pilha_id:", err);
        alert("Erro ao mover nota no servidor. Revertendo.");
        // refazer fetch simples para recarregar estado correto
        // (poderíamos fazer rollback local, mas refetch é mais seguro)
        await refetchPilhas();
      }
    } else {
      // se apenas reordenou dentro da mesma pilha e você tiver um campo de ordem,
      // aqui você poderia salvar a ordem no banco. Caso não tenha, não faz nada.
    }
  }, [columns]);

  // refetch helper
  const refetchPilhas = useCallback(async () => {
    try {
      const projectId = location.state?.projectId;
      if (!projectId) return;
      const pilhasData = (await supabase.from("pilhas").select("*, notas(*)").eq("project_id", projectId).order("created_at")).data || [];
      setColumns(pilhasData.map(p => ({ id: String(p.id), title: p.title, notas: p.notas || [] })));
    } catch (err) {
      console.error("Erro ao refetch pilhas:", err);
    }
  }, [location.state]);

  // --- RENDER ---
  if (loading) return <Loading />;

  return (
    <div className="cards-page">
      <header className="cards-header">
        <button className="btn-voltar" onClick={() => navigate("/containers")} title="Voltar"><FaArrowLeft /></button>
        {project?.photo_url && <img src={project.photo_url} alt={project.name} className="project-photo-header" />}
        <h1>Pilhas - <span className="project-name">{project?.name || "Projeto Desconhecido"}</span></h1>
        <button className="btn-add-pilha" onClick={handleAddColumn}><FaPlus /></button>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="cards-body">
          {columns.map(col => (
            <Droppable key={col.id} droppableId={col.id}>
              {(provided) => (
                <div className="cards-column" ref={provided.innerRef} {...provided.droppableProps}>
                  <div className="column-header">
                    {editingColumnId === col.id ? (
                      <input
                        type="text"
                        value={columnTitleDraft}
                        autoFocus
                        onChange={(e) => setColumnTitleDraft(e.target.value)}
                        onBlur={() => saveColumnTitle(col.id)}
                        onKeyDown={(e) => e.key === "Enter" && saveColumnTitle(col.id)}
                      />
                    ) : (
                      <h3 onDoubleClick={() => { setEditingColumnId(col.id); setColumnTitleDraft(col.title); }}>{col.title}</h3>
                    )}
                    <button className="btn-add" onClick={() => { setActiveColumnId(col.id); setShowForm(true); }}><FaPlus /></button>
                  </div>

                  <div className="cards-list">
                    {col.notas.map((nota, index) => (
                      <Draggable key={String(nota.id)} draggableId={String(nota.id)} index={index}>
                        {(prov, snapshot) => {
                          // Use provided style sem sobrescrever transform/position (isso reduz jitter)
                          const style = {
                            ...prov.draggableProps.style,
                            // pequenas melhorias de usabilidade:
                            userSelect: "none",
                            // para indicar arraste visualmente, usar cursor e box-shadow via classe CSS
                          };
                          return (
                            <div
                              className={`card-item tipo-${(nota.tipo || "lista").toLowerCase()} ${snapshot.isDragging ? "dragging" : ""}`}
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              style={style}
                            >
                              <div
                                className="card-info"
                                onClick={() => {
                                  setPilhaSelecionada(col.title);
                                  setNotaSelecionada(nota);
                                  setShowModalNota(true);
                                }}
                              >
                                <div className="card-title-wrapper">
                                  <strong>{nota.nome}</strong>
                                  {notaProgresso[nota.id] !== undefined && (
                                    <span className="nota-progresso-badge">{notaProgresso[nota.id]}%</span>
                                  )}
                                </div>
                                <p>{nota.tipo}</p>
                              </div>

                              <div className="card-menu-wrapper" onClick={(e) => e.stopPropagation()}>
                                <button className="card-menu-btn" onClick={() => setMenuOpenNota(menuOpenNota === nota.id ? null : nota.id)}><FaEllipsisV /></button>
                                {menuOpenNota === nota.id && (
                                  <div className="card-menu-dropdown">
                                    <button onClick={() => handleEditNota(nota, col.id)}><FaEdit /> Editar</button>
                                    <button onClick={() => handleDeleteNota(nota.id, col.id)}><FaTrash /> Excluir</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* Modal nova nota */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Nova Nota</h2>
            <label>Nome</label>
            <input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
            <label>Responsável</label>
            <input value={formData.responsavel} onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })} />
            <label>Tipo</label>
            <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
              {["Lista", "Diário de Obra", "Tarefas", "Atas", "Medição"].map(t => <option key={t}>{t}</option>)}
            </select>

            <div className="modal-actions">
              <button className="btn-salvar" onClick={handleSaveTask}>Salvar</button>
              <button className="btn-cancelar" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar nota */}
      {editNotaModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Editar Nota</h2>
            <label>Nome</label>
            <input value={notaEditData.nome} onChange={e => setNotaEditData({ ...notaEditData, nome: e.target.value })} />
            <label>Responsável</label>
            <input value={notaEditData.responsavel} onChange={e => setNotaEditData({ ...notaEditData, responsavel: e.target.value })} />
            <div className="modal-actions">
              <button className="btn-salvar" onClick={saveEditedNota}>Salvar</button>
              <button className="btn-cancelar" onClick={() => setEditNotaModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal visualização nota */}
      {showModalNota && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <button className="modal-close-btn" onClick={() => setShowModalNota(false)} title="Fechar"><FaTimes /></button>

            {notaSelecionada?.tipo === "Atas" && (
              <AtaCard
                projetoAtual={project}
                pilhaAtual={pilhaSelecionada}
                notaAtual={notaSelecionada}
                usuarioAtual={usuarioAtual}
                onProgressoChange={(p) => setNotaProgresso(prev => ({ ...prev, [notaSelecionada.id]: p }))}
              />
            )}

            {notaSelecionada?.tipo === "Tarefas" && (
              <Task
                projetoAtual={project}
                pilhaAtual={pilhaSelecionada}
                notaAtual={notaSelecionada}
                usuarioAtual={usuarioAtual}
                onProgressoChange={(p) => setNotaProgresso(prev => ({ ...prev, [notaSelecionada.id]: p }))}
              />
            )}

            {notaSelecionada?.tipo !== "Atas" && notaSelecionada?.tipo !== "Tarefas" && (
              <Listagem
                projetoAtual={project}
                pilhaAtual={pilhaSelecionada}
                notaAtual={notaSelecionada?.nome}
                usuarioAtual={usuarioAtual}
                locacoes={project?.pavimentos?.map(p => p.name) || []}
                eaps={project?.eap?.map(e => e.name) || []}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
