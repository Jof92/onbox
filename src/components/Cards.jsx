import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import './Cards.css';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FaPlus, FaEdit } from 'react-icons/fa';

export default function Cards({ projects }) {
  const { projectName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Tenta pegar do state, senão do parâmetro da URL
  const projectFromState = location.state?.projectName
    ? { name: location.state.projectName, photo: location.state.projectPhoto }
    : projects.find(p => p.name === decodeURIComponent(projectName)) || {};

  const [columns, setColumns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    responsavel: '',
    tipo: 'Lista',
  });

  useEffect(() => {
    if (!projectFromState.name) {
      alert('Projeto não encontrado!');
      navigate('/containers');
    }
  }, [projectFromState, navigate]);

  const handleAddColumn = () => {
    const newId = `nota-${Date.now()}`;
    setColumns([...columns, { id: newId, title: 'Nova Nota', notas: [] }]);
  };

  const saveColumnTitle = (id) => {
    setColumns(columns.map(col =>
      col.id === id ? { ...col, title: columnTitleDraft } : col
    ));
    setEditingColumnId(null);
  };

  const handleSaveTask = () => {
    if (!formData.nome.trim()) return alert('Digite o nome da pilha!');
    if (!activeColumnId) return;

    const newTask = { ...formData };

    setColumns(columns.map(col =>
      col.id === activeColumnId
        ? { ...col, notas: [newTask, ...col.notas] }
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

    if (sourceColId === destColId) {
      const updatedColumns = columns.map(col => {
        if (col.id === sourceColId) {
          const tasks = Array.from(col.notas);
          const [movedTask] = tasks.splice(source.index, 1);
          tasks.splice(destination.index, 0, movedTask);
          return { ...col, notas: tasks };
        }
        return col;
      });
      setColumns(updatedColumns);
    } else {
      let movedTask;
      const updatedColumns = columns.map(col => {
        if (col.id === sourceColId) {
          const tasks = Array.from(col.notas);
          [movedTask] = tasks.splice(source.index, 1);
          return { ...col, notas: tasks };
        }
        return col;
      });

      setColumns(updatedColumns.map(col => {
        if (col.id === destColId && movedTask) {
          const tasks = Array.from(col.notas);
          tasks.splice(destination.index, 0, movedTask);
          return { ...col, notas: tasks };
        }
        return col;
      }));
    }
  };

  return (
    <div className="cards-page">
      <header className="cards-header">
        {projectFromState.photo && (
          <img src={projectFromState.photo} alt={projectFromState.name} className="project-photo-header" />
        )}
        <h1>
          Pilhas - <span className="project-name">{projectFromState.name}</span>
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
                <div
                  className="cards-column"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <div className="column-header">
                    {editingColumnId === col.id ? (
                      <input
                        type="text"
                        value={columnTitleDraft}
                        autoFocus
                        onChange={(e) => setColumnTitleDraft(e.target.value)}
                        onBlur={() => saveColumnTitle(col.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveColumnTitle(col.id)}
                      />
                    ) : (
                      <h3>{col.title}</h3>
                    )}
                    <div className="column-actions">
                      <button
                        className="btn-edit"
                        onClick={() => {
                          setEditingColumnId(col.id);
                          setColumnTitleDraft(col.title);
                        }}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn-add"
                        onClick={() => {
                          setActiveColumnId(col.id);
                          setShowForm(true);
                        }}
                      >
                        <FaPlus />
                      </button>
                    </div>
                  </div>

                  <div className="cards-list">
                    {col.notas.map((task, index) => (
                      <Draggable
                        key={task.nome + index}
                        draggableId={task.nome + index}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            className={`card-item tipo-${task.tipo.toLowerCase()}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
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

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Nova Pilha</h2>

            <label>Nome da Pilha</label>
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

            <label>Tipo de Pilha</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
            >
              <option>Lista</option>
              <option>Comentários</option>
              <option>Lembrete</option>
            </select>

            <div className="modal-actions">
              <button className="btn-salvar" onClick={handleSaveTask}>Salvar</button>
              <button className="btn-cancelar" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
