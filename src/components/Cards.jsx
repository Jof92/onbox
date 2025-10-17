// Cards.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Cards.css';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FaPlus, FaArrowLeft, FaTimes, FaEllipsisV, FaEdit, FaTrash } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import Listagem from './Listagem';
import AtaCard from './AtaCard';
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
  const [showModalNota, setShowModalNota] = useState(false);
  const [pilhaSelecionada, setPilhaSelecionada] = useState(null);
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [usuarioAtual, setUsuarioAtual] = useState("Usuário Atual");

  const [menuOpenNota, setMenuOpenNota] = useState(null);
  const [editNotaModal, setEditNotaModal] = useState(false);
  const [notaEditData, setNotaEditData] = useState({ id: null, nome: '', responsavel: '', pilhaId: null });

  useEffect(() => {
    const projectId = location.state?.projectId;
    if (!projectId) return navigate('/containers', { replace: true });

    (async () => {
      setLoading(true);

      const { data: projectData } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (!projectData) return navigate('/containers', { replace: true });

      const [{ photo_url } = {}] =
        (await supabase.from('projects_photos').select('photo_url').eq('project_id', projectId).order('created_at').limit(1)).data || [];

      const pavimentos = (await supabase.from('pavimentos').select('*').eq('project_id', projectId).order('created_at')).data || [];
      const eap = (await supabase.from('eap').select('*').eq('project_id', projectId).order('created_at')).data || [];

      const { data: userData } = await supabase.from("profiles").select("nome").order("created_at").limit(1).single();
      if (userData?.nome) setUsuarioAtual(userData.nome);

      const pilhasData = (await supabase.from('pilhas').select('*, notas(*)').eq('project_id', projectId).order('created_at')).data || [];
      setColumns(pilhasData.map(p => ({ id: String(p.id), title: p.title, notas: p.notas || [] })));

      setProject({ ...projectData, photo_url, pavimentos, eap });
      setLoading(false);
    })();
  }, [location.state, navigate]);

  const handleAddColumn = async () => {
    if (!project) return;
    const { data: newPilha, error } = await supabase.from('pilhas').insert([{ project_id: project.id, title: 'Nova Pilha' }]).select().single();
    if (!error) setColumns([...columns, { id: String(newPilha.id), title: newPilha.title, notas: [] }]);
  };

  const saveColumnTitle = async id => {
    if (!columnTitleDraft.trim()) return setEditingColumnId(null);
    const { error } = await supabase.from('pilhas').update({ title: columnTitleDraft }).eq('id', id);
    if (!error) setColumns(columns.map(c => c.id === id ? { ...c, title: columnTitleDraft } : c));
    setEditingColumnId(null);
  };

  const handleSaveTask = async () => {
    if (!formData.nome.trim() || !activeColumnId) return;
    const { data: newNota, error } = await supabase.from('notas').insert([{ ...formData, pilha_id: activeColumnId }]).select().single();
    if (!error) {
      setColumns(columns.map(c => c.id === activeColumnId ? { ...c, notas: [newNota, ...c.notas] } : c));

      // Abrir modal automaticamente se for do tipo "Atas"
      if (newNota.tipo === 'Atas') {
        setPilhaSelecionada(columns.find(c => c.id === activeColumnId)?.title);
        setNotaSelecionada(newNota);
        setShowModalNota(true);
      }
    }
    setFormData({ nome: '', responsavel: '', tipo: 'Lista' });
    setShowForm(false);
  };

  const handleDeleteNota = async (notaId, pilhaId) => {
    if (!window.confirm("Deseja realmente excluir esta nota?")) return;
    const { error } = await supabase.from('notas').delete().eq('id', notaId);
    if (!error) {
      setColumns(columns.map(c => c.id === pilhaId ? { ...c, notas: c.notas.filter(n => n.id !== notaId) } : c));
      setMenuOpenNota(null);
    }
  };

  const handleEditNota = (nota, pilhaId) => {
    setNotaEditData({ id: nota.id, nome: nota.nome, responsavel: nota.responsavel || '', pilhaId });
    setEditNotaModal(true);
    setMenuOpenNota(null);
  };

  const saveEditedNota = async () => {
    const { id, nome, responsavel, pilhaId } = notaEditData;
    if (!nome.trim()) return alert("Digite o nome da nota!");
    const { error } = await supabase.from('notas').update({ nome, responsavel }).eq('id', id);
    if (!error) {
      setColumns(columns.map(c => c.id === pilhaId ? {
        ...c,
        notas: c.notas.map(n => n.id === id ? { ...n, nome, responsavel } : n)
      } : c));
      setEditNotaModal(false);
    }
  };

  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;
    let movedTask;
    const updatedColumns = columns.map(c => {
      if (c.id === source.droppableId) {
        const notas = Array.from(c.notas);
        [movedTask] = notas.splice(source.index, 1);
        return { ...c, notas };
      }
      if (c.id === destination.droppableId && movedTask) {
        const notas = Array.from(c.notas);
        notas.splice(destination.index, 0, movedTask);
        return { ...c, notas };
      }
      return c;
    });
    setColumns(updatedColumns);
  };

  if (loading) return <Loading />;

  return (
    <div className="cards-page">
      <header className="cards-header">
        <button className="btn-voltar" onClick={() => navigate('/containers')} title="Voltar"><FaArrowLeft /></button>
        {project?.photo_url && <img src={project.photo_url} alt={project.name} className="project-photo-header" />}
        <h1>Pilhas - <span className="project-name">{project?.name || "Projeto Desconhecido"}</span></h1>
        <button className="btn-add-pilha" onClick={handleAddColumn}><FaPlus /></button>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="cards-body">
          {columns.map(col => (
            <Droppable key={col.id} droppableId={col.id}>
              {provided => (
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
                      <h3 onDoubleClick={() => { setEditingColumnId(col.id); setColumnTitleDraft(col.title); }}>{col.title}</h3>
                    )}
                    <button className="btn-add" onClick={() => { setActiveColumnId(col.id); setShowForm(true); }}><FaPlus /></button>
                  </div>
                  <div className="cards-list">
                    {col.notas.map((nota, index) => (
                      <Draggable key={String(nota.id)} draggableId={String(nota.id)} index={index}>
                        {prov => (
                          <div
                            className={`card-item tipo-${(nota.tipo || 'lista').toLowerCase()}`}
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                          >
                            <div className="card-info" onClick={() => { 
                              setPilhaSelecionada(col.title); 
                              setNotaSelecionada(nota); 
                              setShowModalNota(true);
                            }}>
                              <strong>{nota.nome}</strong>
                              <p>{nota.tipo}</p>
                            </div>

                            <div className="card-menu-wrapper" onClick={e => e.stopPropagation()}>
                              <button className="card-menu-btn" onClick={() => setMenuOpenNota(menuOpenNota === nota.id ? null : nota.id)}>
                                <FaEllipsisV />
                              </button>
                              {menuOpenNota === nota.id && (
                                <div className="card-menu-dropdown">
                                  <button onClick={() => handleEditNota(nota, col.id)}><FaEdit /> Editar</button>
                                  <button onClick={() => handleDeleteNota(nota.id, col.id)}><FaTrash /> Excluir</button>
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

      {/* Modal nova nota */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Nova Nota</h2>
            {['nome', 'responsavel'].map(field => (
              <React.Fragment key={field}>
                <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                <input type="text" value={formData[field]} onChange={e => setFormData({ ...formData, [field]: e.target.value })} />
              </React.Fragment>
            ))}
            <label>Tipo</label>
            <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })}>
              {['Lista', 'Diário de Obra', 'Livres', 'Atas', 'Medição'].map(t => <option key={t}>{t}</option>)}
            </select>
            <div className="modal-actions">
              <button className="btn-salvar" onClick={handleSaveTask}>Salvar</button>
              <button className="btn-cancelar" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edição nota */}
      {editNotaModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Editar Nota</h2>
            <label>Nome</label>
            <input type="text" value={notaEditData.nome} onChange={e => setNotaEditData({ ...notaEditData, nome: e.target.value })} />
            <label>Responsável</label>
            <input type="text" value={notaEditData.responsavel} onChange={e => setNotaEditData({ ...notaEditData, responsavel: e.target.value })} />
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

            {notaSelecionada?.tipo === 'Atas' ? (
              <AtaCard
                projetoAtual={project}
                pilhaAtual={pilhaSelecionada}
                notaAtual={notaSelecionada}
                usuarioAtual={usuarioAtual}
              />
            ) : (
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
