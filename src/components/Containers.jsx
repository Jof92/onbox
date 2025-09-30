import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Containers.css';
import { FaCog, FaPlus, FaTrash, FaCamera } from 'react-icons/fa';

export default function Containers() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  const [newProject, setNewProject] = useState({
    name: '',
    type: 'vertical',
    pavimentos: [],
    eap: [],
    photo: null,
    createdAt: null,
  });

  // Upload da foto
  const handlePhotoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewProject({
        ...newProject,
        photo: URL.createObjectURL(e.target.files[0]),
      });
    }
  };

  // Pavimentos
  const addPavimento = () =>
    setNewProject({ ...newProject, pavimentos: [...newProject.pavimentos, ''] });
  const updatePavimento = (index, value) => {
    const updated = [...newProject.pavimentos];
    updated[index] = value;
    setNewProject({ ...newProject, pavimentos: updated });
  };
  const removePavimento = (index) => {
    const updated = [...newProject.pavimentos];
    updated.splice(index, 1);
    setNewProject({ ...newProject, pavimentos: updated });
  };

  // EAP
  const addEAP = () =>
    setNewProject({ ...newProject, eap: [...newProject.eap, ''] });
  const updateEAP = (index, value) => {
    const updated = [...newProject.eap];
    updated[index] = value;
    setNewProject({ ...newProject, eap: updated });
  };
  const removeEAP = (index) => {
    const updated = [...newProject.eap];
    updated.splice(index, 1);
    setNewProject({ ...newProject, eap: updated });
  };

  // Salvar projeto
  const saveProject = () => {
    if (!newProject.name.trim()) {
      alert('Digite o nome do projeto!');
      return;
    }

    if (isEditing && selectedProject) {
      const updatedProjects = projects.map((proj) =>
        proj === selectedProject
          ? { ...newProject, createdAt: selectedProject.createdAt }
          : proj
      );
      setProjects(updatedProjects);
      setSelectedProject({ ...newProject, createdAt: selectedProject.createdAt });
      setIsEditing(false);
    } else {
      const projectWithDate = {
        ...newProject,
        createdAt: new Date().toLocaleDateString(),
      };
      setProjects([...projects, projectWithDate]);
    }

    setNewProject({
      name: '',
      type: 'vertical',
      pavimentos: [],
      eap: [],
      photo: null,
      createdAt: null,
    });
    setShowForm(false);
  };

  const handleEditProject = (project) => {
    setIsEditing(true);
    setShowForm(true);
    setNewProject(project);
    setSelectedProject(project);
  };

  const openCardsPage = (project) => {
    navigate(`/cards/${encodeURIComponent(project.name)}`, {
      state: { projectName: project.name, projectPhoto: project.photo },
    });
  };

  return (
    <div className="containers-page">
      <header className="containers-header">
        <h1>Container</h1>
      </header>

      <div className="containers-body">
        {/* Sidebar */}
        <aside className="containers-sidebar">
          <div className="sidebar-item">
            <FaCog className="icon" />
            <span>Controle</span>
          </div>

          <button
            className="sidebar-btn"
            onClick={() => {
              setIsEditing(false);
              setShowForm(true);
            }}
          >
            <FaPlus className="icon" /> Novo Projeto
          </button>

          <button className="sidebar-btn">
            <FaPlus className="icon" /> Novo Setor
          </button>

          {/* Lista de projetos */}
          <div className="sidebar-projects">
            {projects.map((proj, i) => (
              <div
                key={i}
                className={`sidebar-project ${selectedProject === proj ? 'active' : ''}`}
                onClick={() => setSelectedProject(proj)}
              >
                {proj.name}
              </div>
            ))}
          </div>
        </aside>

        {/* Área Central */}
        <main className="containers-main">
          {!selectedProject ? (
            projects.length === 0 ? (
              <p className="no-projects">Tudo calmo por aqui ainda...</p>
            ) : (
              <div className="projects-grid">
                {projects.map((proj, i) => (
                  <div
                    key={i}
                    className="project-box"
                    onClick={() => openCardsPage(proj)}
                  >
                    <div className="project-photo">
                      {proj.photo ? <img src={proj.photo} alt={proj.name} /> : <FaCamera />}
                    </div>
                    <h3>{proj.name}</h3>
                    <p>{proj.type === 'vertical' ? 'Edificação Vertical' : 'Edificação Horizontal'}</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Mostra detalhes do projeto selecionado ao clicar no nome da sidebar
            <div className="project-details">
              <button className="back-btn" onClick={() => setSelectedProject(null)}>
                &larr; Voltar
              </button>

              <div className="details-photo">
                {selectedProject.photo ? (
                  <img src={selectedProject.photo} alt={selectedProject.name} />
                ) : (
                  <FaCamera size={40} />
                )}
              </div>

              <h2>{selectedProject.name}</h2>
              <p>
                Tipo: {selectedProject.type === 'vertical' ? 'Edificação Vertical' : 'Edificação Horizontal'}
              </p>

              {selectedProject.type === 'vertical' && selectedProject.pavimentos.length > 0 && (
                <>
                  <h3>Pavimentos</h3>
                  <ul>
                    {selectedProject.pavimentos.map((pav, idx) => (
                      <li key={idx}>{pav}</li>
                    ))}
                  </ul>
                </>
              )}

              {selectedProject.eap.length > 0 && (
                <>
                  <h3>EAP</h3>
                  <ul>
                    {selectedProject.eap.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </>
              )}

              {/* Botão Editar */}
              <div className="details-actions">
                <button
                  className="edit-btn"
                  onClick={() => handleEditProject(selectedProject)}
                >
                  Editar Projeto
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Formulário */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{isEditing ? 'Editar Projeto' : 'Novo Projeto'}</h2>

            <div className="project-photo-upload">
              <label htmlFor="photo-upload" className="photo-circle">
                {newProject.photo ? (
                  <img src={newProject.photo} alt="Projeto" />
                ) : (
                  <FaCamera />
                )}
              </label>
              <input
                type="file"
                id="photo-upload"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
            </div>

            <label>Nome do Projeto</label>
            <input
              type="text"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            />

            <label>Tipo de Projeto</label>
            <select
              value={newProject.type}
              onChange={(e) => setNewProject({ ...newProject, type: e.target.value })}
            >
              <option value="vertical">Edificação Vertical</option>
              <option value="horizontal">Edificação Horizontal</option>
            </select>

            {newProject.type === 'vertical' && (
              <>
                <label>Pavimentos</label>
                <button className="small-btn" onClick={addPavimento}>
                  + Adicionar Pavimento
                </button>
                {newProject.pavimentos.map((pav, i) => (
                  <div key={i} className="list-item">
                    <input
                      type="text"
                      placeholder={`Pavimento ${i + 1}`}
                      value={pav}
                      onChange={(e) => updatePavimento(i, e.target.value)}
                    />
                    <FaTrash className="delete-icon" onClick={() => removePavimento(i)} />
                  </div>
                ))}
              </>
            )}

            <label>EAP do Projeto</label>
            <button className="small-btn" onClick={addEAP}>
              + Adicionar EAP
            </button>
            {newProject.eap.map((item, i) => (
              <div key={i} className="list-item">
                <input
                  type="text"
                  placeholder={`EAP ${i + 1}`}
                  value={item}
                  onChange={(e) => updateEAP(i, e.target.value)}
                />
                <FaTrash className="delete-icon" onClick={() => removeEAP(i)} />
              </div>
            ))}

            <div className="modal-actions">
              <button className="save-btn" onClick={saveProject}>Salvar</button>
              <button className="cancel-btn" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
