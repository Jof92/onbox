// src/components/Cards.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Cards.css";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { FaPlus, FaArrowLeft, FaEllipsisV, FaEdit, FaTrash } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ModalNota from "./ModalNota";
import ListagemEspelho from "./ListagemEspelho"; // ✅ Novo componente

export default function Cards() {
  const location = useLocation();
  const navigate = useNavigate();

  const [entity, setEntity] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("project");

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
  const [projetoOrigem, setProjetoOrigem] = useState(null); // ✅
  const [notaOrigem, setNotaOrigem] = useState(null);       // ✅

  const [donoContainerId, setDonoContainerId] = useState(null);
  const [isNotaRecebidos, setIsNotaRecebidos] = useState(false); // ✅

  // ✅ Função para atualizar a URL com o ID da nota
  const updateUrlWithNota = (notaId) => {
    if (notaId) {
      navigate(`${location.pathname}?nota=${notaId}`, { replace: true });
    } else {
      navigate(location.pathname, { replace: true });
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      const { 
        projectId, 
        setorId, 
        projectName, 
        setorName, 
        projectPhoto, 
        setorPhoto, 
        entityType: typeFromState,
        containerId: containerIdFromState 
      } = location.state || {};
      
      const entityId = projectId || setorId;
      const entityName = projectName || setorName || "Entidade";
      const entityPhoto = projectPhoto || setorPhoto;
      const type = typeFromState || (projectId ? "project" : "setor");

      if (containerIdFromState) {
        setDonoContainerId(containerIdFromState);
      }

      if (!entityId) {
        navigate("/containers", { replace: true });
        return;
      }

      setEntityType(type);
      setLoading(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        setUsuarioId(currentUserId);

        if (currentUserId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", currentUserId)
            .single();
          if (profile?.nome) setUsuarioAtual(profile.nome);
        }

        let entityData = null;
        if (type === "project") {
          const { data } = await supabase.from("projects").select("*").eq("id", entityId).single();
          entityData = data;
        } else {
          const { data } = await supabase.from("setores").select("*").eq("id", entityId).single();
          entityData = data;
        }

        if (!entityData) {
          navigate("/containers", { replace: true });
          return;
        }

        const { data: pilhas } = await supabase
          .from("pilhas")
          .select("*, notas(id, nome, tipo, responsavel, progresso)")
          .eq(type === "project" ? "project_id" : "setor_id", entityId)
          .order("created_at");

        const pilhasData = pilhas || [];
        const progressoInicial = {};
        pilhasData.forEach((pilha) => {
          pilha.notas.forEach((nota) => {
            if (nota.progresso != null) {
              progressoInicial[nota.id] = nota.progresso;
            }
          });
        });
        setNotaProgresso(progressoInicial);

        // ✅ Separa "Recebidos" das demais pilhas
        const recebidos = pilhasData.filter(p => p.title === "Recebidos");
        const outras = pilhasData.filter(p => p.title !== "Recebidos");
        const pilhasOrdenadas = [...recebidos, ...outras];

        setColumns(
          pilhasOrdenadas.map((p) => ({
            id: String(p.id),
            title: p.title,
            notas: p.notas || [],
          }))
        );

        setEntity({ id: entityId, name: entityName, photo_url: entityPhoto, type });

      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        navigate("/containers", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [location.state, navigate]);

  // ✅ Verifica se há parâmetro "nota" na URL após carregar as colunas
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const notaId = urlParams.get('nota');
    if (notaId && columns.length > 0) {
      let notaEncontrada = null;
      let colunaEncontrada = null;
      for (const col of columns) {
        const nota = col.notas.find(n => String(n.id) === notaId);
        if (nota) {
          notaEncontrada = nota;
          colunaEncontrada = col;
          break;
        }
      }
      if (notaEncontrada) {
        setNotaSelecionada(notaEncontrada);
        const isRecebidos = colunaEncontrada?.title === "Recebidos";
        setIsNotaRecebidos(isRecebidos);

        // ✅ Se for Recebidos, carregar dados de origem
        if (isRecebidos) {
          loadOrigemData(notaEncontrada.id);
        } else {
          setProjetoOrigem(null);
          setNotaOrigem(null);
        }
        updateUrlWithNota(notaId);
      } else {
        navigate(location.pathname, { replace: true });
      }
    } else {
      setNotaSelecionada(null);
      setIsNotaRecebidos(false);
      setProjetoOrigem(null);
      setNotaOrigem(null);
    }
  }, [columns, location.search, navigate]);

  // ✅ Carregar dados de origem (projeto e nota original)
  const loadOrigemData = async (notaEspelhoId) => {
    try {
      // Suponha que a nota espelho tenha campos: projeto_origem_id, nota_original_id
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
        // Caso não tenha nota_original_id, usar nome atual como fallback
        setNotaOrigem({ id: notaEspelhoId, nome: notaEspelho?.nome || "Sem nome" });
      }
    } catch (err) {
      console.error("Erro ao carregar dados de origem:", err);
      setProjetoOrigem(null);
      setNotaOrigem(null);
    }
  };

  // ✅ FECHAR MENU DE NOTA AO CLICAR FORA
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuOpenNota &&
        !e.target.closest('.card-menu-dropdown') &&
        !e.target.closest('.card-menu-btn')
      ) {
        setMenuOpenNota(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenNota]);

  // ✅ FECHAR MENU DE PILHA AO CLICAR FORA
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuOpenPilha &&
        !e.target.closest('.card-menu-dropdown') &&
        !e.target.closest('.column-menu-btn')
      ) {
        setMenuOpenPilha(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenPilha]);

  const handleAddColumn = async () => {
    if (!entity) return;
    const newPilhaData = { title: "Nova Pilha" };
    if (entityType === "project") newPilhaData.project_id = entity.id;
    else newPilhaData.setor_id = entity.id;

    const { data: newPilha, error } = await supabase
      .from("pilhas")
      .insert([newPilhaData])
      .select()
      .single();

    if (!error) {
      setColumns(prev => [...prev, { id: String(newPilha.id), title: newPilha.title, notas: [] }]);
    }
  };

  const saveColumnTitle = async (id) => {
    if (!columnTitleDraft.trim()) return setEditingColumnId(null);
    const { error } = await supabase.from("pilhas").update({ title: columnTitleDraft }).eq("id", id);
    if (!error) {
      setColumns(prev => prev.map(c => c.id === id ? { ...c, title: columnTitleDraft } : c));
    }
    setEditingColumnId(null);
  };

  const handleDeletePilha = async (pilhaId) => {
    const pilha = columns.find(c => c.id === pilhaId);
    if (!pilha || pilha.notas.length > 0) {
      alert("Apenas pilhas vazias podem ser excluídas.");
      return;
    }
    if (!window.confirm(`Excluir a pilha "${pilha.title}"?`)) return;

    const { error } = await supabase.from("pilhas").delete().eq("id", pilhaId);
    if (!error) {
      setColumns(prev => prev.filter(c => c.id !== pilhaId));
      setMenuOpenPilha(null);
    }
  };

  // ✅ ✅ ✅ FUNÇÃO CORRIGIDA: AGORA INCLUI `responsavel: usuarioId` AO CRIAR NOTA
  const handleSaveTask = async () => {
    if (!formData.nome.trim() || !activeColumnId) {
      console.warn("Dados inválidos para criar nota", { nome: formData.nome, pilha: activeColumnId });
      return;
    }

    // Garante que o usuário esteja logado
    if (!usuarioId) {
      alert("Você precisa estar logado para criar uma nota.");
      return;
    }

    try {
      const { nome, tipo } = formData;

      const { data: newNota, error } = await supabase
        .from("notas")
        .insert([
          {
            nome,
            tipo,
            pilha_id: activeColumnId,
            responsavel: usuarioId, // ← ← ← ESSE É O PONTO CRÍTICO!
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setColumns(prev =>
        prev.map(c => c.id === activeColumnId ? { ...c, notas: [newNota, ...c.notas] } : c)
      );

      if (["Atas", "Tarefas", "Lista", "Metas"].includes(newNota.tipo)) {
        setNotaSelecionada(newNota);
        updateUrlWithNota(newNota.id);
        setIsNotaRecebidos(false);
        setProjetoOrigem(null);
        setNotaOrigem(null);
      }
    } catch (err) {
      console.error("Erro ao criar nota:", err);
      alert(`Erro ao criar nota: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setFormData({ nome: "", responsavel: "", tipo: "Lista" });
      setActiveColumnId(null);
    }
  };

  const handleDeleteNota = async (notaId, pilhaId) => {
    if (!window.confirm("Excluir esta nota?")) return;
    const { error } = await supabase.from("notas").delete().eq("id", notaId);
    if (!error) {
      setColumns(prev =>
        prev.map(c => c.id === pilhaId ? { ...c, notas: c.notas.filter(n => n.id !== notaId) } : c)
      );
      setMenuOpenNota(null);
      setNotaProgresso(p => { const cp = { ...p }; delete cp[notaId]; return cp; });
      if (notaSelecionada?.id === notaId) {
        setNotaSelecionada(null);
        setIsNotaRecebidos(false);
        setProjetoOrigem(null);
        setNotaOrigem(null);
        updateUrlWithNota(null);
      }
    } else {
      console.error("Erro ao excluir nota:", error);
      alert("Não foi possível excluir a nota. Você só pode excluir notas que criou.");
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
      setColumns(prev =>
        prev.map(c =>
          c.id === pilhaId
            ? { ...c, notas: c.notas.map(n => n.id === id ? { ...n, nome, responsavel } : n) }
            : c
        )
      );
      if (notaSelecionada?.id === id) {
        setNotaSelecionada(prev => ({ ...prev, nome, responsavel }));
      }
      setNotaEditData({ id: null, nome: "", responsavel: "", pilhaId: null });
    } else {
      console.error("Erro ao editar nota:", error);
      alert("Erro ao salvar alterações.");
    }
  };

  const onDragEnd = useCallback(async ({ source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const nextColumns = columns.map(c => ({ ...c, notas: [...c.notas] }));
    const sourceCol = nextColumns.find(c => c.id === source.droppableId);
    const [movedNote] = sourceCol.notas.splice(source.index, 1);
    const destCol = nextColumns.find(c => c.id === destination.droppableId);
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
          setNotaSelecionada(prev => ({ ...prev, pilha_id: destination.droppableId }));
          // Atualiza isNotaRecebidos se mover para/fora de Recebidos
          const destIsRecebidos = destination.droppableId === columns.find(c => c.title === "Recebidos")?.id;
          setIsNotaRecebidos(destIsRecebidos);
          if (destIsRecebidos) {
            loadOrigemData(movedNote.id);
          } else {
            setProjetoOrigem(null);
            setNotaOrigem(null);
          }
        }
      } catch (err) {
        console.error("Erro ao mover nota:", err);
        alert("Erro ao mover nota. Revertendo.");
      }
    }
  }, [columns, notaSelecionada]);

  const handleOpenNota = (nota) => {
    // Encontrar a coluna da nota para verificar se é Recebidos
    let isRecebidos = false;
    for (const col of columns) {
      if (col.notas.some(n => n.id === nota.id)) {
        isRecebidos = col.title === "Recebidos";
        break;
      }
    }
    setNotaSelecionada(nota);
    setIsNotaRecebidos(isRecebidos);
    if (isRecebidos) {
      loadOrigemData(nota.id);
    } else {
      setProjetoOrigem(null);
      setNotaOrigem(null);
    }
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

  return (
    <div className="cards-page">
      <header className="cards-header">
        <button 
          className="btn-voltar" 
          onClick={() => {
            if (donoContainerId) {
              navigate(`/containers/${donoContainerId}`);
            } else {
              navigate("/containers");
            }
          }} 
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
          {columns.map((col) => {
            const isRecebidos = col.title === "Recebidos";

            return (
              <Droppable key={col.id} droppableId={col.id}>
                {(provided) => (
                  <div
                    className="cards-column"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      backgroundColor: isRecebidos ? "rgba(46, 125, 50, 0.08)" : "transparent",
                      border: isRecebidos ? "1px solid rgba(46, 125, 50, 0.2)" : "none",
                      borderRadius: "8px",
                      padding: "8px",
                    }}
                  >
                    <div className="column-header">
                      {editingColumnId === col.id && !isRecebidos ? (
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
                          style={{ cursor: isRecebidos ? "default" : "pointer" }}
                          onDoubleClick={() => {
                            if (!isRecebidos) {
                              setEditingColumnId(col.id);
                              setColumnTitleDraft(col.title);
                            }
                          }}
                        >
                          {col.title}
                        </h3>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {!isRecebidos && (
                          <button className="btn-add" onClick={() => setActiveColumnId(col.id)}>
                            <FaPlus />
                          </button>
                        )}

                        {!isRecebidos && (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              className="column-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenPilha(menuOpenPilha === col.id ? null : col.id);
                              }}
                            >
                              <FaEllipsisV />
                            </button>
                            {menuOpenPilha === col.id && (
                              <div className="card-menu-dropdown" style={{ top: '100%', right: 0 }}>
                                {col.notas.length === 0 ? (
                                  <button
                                    onClick={async () => {
                                      setMenuOpenPilha(null);
                                      await handleDeletePilha(col.id);
                                    }}
                                    style={{ color: '#e53e3e' }}
                                  >
                                    <FaTrash /> Excluir pilha
                                  </button>
                                ) : (
                                  <button disabled style={{ color: '#aaa' }}>
                                    <FaTrash /> Pilha não vazia
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="cards-list">
                      {col.notas.map((nota, index) => (
                        <Draggable key={String(nota.id)} draggableId={String(nota.id)} index={index}>
                          {(prov, snapshot) => (
                            <div
                              className={`card-item tipo-${(nota.tipo || "lista").toLowerCase()} ${snapshot.isDragging ? "dragging" : ""}`}
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              style={{ ...prov.draggableProps.style, userSelect: "none" }}
                              onClick={() => handleOpenNota(nota)}
                            >
                              <div className="card-info">
                                <div className="card-title-wrapper"><strong>{nota.nome}</strong></div>
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
            );
          })}
        </div>
      </DragDropContext>

      {/* ✅ Renderiza ListagemEspelho se a nota estiver em "Recebidos" */}
      {isNotaRecebidos && notaSelecionada ? (
        <div className="modal-overlay">
          <div className="modal-content listagem-espelho-modal">
            <ListagemEspelho
              projetoOrigem={projetoOrigem}
              notaOrigem={notaOrigem}
              notaEspelhoId={notaSelecionada.id}
              onClose={handleCloseNota}
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
        />
      )}
    </div>
  );
}