// src/components/Cards.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./Cards.css";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { FaPlus, FaArrowLeft } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ModalNota from "./ModalNota";
import ListagemEspelho from "./ListagemEspelho";
import Column from "./CardsColumn";

export default function Cards() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

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
  const [notasConcluidas, setNotasConcluidas] = useState(new Set());
  const [dataConclusaoEdit, setDataConclusaoEdit] = useState({});
  const [dataConclusaoSalva, setDataConclusaoSalva] = useState({});

  const atualizarStatusNota = (notaId, updates) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        notas: col.notas.map((nota) =>
          nota.id === notaId ? { ...nota, ...updates } : nota
        ),
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
    navigate(`${location.pathname}?${urlParams.toString()}`, { replace: false });
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

      if (containerId) setDonoContainerId(containerId);
      
      // Se não tiver entityId na URL nem no state, redirecionar
      if (!entityId) {
        console.log("Nenhum entityId encontrado, redirecionando...");
        return navigate("/containers", { replace: true });
      }

      // Atualizar URL apenas se necessário (não substituir, adicionar ao histórico)
      const currentUrl = `${location.pathname}${location.search}`;
      const newUrl = new URLSearchParams();
      newUrl.set('entityId', entityId);
      newUrl.set('type', type);
      if (containerId) newUrl.set('containerId', containerId);
      if (notaIdFromUrl) newUrl.set('nota', notaIdFromUrl);
      
      const targetUrl = `${location.pathname}?${newUrl.toString()}`;
      
      // Só navegar se a URL for diferente
      if (currentUrl !== targetUrl) {
        navigate(targetUrl, { replace: true });
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
          const { data, error } = await supabase.from("projects").select("*").eq("id", entityId).single();
          if (error) {
            console.error("Erro ao carregar projeto:", error);
            alert("Projeto não encontrado ou você não tem permissão para acessá-lo.");
            return navigate("/containers", { replace: true });
          }
          entityData = data;
        } else {
          const { data, error } = await supabase.from("setores").select("*").eq("id", entityId).single();
          if (error) {
            console.error("Erro ao carregar setor:", error);
            alert("Setor não encontrado ou você não tem permissão para acessá-lo.");
            return navigate("/containers", { replace: true });
          }
          entityData = data;
        }

        if (!entityData) {
          alert("Entidade não encontrada.");
          return navigate("/containers", { replace: true });
        }

        const entityName = projectName || setorName || entityData.name;
        const entityPhoto = projectPhoto || setorPhoto || entityData.photo_url;

        const { data: pilhas } = await supabase
          .from("pilhas")
          .select(`
            *,
            notas(
              id, nome, tipo, responsavel, progresso, concluida, data_conclusao,
              enviada, respondida
            )
         `)
          .eq(type === "project" ? "project_id" : "setor_id", entityId)
          .order("ordem", { ascending: true });

        const pilhasOrdenadas = pilhas || [];

        const progressoInicial = {};
        const concluidasInicial = new Set();
        const dataConclusaoInicial = {};

        pilhasOrdenadas.forEach((pilha) => {
          pilha.notas.forEach((nota) => {
            if (nota.progresso != null) {
              progressoInicial[nota.id] = nota.progresso;
            }
            if (nota.concluida) {
              concluidasInicial.add(String(nota.id));
            }
            if (nota.data_conclusao) {
              dataConclusaoInicial[nota.id] = nota.data_conclusao.split("T")[0];
            }
          });
        });

        setNotaProgresso(progressoInicial);
        setNotasConcluidas(concluidasInicial);
        setDataConclusaoSalva(dataConclusaoInicial);

        const columnsData = pilhasOrdenadas.map((p) => ({
          id: String(p.id),
          title: p.title,
          notas: p.notas || [],
          cor_fundo: p.cor_fundo || null,
          ordem: p.ordem || 0,
        }));

        setColumns(columnsData);
        setEntity({ id: entityId, name: entityName, photo_url: entityPhoto, type });

        // Abrir nota automaticamente se estiver na URL
        if (notaIdFromUrl) {
          let notaEncontrada = null;
          let colunaEncontrada = null;
          for (const col of columnsData) {
            const nota = col.notas.find((n) => String(n.id) === notaIdFromUrl);
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
            if (isRecebidos) {
              loadOrigemData(notaEncontrada.id);
            } else {
              setProjetoOrigem(null);
              setNotaOrigem(null);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        navigate("/containers", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [location.pathname]);

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
      } else if (notaSelecionada) {
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
  }, [columns, location.search]);

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
    const outras = columns.filter(c => c.title !== "Recebidos");
    const maxOrdem = outras.length > 0 ? Math.max(...outras.map(c => c.ordem)) : -1;
    const newOrdem = maxOrdem + 1;

    const newPilhaData = { title: "Nova Pilha", ordem: newOrdem };
    if (entityType === "project") newPilhaData.project_id = entity.id;
    else newPilhaData.setor_id = entity.id;

    const { data: newPilha, error } = await supabase
      .from("pilhas")
      .insert([newPilhaData])
      .select()
      .single();

    if (!error) {
      setColumns((prev) => [...prev, { id: String(newPilha.id), title: newPilha.title, notas: [], cor_fundo: null, ordem: newOrdem }]);
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
        if (newConcluida) novo.add(String(notaId));
        else novo.delete(String(notaId));
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

  const saveColumnsOrder = async (newColumns) => {
    const updates = newColumns
      .filter(col => col.title !== "Recebidos")
      .map((col, index) => ({
        id: col.id,
        ordem: index
      }));

    const { error } = await supabase
      .from("pilhas")
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      console.error("Erro ao salvar ordem das pilhas:", error);
    } else {
      setColumns(prev =>
        prev.map(col => {
          const updated = updates.find(u => u.id === col.id);
          return updated ? { ...col, ordem: updated.ordem } : col;
        })
      );
    }
  };

  const onDragEnd = useCallback(
    async (result) => {
      const { source, destination, type } = result;

      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      if (type === "COLUMN") {
        const newColumns = Array.from(columns);
        const [moved] = newColumns.splice(source.index, 1);
        newColumns.splice(destination.index, 0, moved);

        const recebidosIndex = newColumns.findIndex(col => col.title === "Recebidos");
        if (recebidosIndex !== -1 && recebidosIndex !== 0) {
          const recebidosCol = newColumns.splice(recebidosIndex, 1)[0];
          newColumns.unshift(recebidosCol);
        }

        setColumns(newColumns);
        saveColumnsOrder(newColumns);
        return;
      }

      if (type === "CARD") {
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
              const destIsRecebidos = columns.find((c) => c.id === destination.droppableId)?.title === "Recebidos";
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
        <Droppable droppableId="all-columns" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              className="cards-body"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {columns.map((col, index) => (
                <Column
                  key={col.id}
                  col={col}
                  index={index}
                  columns={columns}
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
                  setColumns={setColumns}
                  toggleConclusaoNota={toggleConclusaoNota}
                  setDataConclusaoEdit={setDataConclusaoEdit}
                  saveDataConclusao={saveDataConclusao}
                  handleOpenNota={handleOpenNota}
                  handleEditNota={handleEditNota}
                  handleDeleteNota={handleDeleteNota}
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