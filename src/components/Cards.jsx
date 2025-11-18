// src/components/Cards.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Cards.css";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { FaPlus, FaArrowLeft, FaEllipsisV, FaEdit, FaTrash } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ModalNota from "./ModalNota";

export default function Cards() {
  const location = useLocation();
  const navigate = useNavigate();

  const [entity, setEntity] = useState(null); // pode ser projeto ou setor
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("project"); // ou "setor"

  const [activeColumnId, setActiveColumnId] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState("");

  const [formData, setFormData] = useState({ nome: "", responsavel: "", tipo: "Lista" });
  const [notaEditData, setNotaEditData] = useState({ id: null, nome: "", responsavel: "", pilhaId: null });
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [usuarioAtual, setUsuarioAtual] = useState("Usuário Atual");
  const [notaProgresso, setNotaProgresso] = useState({});
  const [menuOpenNota, setMenuOpenNota] = useState(null);
  const [menuOpenPilha, setMenuOpenPilha] = useState(null); // ✅ Novo estado

  // --- Carregar entidade (projeto ou setor) + pilhas + notas ---
  useEffect(() => {
    const { projectId, setorId, projectName, setorName, projectPhoto, setorPhoto, entityType: typeFromState } = location.state || {};
    const entityId = projectId || setorId;
    const entityName = projectName || setorName || "Entidade";
    const entityPhoto = projectPhoto || setorPhoto;
    const type = typeFromState || (projectId ? "project" : "setor");

    if (!entityId) {
      alert("Projeto ou setor não encontrado.");
      navigate(-1);
      return;
    }

    setEntityType(type);

    (async () => {
      setLoading(true);
      try {
        // Carregar entidade
        let entityData = null;
        if (type === "project") {
          const { data } = await supabase.from("projects").select("*").eq("id", entityId).single();
          entityData = data;
        } else {
          const { data } = await supabase.from("setores").select("*").eq("id", entityId).single();
          entityData = data;
        }

        if (!entityData) return navigate("/containers", { replace: true });

        // Usuário atual
        const { data: userData } = await supabase.from("profiles").select("nome").limit(1).single();
        if (userData?.nome) setUsuarioAtual(userData.nome);

        // Carregar pilhas com notas
        let pilhasData = [];
        if (type === "project") {
          pilhasData = (
            await supabase
              .from("pilhas")
              .select("*, notas(id, nome, tipo, responsavel, progresso)")
              .eq("project_id", entityId)
              .order("created_at")
          ).data || [];
        } else {
          pilhasData = (
            await supabase
              .from("pilhas")
              .select("*, notas(id, nome, tipo, responsavel, progresso)")
              .eq("setor_id", entityId)
              .order("created_at")
          ).data || [];
        }

        // Inicializar progresso
        const progressoInicial = {};
        pilhasData.forEach((pilha) => {
          pilha.notas.forEach((nota) => {
            if (nota.progresso != null) {
              progressoInicial[nota.id] = nota.progresso;
            }
          });
        });
        setNotaProgresso(progressoInicial);

        setColumns(
          pilhasData.map((p) => ({
            id: String(p.id),
            title: p.title,
            notas: p.notas || [],
          }))
        );

        setEntity({ id: entityId, name: entityName, photo_url: entityPhoto, type });
      } catch (err) {
        console.error("Erro ao carregar entidade/pilhas:", err);
        navigate("/containers", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [location.state, navigate]);

  // --- Adicionar coluna (pilha) ---
  const handleAddColumn = async () => {
    if (!entity) return;

    const newPilhaData = { title: "Nova Pilha" };
    if (entityType === "project") {
      newPilhaData.project_id = entity.id;
    } else {
      newPilhaData.setor_id = entity.id;
    }

    const { data: newPilha, error } = await supabase
      .from("pilhas")
      .insert([newPilhaData])
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar pilha:", error);
      return;
    }

    setColumns((prev) => [...prev, { id: String(newPilha.id), title: newPilha.title, notas: [] }]);
  };

  // --- Editar título da coluna ---
  const saveColumnTitle = async (id) => {
    if (!columnTitleDraft.trim()) return setEditingColumnId(null);
    const { error } = await supabase.from("pilhas").update({ title: columnTitleDraft }).eq("id", id);
    if (!error) {
      setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title: columnTitleDraft } : c)));
    }
    setEditingColumnId(null);
  };

  // --- Excluir pilha (apenas se vazia) ---
  const handleDeletePilha = async (pilhaId) => {
    const pilha = columns.find(c => c.id === pilhaId);
    if (!pilha || pilha.notas.length > 0) {
      alert("Apenas pilhas vazias podem ser excluídas.");
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir a pilha "${pilha.title}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    const { error } = await supabase.from("pilhas").delete().eq("id", pilhaId);
    if (error) {
      console.error("Erro ao excluir pilha:", error);
      alert("Erro ao excluir pilha.");
      return;
    }

    setColumns(prev => prev.filter(c => c.id !== pilhaId));
    setMenuOpenPilha(null);
  };

  // --- CRUD Notas ---
  const handleSaveTask = async () => {
    if (!formData.nome.trim() || !activeColumnId) return;
    try {
      const { data: newNota, error } = await supabase
        .from("notas")
        .insert([{ ...formData, pilha_id: activeColumnId }])
        .select()
        .single();
      if (error) throw error;

      setColumns((prev) =>
        prev.map((c) => (c.id === activeColumnId ? { ...c, notas: [newNota, ...c.notas] } : c))
      );

      if (["Atas", "Tarefas", "Lista"].includes(newNota.tipo)) {
        setNotaSelecionada(newNota);
      }
    } catch (err) {
      console.error("Erro criar nota:", err);
      alert("Erro ao criar nota");
    } finally {
      setFormData({ nome: "", responsavel: "", tipo: "Lista" });
      setActiveColumnId(null);
    }
  };

  const handleDeleteNota = async (notaId, pilhaId) => {
    if (!window.confirm("Deseja realmente excluir esta nota?")) return;
    const { error } = await supabase.from("notas").delete().eq("id", notaId);
    if (!error) {
      setColumns((prev) =>
        prev.map((c) => (c.id === pilhaId ? { ...c, notas: c.notas.filter((n) => n.id !== notaId) } : c))
      );
      setMenuOpenNota(null);
      setNotaProgresso((p) => {
        const cp = { ...p };
        delete cp[notaId];
        return cp;
      });
      if (notaSelecionada?.id === notaId) {
        setNotaSelecionada(null);
      }
    }
  };

  const handleEditNota = (nota, pilhaId) => {
    setNotaEditData({ id: nota.id, nome: nota.nome, responsavel: nota.responsavel || "", pilhaId });
  };

  const saveEditedNota = async () => {
    const { id, nome, responsavel, pilhaId } = notaEditData;
    if (!nome.trim()) return alert("Digite o nome da nota!");
    const { error } = await supabase.from("notas").update({ nome, responsavel }).eq("id", id);
    if (!error) {
      setColumns((prev) =>
        prev.map((c) =>
          c.id === pilhaId
            ? { ...c, notas: c.notas.map((n) => (n.id === id ? { ...n, nome, responsavel } : n)) }
            : c
        )
      );
      if (notaSelecionada?.id === id) {
        setNotaSelecionada((prev) => ({ ...prev, nome, responsavel }));
      }
      setNotaEditData({ id: null, nome: "", responsavel: "", pilhaId: null });
    }
  };

  // --- Drag & Drop ---
  const onDragEnd = useCallback(
    async ({ source, destination }) => {
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      const nextColumns = columns.map((c) => ({ ...c, notas: [...c.notas] }));
      const sourceCol = nextColumns.find((c) => c.id === source.droppableId);
      const [movedNote] = sourceCol.notas.splice(source.index, 1);
      const destCol = nextColumns.find((c) => c.id === destination.droppableId);
      destCol.notas.splice(destination.index, 0, movedNote);
      setColumns(nextColumns);

      if (source.droppableId !== destination.droppableId) {
        try {
          const { error } = await supabase
            .from("notas")
            .update({ pilha_id: destination.droppableId })
            .eq("id", movedNote.id);
          if (error) throw error;
          if (notaSelecionada?.id === movedNote.id) {
            setNotaSelecionada((prev) => ({ ...prev, pilha_id: destination.droppableId }));
          }
        } catch (err) {
          console.error("Erro ao atualizar pilha_id:", err);
          alert("Erro ao mover nota no servidor. Revertendo.");
        }
      }
    },
    [columns, notaSelecionada]
  );

  if (loading) return <Loading />;

  return (
    <div className="cards-page">
      <header className="cards-header">
        <button
          className="btn-voltar"
          onClick={() => navigate(-1)}
          title="Voltar"
        >
          <FaArrowLeft />
        </button>
        {entity?.photo_url && (
          <img src={entity.photo_url} alt={entity.name} className="project-photo-header" />
        )}
        <h1>
          Pilhas - <span className="project-name">{entity?.name || "Entidade Desconhecida"}</span>
        </h1>
        <button className="btn-add-pilha" onClick={handleAddColumn}>
          <FaPlus />
        </button>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="cards-body">
          {columns.map((col) => (
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
                      <h3
                        onDoubleClick={() => {
                          setEditingColumnId(col.id);
                          setColumnTitleDraft(col.title);
                        }}
                      >
                        {col.title}
                      </h3>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button className="btn-add" onClick={() => setActiveColumnId(col.id)}>
                        <FaPlus />
                      </button>
                      {/* ✅ Menu de três pontos da pilha */}
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          className="column-menu-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenPilha(menuOpenPilha === col.id ? null : col.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#666',
                            fontSize: '16px',
                            padding: '4px',
                            borderRadius: '4px'
                          }}
                        >
                          <FaEllipsisV />
                        </button>

                        {menuOpenPilha === col.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              backgroundColor: 'white',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                              zIndex: 100,
                              minWidth: '140px',
                              display: 'flex',
                              flexDirection: 'column'
                            }}
                          >
                            {col.notas.length === 0 ? (
                              <button
                                onClick={async () => {
                                  setMenuOpenPilha(null);
                                  await handleDeletePilha(col.id);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  color: '#e53e3e',
                                  fontSize: '14px'
                                }}
                              >
                                <FaTrash /> Excluir pilha
                              </button>
                            ) : (
                              <button
                                disabled
                                style={{
                                  padding: '8px 12px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  color: '#aaa',
                                  fontSize: '14px',
                                  cursor: 'not-allowed'
                                }}
                              >
                                <FaTrash /> Pilha não vazia
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="cards-list">
                    {col.notas.map((nota, index) => (
                      <Draggable key={String(nota.id)} draggableId={String(nota.id)} index={index}>
                        {(prov, snapshot) => (
                          <div
                            className={`card-item tipo-${(nota.tipo || "lista").toLowerCase()} ${
                              snapshot.isDragging ? "dragging" : ""
                            }`}
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            style={{ ...prov.draggableProps.style, userSelect: "none" }}
                            onClick={() => setNotaSelecionada(nota)}
                          >
                            <div className="card-info">
                              <div className="card-title-wrapper">
                                <strong>{nota.nome}</strong>
                              </div>
                              <p>
                                {nota.tipo}
                                {nota.tipo === "Atas" && notaProgresso[nota.id] !== undefined && (
                                  <> - {notaProgresso[nota.id]}%</>
                                )}
                              </p>
                            </div>

                            <div className="card-menu-wrapper" onClick={(e) => e.stopPropagation()}>
                              <button
                                className="card-menu-btn"
                                onClick={() => setMenuOpenNota(menuOpenNota === nota.id ? null : nota.id)}
                              >
                                <FaEllipsisV />
                              </button>
                              {menuOpenNota === nota.id && (
                                <div className="card-menu-dropdown">
                                  <button onClick={() => handleEditNota(nota, col.id)}>
                                    <FaEdit /> Editar
                                  </button>
                                  <button onClick={() => handleDeleteNota(nota.id, col.id)}>
                                    <FaTrash /> Excluir
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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

      <ModalNota
        showNovaNota={!!activeColumnId}
        showEditarNota={!!notaEditData.id && !notaSelecionada}
        showVisualizarNota={!!notaSelecionada}
        onCloseNovaNota={() => setActiveColumnId(null)}
        onCloseEditarNota={() => setNotaEditData({ id: null, nome: "", responsavel: "", pilhaId: null })}
        onCloseVisualizarNota={() => setNotaSelecionada(null)}
        formData={formData}
        setFormData={setFormData}
        handleSaveTask={handleSaveTask}
        notaEditData={notaEditData}
        setNotaEditData={setNotaEditData}
        saveEditedNota={saveEditedNota}
        notaSelecionada={notaSelecionada}
        project={{
          ...entity,
          tipo: entity.type === "project" ? "projeto" : "setor"
        }}
        usuarioAtual={usuarioAtual}
        notaProgresso={notaProgresso}
        setNotaProgresso={setNotaProgresso}
      />
    </div>
  );
}