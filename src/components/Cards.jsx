import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import './Cards.css';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FaPlus, FaUpload } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import Listagem from './Listagem';
import Loading from './Loading';
import * as XLSX from 'xlsx';

export default function Cards() {
  const { projectName } = useParams();
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
  const [listagemProjeto, setListagemProjeto] = useState(null);

  const [fileData, setFileData] = useState(null); // armazena o excel carregado
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    const projectId = location.state?.projectId;
    if (!projectId) {
      alert('Projeto não encontrado!');
      navigate('/containers');
      return;
    }

    const fetchProjectData = async () => {
      setLoading(true);

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

      const { data: photoData } = await supabase
        .from('projects_photos')
        .select('photo_url')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setProject({ ...projectData, photo_url: photoData?.photo_url || null });

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

      const formattedColumns = pilhasData.map((p) => ({
        id: p.id,
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
    setColumns([...columns, { id: newPilha.id, title: newPilha.title, notas: [] }]);
  };

  const handleColumnDoubleClick = (col) => {
    setEditingColumnId(col.id);
    setColumnTitleDraft(col.title);
  };

  const saveColumnTitle = async (id) => {
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

  const onDragEnd = (result) => {
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

  // Carregar arquivo Excel
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      setFileData(jsonData);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSendExcel = async (col) => {
    if (!fileData) return alert('Nenhum arquivo carregado');

    // Exemplo: transforma os dados do excel em CSV
    const csvContent = fileData.map(row => row.join(',')).join('\n');

    await supabase.from('pilha_excel').insert([{ pilha_id: col.id, csv: csvContent }]);

    alert('Arquivo enviado com sucesso!');
    setFileData(null);
    setMenuOpen(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="cards-page">
      <header className="cards-header">
        {project?.photo_url && (
          <img src={project.photo_url} alt={project.name} className="project-photo-header" />
        )}
        <h1>
          Pilhas - <span className="project-name">{project.name}</span>
        </h1>
        <button className="btn-add-pilha" onClick={handleAddColumn}>
          <FaPlus />
        </button>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="cards-body">
          {columns.map(col => (
            <Droppable key={col.id} droppableId={col.id}>
              {(provided) => {
                const hasLista = col.notas.some(n => n.tipo === 'Lista');
                return (
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

                      {hasLista && (
                        <div className="export-menu">
                          <button onClick={() => setMenuOpen(prev => !prev)} className="btn-upload">
                            <FaUpload />
                          </button>
                          {menuOpen && (
                            <div className="export-dropdown">
                              <input
                                type="file"
                                accept=".xlsx, .xls"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                              />
                              <button onClick={() => handleSendExcel(col)}>Enviar</button>
                            </div>
                          )}
                        </div>
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
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided) => (
                            <div
                              className={`card-item tipo-${task.tipo.toLowerCase()}`}
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => {
                                if (task.tipo === 'Lista') {
                                  setListagemProjeto(task);
                                  setShowListagem(true);
                                }
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
                );
              }}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Nova Nota</h2>
            <label>Nome</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
            <label>Responsável</label>
            <input
              type="text"
              value={formData.responsavel}
              onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
            />
            <label>Tipo</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
            >
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

      {showListagem && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <button className="modal-close-btn" onClick={() => setShowListagem(false)}>X</button>
            <Listagem
              projetoAtual={listagemProjeto?.nome || project.name}
              usuarioAtual="Usuário Atual"
              onClose={() => setShowListagem(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
