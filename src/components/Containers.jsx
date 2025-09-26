import React, { useState } from 'react';
import './Containers.css';
import { FaCog, FaPlus, FaTrash, FaCamera } from 'react-icons/fa';

export default function Containers() {
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    type: 'vertical',
    pavimentos: [],
    ambientes: [],
    eap: [],
    photo: null
  });

  // Upload da foto
  const handlePhotoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewProject({ ...newProject, photo: URL.createObjectURL(e.target.files[0]) });
    }
  };

  // Adicionar pavimento
  const addPavimento = () => {
    setNewProject({ ...newProject, pavimentos: [...newProject.pavimentos, ''] });
  };

  // Atualizar pavimento
  const updatePavimento = (index, value) => {
    const updated = [...newProject.pavimentos];
    updated[index] = value;
    setNewProject({ ...newProject, pavimentos: updated });
  };

  // Remover pavimento
  const removePavimento = (index) => {
    const updated = [...newProject.pavimentos];
    updated.splice(index, 1);
    setNewProject({ ...newProject, pavimentos: updated });
  };

  // Adicionar EAP
  const addEAP = () => {
    setNewProject({ ...newProject, eap: [...newProject.eap, ''] });
  };

  // Atualizar EAP
  const updateEAP = (index, value) => {
    const updated = [...newProject.eap];
    updated[index] = value;
    setNewProject({ ...newProject, eap: updated });
  };

  // Remover EAP
  const removeEAP = (index) => {
    const updated = [...newProject.eap];
    updated.splice(index, 1);
    setNewProject({ ...newProject, eap: updated });
  };

  // Salvar projeto
  const saveProject = () => {
    setProjects([...projects, newProject]);
    setNewProject({
      name: '',
      type: 'vertical',
      pavimentos: [],
      ambientes: [],
      eap: [],
      photo: null
    });
    setShowForm(false);
  };

  return (
    <div className="containers-page">
      <header className="containers-header">
        <h1>Containers</h1>
      </header>

      <div className="containers-body">
        {/* Sidebar */}
        <aside className="containers-sidebar">
          <div className="sidebar-item">
            <FaCog className="icon" />
            <span>Controle</span>
          </div>

          <button className="sidebar-btn" onClick={() => setShowForm(true)}>
            <FaPlus className="icon" /> Novo Projeto
          </button>

          <button className="sidebar-btn">
            <FaPlus className="icon" /> Novo Setor
          </button>
        </aside>

        {/* Área Central */}
        <main className="containers-main">
          {projects.length === 0 ? (
            <p className="no-projects">Tudo calmo por aqui ainda...</p>
          ) : (
            <div className="projects-grid">
              {projects.map((proj, i) => (
                <div key={i} className="project-box">
                  <div className="project-photo">
                    {proj.photo ? <img src={proj.photo} alt={proj.name} /> : <FaCamera />}
                  </div>
                  <h3>{proj.name}</h3>
                  <p>{proj.type === 'vertical' ? 'Edificação Vertical' : 'Edificação Horizontal'}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal Formulário */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Novo Projeto</h2>

            <div className="project-photo-upload">
              <label htmlFor="photo-upload" className="photo-circle">
                {newProject.photo ? (
                  <img src={newProject.photo} alt="Projeto" />
                ) : (
                  <FaCamera size={24} />
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
              <button className="save-btn" onClick={saveProject}>
                Salvar
              </button>
              <button className="cancel-btn" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
