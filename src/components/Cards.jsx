import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import './Cards.css';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FaPlus } from 'react-icons/fa';

export default function Cards() {
  const location = useLocation();
  const { projectName, projectPhoto } = location.state || {};

  const [columns, setColumns] = useState({
    nova: [],
    andamento: [],
    continuo: [],
    concluido: [],
  });

  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    responsavel: '',
    tipo: 'Lista',
  });

  // Salvar nova tarefa (só na coluna Nova Tarefa)
  const handleSaveTask = () => {
    if (!formData.nome.trim()) return alert('Digite o nome da tarefa!');

    const newTask = { ...formData };

    setColumns({
      ...columns,
      nova: [newTask, ...columns.nova], // adiciona no topo da lista
    });

    // Resetar form
    setFormData({ nome: '', responsavel: '', tipo: 'Lista' });
    setShowForm(false);
  };

  // Drag & Drop
  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    const sourceTasks = Array.from(columns[sourceCol]);
    const [movedTask] = sourceTasks.splice(source.index, 1);

    if (sourceCol === destCol) {
      sourceTasks.splice(destination.index, 0, movedTask);
      setColumns({ ...columns, [sourceCol]: sourceTasks });
    } else {
      const destTasks = Array.from(columns[destCol]);
      destTasks.splice(destination.index, 0, movedTask);
      setColumns({ ...columns, [sourceCol]: sourceTasks, [destCol]: destTasks });
    }
  };

  return (
    <div className="cards-page">
      {/* Header */}
      <header className="cards-header">
        {projectPhoto && <img src={projectPhoto} alt={projectName} className="project-photo-header" />}
        <h1>
          Cartões - <span className="project-name">{projectName}</span>
        </h1>
      </header>

      {/* Body */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="cards-body">
          {[
            { key: 'nova', title: 'Nova Tarefa', className: 'nova-tarefa' },
            { key: 'andamento', title: 'Em Andamento', className: 'andamento' },
            { key: 'continuo', title: 'Contínuo', className: 'continuo' },
            { key: 'concluido', title: 'Concluído', className: 'concluido' },
          ].map((col) => (
            <Droppable key={col.key} droppableId={col.key}>
              {(provided) => (
                <div
                  className={`cards-column ${col.className}`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {/* Header da coluna */}
                  <div className="column-header">
                    <h3>{col.title}</h3>
                    {col.key === 'nova' && (
                      <button className="btn-add" onClick={() => setShowForm(true)}>
                        <FaPlus />
                      </button>
                    )}
                  </div>

                  <div className="cards-list">
                    {columns[col.key].map((task, index) => (
                      <Draggable
                        key={task.nome + index}
                        draggableId={task.nome + index}
                        index={index}
                      >
                        {(provided, snapshot) => (
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

      {/* Modal Nova Tarefa */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Nova Tarefa</h2>

            <label>Nome da Tarefa</label>
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

            <label>Tipo de Card</label>
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
