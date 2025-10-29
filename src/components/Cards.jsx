// Cards.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Cards.css";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { FaPlus, FaArrowLeft, FaEllipsisV, FaEdit, FaTrash } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ModalNota from "./ModalNota";

// Badge de progresso
const NotaProgressoBadge = ({ notaId, notaProgresso }) =>
  notaProgresso[notaId] !== undefined ? (
    <span className="nota-progresso-badge">{notaProgresso[notaId]}%</span>
  ) : null;

export default function Cards() {
  const location = useLocation();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeColumnId, setActiveColumnId] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState("");

  const [formData, setFormData] = useState({ nome: "", responsavel: "", tipo: "Lista" });
  const [notaEditData, setNotaEditData] = useState({ id: null, nome: "", responsavel: "", pilhaId: null });
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  // ✅ REMOVIDO: pilhaSelecionada — não é mais necessário
  const [usuarioAtual, setUsuarioAtual] = useState("Usuário Atual");
  const [notaProgresso, setNotaProgresso] = useState({});
  const [menuOpenNota, setMenuOpenNota] = useState(null);

  // --- Load project + pilhas ---
  useEffect(() => {
    const projectId = location.state?.projectId;
    if (!projectId) return navigate("/containers", { replace: true });

    (async () => {
      setLoading(true);
      try {
        const { data: projectData } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();
        if (!projectData) return navigate("/containers", { replace: true });

        const [{ photo_url } = {}] =
          (await supabase
            .from("projects_photos")
            .select("photo_url")
            .eq("project_id", projectId)
            .order("created_at")
            .limit(1)
          ).data || [];

        const pavimentos = (await supabase
          .from("pavimentos")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at")
        ).data || [];

        const eap = (await supabase
          .from("eap")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at")
        ).data || [];

        const { data: userData } = await supabase.from("profiles").select("nome").limit(1).single();
        if (userData?.nome) setUsuarioAtual(userData.nome);

        const pilhasData =
          (await supabase
            .from("pilhas")
            .select("*, notas(*)")
            .eq("project_id", projectId)
            .order("created_at")
          ).data || [];

        setColumns(pilhasData.map((p) => ({ id: String(p.id), title: p.title, notas: p.notas || [] })));
        setProject({ ...projectData, photo_url, pavimentos, eap });
      } catch (err) {
        console.error("Erro ao carregar projeto/pilhas:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [location.state, navigate]);

  // --- CRUD Pilha ---
  const handleAddColumn = async () => {
    if (!project) return;
    const { data: newPilha, error } = await supabase
      .from("pilhas")
      .insert([{ project_id: project.id, title: "Nova Pilha" }])
      .select()
      .single();
    if (error) return console.error(error);
    setColumns((prev) => [...prev, { id: String(newPilha.id), title: newPilha.title, notas: [] }]);
  };

  const saveColumnTitle = async (id) => {
    if (!columnTitleDraft.trim()) return setEditingColumnId(null);
    const { error } = await supabase.from("pilhas").update({ title: columnTitleDraft }).eq("id", id);
    if (!error)
      setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title: columnTitleDraft } : c)));
    setEditingColumnId(null);
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

      // ✅ Ao criar, já abre a nota (se for do tipo certo)
      if (["Atas", "Tarefas", "Lista"].includes(newNota.tipo)) {
        setNotaSelecionada(newNota); // ✅ objeto completo
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
      // Fechar modal se a nota excluída estiver aberta
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
      // Atualizar notaSelecionada se estiver aberta
      if (notaSelecionada?.id === id) {
        setNotaSelecionada(prev => ({ ...prev, nome, responsavel }));
      }
      setNotaEditData({ id: null, nome: "", responsavel: "", pilhaId: null });
    }
  };

  // --- Drag & Drop ---
  const onDragEnd = useCallback(
    async ({ source, destination }) => {
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      const nextColumns = columns.map(c => ({ ...c, notas: [...c.notas] }));

      const sourceCol = nextColumns.find(c => c.id === source.droppableId);
      const [movedNote] = sourceCol.notas.splice(source.index, 1);

      const destCol = nextColumns.find(c => c.id === destination.droppableId);
      destCol.notas.splice(destination.index, 0, movedNote);

      setColumns(nextColumns);

      // Atualizar no banco
      if (source.droppableId !== destination.droppableId) {
        try {
          const { error } = await supabase
            .from("notas")
            .update({ pilha_id: destination.droppableId })
            .eq("id", movedNote.id);
          if (error) throw error;

          // ✅ Se a nota movida estiver aberta, atualize seu pilha_id
          if (notaSelecionada?.id === movedNote.id) {
            setNotaSelecionada(prev => ({ ...prev, pilha_id: destination.droppableId }));
          }
        } catch (err) {
          console.error("Erro ao atualizar pilha_id:", err);
          alert("Erro ao mover nota no servidor. Revertendo.");
          // Reverter UI (opcional, mas recomendado em produção)
        }
      }
    },
    [columns, notaSelecionada]
  );

  if (loading) return <Loading />;

  return (
    <div className="cards-page">
      <header className="cards-header">
        <button className="btn-voltar" onClick={() => navigate("/containers")} title="Voltar">
          <FaArrowLeft />
        </button>
        {project?.photo_url && <img src={project.photo_url} alt={project.name} className="project-photo-header" />}
        <h1>
          Pilhas - <span className="project-name">{project?.name || "Projeto Desconhecido"}</span>
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
                    <button className="btn-add" onClick={() => setActiveColumnId(col.id)}>
                      <FaPlus />
                    </button>
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
                          >
                            <div
                              className="card-info"
                              onClick={() => {
                                // ✅ Passa o objeto completo da nota — SEM pilhaSelecionada
                                setNotaSelecionada(nota);
                              }}
                            >
                              <div className="card-title-wrapper">
                                <strong>{nota.nome}</strong>
                                <NotaProgressoBadge notaId={nota.id} notaProgresso={notaProgresso} />
                              </div>
                              <p>{nota.tipo}</p>
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

      {/* ✅ ModalNota: removido pilhaSelecionada */}
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
        // ❌ REMOVIDO: pilhaSelecionada
        project={project}
        usuarioAtual={usuarioAtual}
        notaProgresso={notaProgresso}
        setNotaProgresso={setNotaProgresso}
      />
    </div>
  );
}