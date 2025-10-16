import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Cards.css';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FaPlus, FaArrowLeft, FaTimes } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import Listagem from './Listagem';
import Loading from './Loading';

export default function Cards() {
  const location = useLocation();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [columns, setColumns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState('');
  const [formData, setFormData] = useState({ nome: '', responsavel: '', tipo: 'Lista' });
  const [loading, setLoading] = useState(true);
  const [showListagem, setShowListagem] = useState(false);

  const [pilhaSelecionada, setPilhaSelecionada] = useState(null);
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [usuarioAtual, setUsuarioAtual] = useState("Usuário Atual");

  useEffect(() => {
    const projectId = location.state?.projectId;
    if (!projectId) {
      alert('Projeto não encontrado!');
      navigate('/containers');
      return;
    }

    const fetchProjectData = async () => {
      setLoading(true);

      // Dados do projeto
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (projectError || !projectData) {
        alert('Projeto não encontrado!');
        navigate('/containers');
        setLoading(false);
        return;
      }

      // Foto do projeto
      const { data: photoData } = await supabase
        .from('projects_photos')
        .select('photo_url')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Pavimentos e EAP já relacionados ao projeto
      const { data: pavimentosData } = await supabase
        .from('pavimentos')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      const { data: eapsData } = await supabase
        .from('eap')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      setProject({
        ...projectData,
        photo_url: photoData?.photo_url || null,
        pavimentos: pavimentosData || [],
        eap: eapsData || [],
      });

      // Usuário atual
      const { data: userData } = await supabase
        .from("profiles")
        .select("nome")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (userData?.nome) setUsuarioAtual(userData.nome);

      // Pilhas e notas
      const { data: pilhasData, error: pilhasError } = await supabase
        .from('pilhas')
        .select('*, notas(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (pilhasError) {
        console.error(pilhasError);
        setLoading(false);
        return;
      }

      const formattedColumns = (pilhasData || []).map(p => ({
        id: String(p.id),
        title: p.title,
        notas: p.notas || [],
      }));
      setColumns(formattedColumns);

      setLoading(false);
    };

    fetchProjectData();
  }, [location.state, navigate]);

  const handleAddColumn = async () => {
    if (!project) return;
    const title = 'Nova Pilha';
    const { data: newPilha, error } = await supabase
      .from('pilhas')
      .insert([{ project_id: project.id, title }])
      .select()
      .single();
    if (error) return alert('Erro ao criar pilha');
    setColumns([...columns, { id: String(newPilha.id), title: newPilha.title, notas: [] }]);
  };

  const handleColumnDoubleClick = col => {
    setEditingColumnId(col.id);
    setColumnTitleDraft(col.title);
  };

  const saveColumnTitle = async id => {
    if (!columnTitleDraft.trim()) return;
    const { error } = await supabase
      .from('pilhas')
      .update({ title: columnTitleDraft })
      .eq('id', id);
    if (!error) {
      setColumns(columns.map(c => c.id === id ? { ...c, title: columnTitleDraft } : c));
    }
    setEditingColumnId(null);
  };

  const handleSaveTask = async () => {
    if (!formData.nome.trim() || !activeColumnId) return;
    const { data: newNota, error } = await supabase
      .from('notas')
      .insert([{
        pilha_id: activeColumnId,
        nome: formData.nome,
        responsavel: formData.responsavel,
        tipo: formData.tipo
      }])
      .select()
      .single();
    if (error) return alert('Erro ao criar nota');

    setColumns(columns.map(col =>
      col.id === activeColumnId
        ? { ...col, notas: [newNota, ...col.notas] }
        : col
    ));

    setFormData({ nome: '', responsavel: '', tipo: 'Lista' });
    setShowForm(false);
  };

  const onDragEnd = result => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;
    let movedTask;

    const updatedColumns = columns.map(col => {
      if (col.id === sourceColId) {
        const tasks = Array.from(col.notas);
        [movedTask] = tasks.splice(source.index, 1);
        return { ...col, notas: tasks };
      }
      return col;
    }).map(col => {
      if (col.id === destColId && movedTask) {
        const tasks = Array.from(col.notas);
        tasks.splice(destination.index, 0, movedTask);
        return { ...col, notas: tasks };
      }
      return col;
    });

    setColumns(updatedColumns);
  };

  if (loading) return <Loading />;

  return (
    <div className="cards-page">
      <header className="cards-header">
        <button
          className="btn-voltar"
          onClick={() => navigate('/containers')}
          title="Voltar para Containers"
        >
          <FaArrowLeft />
        </button>

        {project?.photo_url && (
          <img src={project.photo_url} alt={project.name} className="project-photo-header" />
        )}

        <h1>
          Pilhas - <span className="project-name">{project?.name || "Projeto Desconhecido"}</span>
        </h1>

        <button className="btn-add-pilha" onClick={handleAddColumn}>
          <FaPlus />
        </button>
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
                        onChange={e => setColumnTitleDraft(e.target.value)}
                        onBlur={() => saveColumnTitle(col.id)}
                        onKeyDown={e => e.key === 'Enter' && saveColumnTitle(col.id)}
                      />
                    ) : (
                      <h3 onDoubleClick={() => handleColumnDoubleClick(col)}>{col.title}</h3>
                    )}

                    <button className="btn-add" onClick={() => {
                      setActiveColumnId(col.id);
                      setShowForm(true);
                    }}>
                      <FaPlus />
                    </button>
                  </div>

                  <div className="cards-list">
                    {col.notas.map((task, index) => (
                      <Draggable key={String(task.id)} draggableId={String(task.id)} index={index}>
                        {(provided) => (
                          <div
                            className={`card-item tipo-${(task.tipo || 'lista').toLowerCase()}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => {
                              setPilhaSelecionada(col.title);
                              setNotaSelecionada(task);
                              setShowListagem(true);
                            }}
                          >
                            <strong>{task.nome}</strong>
                            <p>{task.tipo}</p>
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

      {/* Modal de Nova Nota */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Nova Nota</h2>
            <label>Nome</label>
            <input type="text" value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} />
            <label>Responsável</label>
            <input type="text" value={formData.responsavel} onChange={e => setFormData({ ...formData, responsavel: e.target.value })} />
            <label>Tipo</label>
            <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })}>
              <option>Lista</option>
              <option>Diário de Obra</option>
              <option>Livres</option>
              <option>Atas</option>
              <option>Medição</option>
            </select>
            <div className="modal-actions">
              <button className="btn-salvar" onClick={handleSaveTask}>Salvar</button>
              <button className="btn-cancelar" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Listagem */}
      {showListagem && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <button
              className="modal-close-btn"
              onClick={() => setShowListagem(false)}
              title="Fechar"
            >
              <FaTimes />
            </button>

            <Listagem
              projetoAtual={project}
              pilhaAtual={pilhaSelecionada}
              notaAtual={notaSelecionada?.nome}
              usuarioAtual={usuarioAtual}
              locacoes={project?.pavimentos?.map(p => p.name) || []}
              eaps={project?.eap?.map(e => e.name) || []}
            />
          </div>
        </div>
      )}
    </div>
  );
}
