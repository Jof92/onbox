// src/components/Cards.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Cards.css";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { FaPlus, FaArrowLeft, FaEllipsisV, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ModalNota from "./ModalNota";
import ListagemEspelho from "./ListagemEspelho";

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
  const [projetoOrigem, setProjetoOrigem] = useState(null);
  const [notaOrigem, setNotaOrigem] = useState(null);
  const [donoContainerId, setDonoContainerId] = useState(null);
  const [isNotaRecebidos, setIsNotaRecebidos] = useState(false);

  const [showColorPicker, setShowColorPicker] = useState({});

  // Estado para controlar notas concluídas
  const [notasConcluidas, setNotasConcluidas] = useState(new Set());

  // ✅ Novo estado para controlar edição de data de conclusão
  const [dataConclusaoEdit, setDataConclusaoEdit] = useState({});
  const [dataConclusaoSalva, setDataConclusaoSalva] = useState({});

  const colorTrackRefs = useRef({});

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
        containerId: containerIdFromState,
      } = location.state || {};

      const entityId = projectId || setorId;
      const entityName = projectName || setorName || "Entidade";
      const entityPhoto = projectPhoto || setorPhoto;
      const type = typeFromState || (projectId ? "project" : "setor");

      if (containerIdFromState) setDonoContainerId(containerIdFromState);
      if (!entityId) return navigate("/containers", { replace: true });

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

        if (!entityData) return navigate("/containers", { replace: true });

        const { data: pilhas } = await supabase
          .from("pilhas")
          .select("*, notas(id, nome, tipo, responsavel, progresso, concluida, data_conclusao)")
          .eq(type === "project" ? "project_id" : "setor_id", entityId)
          .order("created_at");

        const pilhasData = pilhas || [];
        const progressoInicial = {};
        const concluidasInicial = new Set();
        const dataConclusaoInicial = {};

        pilhasData.forEach((pilha) => {
          pilha.notas.forEach((nota) => {
            if (nota.progresso != null) {
              progressoInicial[nota.id] = nota.progresso;
            }
            if (nota.concluida) {
              concluidasInicial.add(String(nota.id));
            }
            if (nota.data_conclusao) {
              dataConclusaoInicial[nota.id] = nota.data_conclusao.split("T")[0]; // ISO date -> YYYY-MM-DD
            }
          });
        });

        setNotaProgresso(progressoInicial);
        setNotasConcluidas(concluidasInicial);
        setDataConclusaoSalva(dataConclusaoInicial);

        const recebidos = pilhasData.filter((p) => p.title === "Recebidos");
        const outras = pilhasData.filter((p) => p.title !== "Recebidos");
        const pilhasOrdenadas = [...recebidos, ...outras];

        setColumns(
          pilhasOrdenadas.map((p) => ({
            id: String(p.id),
            title: p.title,
            notas: p.notas || [],
            cor_fundo: p.cor_fundo || null,
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

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const notaId = urlParams.get("nota");
    if (notaId && columns.length > 0) {
      let notaEncontrada = null;
      let colunaEncontrada = null;
      for (const col of columns) {
        const nota = col.notas.find((n) => String(n.id) === notaId);
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
        if (isRecebidos) loadOrigemData(notaEncontrada.id);
        else {
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
      console.error("Erro ao carregar dados de origem:", err);
      setProjetoOrigem(null);
      setNotaOrigem(null);
    }
  };

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

  const updatePilhaCor = async (pilhaId, cor) => {
    const { error } = await supabase
      .from("pilhas")
      .update({ cor_fundo: cor })
      .eq("id", pilhaId);

    if (!error) {
      setColumns((prev) =>
        prev.map((col) => (col.id === pilhaId ? { ...col, cor_fundo: cor } : col))
      );
    }
  };

  const handleResetCor = (pilhaId) => {
    updatePilhaCor(pilhaId, null);
    setShowColorPicker((prev) => ({ ...prev, [pilhaId]: false }));
  };

  const toggleColorPicker = (pilhaId, show) => {
    setShowColorPicker((prev) => ({ ...prev, [pilhaId]: show }));
    if (show) {
      setMenuOpenPilha(null);
    }
  };

  useEffect(() => {
    const setupClickHandlers = () => {
      Object.keys(showColorPicker).forEach((colId) => {
        if (!showColorPicker[colId]) return;

        const track = colorTrackRefs.current[colId];
        if (!track) return;

        const handleClick = (e) => {
          const rect = track.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const width = rect.width;
          const pct = Math.max(0, Math.min(1, x / width));
          const hue = Math.round(pct * 360);
          const cor = `hsl(${hue}, 40%, 94%)`;
          updatePilhaCor(colId, cor);
        };

        track.addEventListener("click", handleClick);
        return () => track.removeEventListener("click", handleClick);
      });
    };

    setupClickHandlers();
  }, [showColorPicker]);

  // === Funções principais ===

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
      setColumns((prev) => [...prev, { id: String(newPilha.id), title: newPilha.title, notas: [], cor_fundo: null }]);
    }
  };

  const saveColumnTitle = async (id) => {
    if (!columnTitleDraft.trim()) return setEditingColumnId(null);
    const { error } = await supabase.from("pilhas").update({ title: columnTitleDraft }).eq("id", id);
    if (!error) {
      setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title: columnTitleDraft } : c)));
    }
    setEditingColumnId(null);
  };

  const handleDeletePilha = async (pilhaId) => {
    const pilha = columns.find((c) => c.id === pilhaId);
    if (!pilha || pilha.notas.length > 0) {
      alert("Apenas pilhas vazias podem ser excluídas.");
      return;
    }
    if (!window.confirm(`Excluir a pilha "${pilha.title}"?`)) return;

    const { error } = await supabase.from("pilhas").delete().eq("id", pilhaId);
    if (!error) {
      setColumns((prev) => prev.filter((c) => c.id !== pilhaId));
      setMenuOpenPilha(null);
    }
  };

  const toggleConclusaoNota = async (notaId, concluida) => {
    const newConcluida = !concluida;
    const { error } = await supabase
      .from("notas")
      .update({ concluida: newConcluida })
      .eq("id", notaId);

    if (!error) {
      setNotasConcluidas((prev) => {
        const novo = new Set(prev);
        if (newConcluida) {
          novo.add(String(notaId));
        } else {
          novo.delete(String(notaId));
        }
        return novo;
      });
    } else {
      console.error("Erro ao atualizar conclusão:", error);
    }
  };

  const handleSaveTask = async () => {
    if (!formData.nome.trim() || !activeColumnId) return;
    if (!usuarioId) {
      alert("Você precisa estar logado para criar uma nota.");
      return;
    }

    try {
      const { nome, tipo } = formData;
      const { data: newNota, error } = await supabase
        .from("notas")
        .insert([{ nome, tipo, pilha_id: activeColumnId, responsavel: usuarioId, concluida: false }])
        .select()
        .single();

      if (error) throw error;

      setColumns((prev) =>
        prev.map((c) => (c.id === activeColumnId ? { ...c, notas: [newNota, ...c.notas] } : c))
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
      setColumns((prev) =>
        prev.map((c) =>
          c.id === pilhaId ? { ...c, notas: c.notas.filter((n) => n.id !== notaId) } : c
        )
      );
      setMenuOpenNota(null);
      setNotaProgresso((p) => {
        const cp = { ...p };
        delete cp[notaId];
        return cp;
      });
      setNotasConcluidas((prev) => {
        const novo = new Set(prev);
        novo.delete(String(notaId));
        return novo;
      });
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
    } else {
      console.error("Erro ao editar nota:", error);
      alert("Erro ao salvar alterações.");
    }
  };

  // ✅ Função para salvar data de conclusão
  const saveDataConclusao = async (notaId, data) => {
    const { error } = await supabase
      .from("notas")
      .update({ data_conclusao: data || null })
      .eq("id", notaId);

    if (!error) {
      setDataConclusaoSalva((prev) => ({ ...prev, [notaId]: data || "" }));
      setDataConclusaoEdit((prev) => {
        const cp = { ...prev };
        delete cp[notaId];
        return cp;
      });
    } else {
      console.error("Erro ao salvar data de conclusão:", error);
    }
  };

  // ✅ Clique fora do campo de data
  useEffect(() => {
    const handleClickOutsideDate = (e) => {
      Object.keys(dataConclusaoEdit).forEach((id) => {
        const el = document.querySelector(`.data-conclusao-container[data-nota-id="${id}"]`);
        if (el && !el.contains(e.target)) {
          saveDataConclusao(id, dataConclusaoEdit[id]);
        }
      });
    };

    if (Object.keys(dataConclusaoEdit).length > 0) {
      document.addEventListener("mousedown", handleClickOutsideDate);
      return () => document.removeEventListener("mousedown", handleClickOutsideDate);
    }
  }, [dataConclusaoEdit]);

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
          await supabase.from("notas").update({ pilha_id: destination.droppableId }).eq("id", movedNote.id);
          if (notaSelecionada?.id === movedNote.id) {
            setNotaSelecionada((prev) => ({ ...prev, pilha_id: destination.droppableId }));
            const destIsRecebidos = destination.droppableId === columns.find((c) => c.title === "Recebidos")?.id;
            setIsNotaRecebidos(destIsRecebidos);
            if (destIsRecebidos) loadOrigemData(movedNote.id);
            else {
              setProjetoOrigem(null);
              setNotaOrigem(null);
            }
          }
        } catch (err) {
          console.error("Erro ao mover nota:", err);
          alert("Erro ao mover nota. Revertendo.");
        }
      }
    },
    [columns, notaSelecionada]
  );

  const handleOpenNota = (nota) => {
    let isRecebidos = false;
    for (const col of columns) {
      if (col.notas.some((n) => n.id === nota.id)) {
        isRecebidos = col.title === "Recebidos";
        break;
      }
    }
    setNotaSelecionada(nota);
    setIsNotaRecebidos(isRecebidos);
    if (isRecebidos) loadOrigemData(nota.id);
    else {
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
        {entity?.photo_url && <img src={entity.photo_url} alt={entity.name} className="project-photo-header" />}
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
            const bgColor = col.cor_fundo || (isRecebidos ? "rgba(46, 125, 50, 0.08)" : "transparent");
            const isColorPickerVisible = showColorPicker[col.id];

            return (
              <Droppable key={col.id} droppableId={col.id}>
                {(provided) => (
                  <div
                    className="cards-column"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      backgroundColor: bgColor,
                      border: isRecebidos ? "1px solid rgba(46, 125, 50, 0.2)" : "1px solid rgba(0, 0, 0, 0.08)",
                      borderRadius: "8px",
                      padding: "8px",
                      position: "relative",
                    }}
                  >
                    {isColorPickerVisible && !isRecebidos && (
                      <div className="color-picker-toolbar">
                        <button
                          className="reset-color-dot"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetCor(col.id);
                          }}
                          title="Cor original"
                        />
                        <div
                          ref={(el) => (colorTrackRefs.current[col.id] = el)}
                          className="color-track"
                        />
                        <button
                          className="close-color-picker"
                          onClick={() => toggleColorPicker(col.id, false)}
                          title="Fechar"
                        >
                          <FaTimes size={12} />
                        </button>
                      </div>
                    )}

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

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {!isRecebidos && (
                          <button className="btn-add" onClick={() => setActiveColumnId(col.id)}>
                            <FaPlus />
                          </button>
                        )}

                        {!isRecebidos && (
                          <div style={{ position: "relative", display: "inline-block" }}>
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
                              <div className="card-menu-dropdown" style={{ top: "100%", right: 0 }}>
                                <button
                                  onClick={() => {
                                    setMenuOpenPilha(null);
                                    toggleColorPicker(col.id, true);
                                  }}
                                >
                                  🎨 Estilo
                                </button>
                                {col.notas.length === 0 ? (
                                  <button
                                    onClick={async () => {
                                      setMenuOpenPilha(null);
                                      await handleDeletePilha(col.id);
                                    }}
                                    style={{ color: "#e53e3e" }}
                                  >
                                    <FaTrash /> Excluir pilha
                                  </button>
                                ) : (
                                  <button disabled style={{ color: "#aaa" }}>
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
                      {col.notas.map((nota, index) => {
                        const isConcluida = notasConcluidas.has(String(nota.id));
                        const isEditingDate = dataConclusaoEdit.hasOwnProperty(String(nota.id));

                        return (
                          <Draggable key={String(nota.id)} draggableId={String(nota.id)} index={index}>
                            {(prov, snapshot) => (
                              <div
                                className={`card-item tipo-${(nota.tipo || "lista").toLowerCase()} ${snapshot.isDragging ? "dragging" : ""} ${isConcluida ? "concluida" : ""}`}
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                style={{ ...prov.draggableProps.style, userSelect: "none" }}
                                onClick={() => handleOpenNota(nota)}
                              >
                                <div
                                  className="concluir-checkbox-wrapper"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleConclusaoNota(nota.id, isConcluida);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isConcluida}
                                    readOnly
                                    className="concluir-checkbox"
                                  />
                                </div>

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

                                  {/* ✅ Campo de data de conclusão (só aparece se concluída) */}
                                  {isConcluida && (
                                    <div
                                      className="data-conclusao-container"
                                      data-nota-id={nota.id}
                                      onClick={(e) => e.stopPropagation()} // ←←← CORREÇÃO PRINCIPAL AQUI
                                    >
                                      {isEditingDate ? (
                                        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                                          <input
                                            type="date"
                                            value={dataConclusaoEdit[nota.id] || ""}
                                            onChange={(e) =>
                                              setDataConclusaoEdit((prev) => ({
                                                ...prev,
                                                [nota.id]: e.target.value,
                                              }))
                                            }
                                            onClick={(e) => e.stopPropagation()} // ←←← também aqui, para clicar no input
                                            style={{ fontSize: "0.85em", padding: "2px 4px" }}
                                          />
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              saveDataConclusao(nota.id, dataConclusaoEdit[nota.id]);
                                            }}
                                            style={{ fontSize: "0.8em" }}
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDataConclusaoEdit((prev) => {
                                                const cp = { ...prev };
                                                delete cp[nota.id];
                                                return cp;
                                              });
                                            }}
                                            style={{ fontSize: "0.8em", color: "#e53e3e" }}
                                          >
                                            ✖
                                          </button>
                                        </div>
                                      ) : (
                                        <div
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDataConclusaoEdit((prev) => ({
                                              ...prev,
                                              [nota.id]: dataConclusaoSalva[nota.id] || "",
                                            }));
                                          }}
                                          style={{
                                            marginTop: "4px",
                                            fontSize: "0.85em",
                                            color: dataConclusaoSalva[nota.id] ? "#444" : "#999",
                                            fontStyle: dataConclusaoSalva[nota.id] ? "normal" : "italic",
                                          }}
                                        >
                                          {dataConclusaoSalva[nota.id]
                                            ? new Date(dataConclusaoSalva[nota.id]).toLocaleDateString("pt-BR")
                                            : "Data da entrega"}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* ✅ Menu de três pontos só aparece se NÃO concluída */}
                                {!isConcluida && (
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
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

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