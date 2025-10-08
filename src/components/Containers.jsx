import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Containers.css';
import { FaCog, FaPlus, FaTrash, FaCamera } from 'react-icons/fa';
import { supabase } from '../supabaseClient';

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
    photoFile: null,
    photoUrl: null,
  });

  const [user, setUser] = useState(null);

  // Obter usuário logado
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error('Erro ao obter usuário:', error);
      } else {
        setUser(user);
        fetchProjects(user.id);
      }
    };
    fetchUser();
  }, []);

  // Buscar projetos do Supabase
  const fetchProjects = async (userId) => {
    const { data, error } = await supabase
      .from('projects')
      .select('*, pavimentos(*), eap(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) console.error('Erro ao buscar projetos:', error);
    else setProjects(data);
  };

  // Upload de foto
  const handlePhotoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewProject({
        ...newProject,
        photoFile: e.target.files[0],
        photoUrl: URL.createObjectURL(e.target.files[0]),
      });
    }
  };

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

  const getRandomColor = () => {
    const colors = ['#FFB74D', '#4DB6AC', '#BA68C8', '#7986CB', '#F06292', '#81C784'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Salvar projeto
  const saveProject = async () => {
    if (!newProject.name.trim()) {
      alert('Digite o nome do projeto!');
      return;
    }

    let photo_url = null;

    // Upload de foto se houver
    if (newProject.photoFile) {
      const fileName = `${Date.now()}_${newProject.photoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('projects-photos')
        .upload(fileName, newProject.photoFile);
      if (uploadError) console.error('Erro upload foto:', uploadError);
      else {
        const { publicUrl } = supabase.storage.from('projects-photos').getPublicUrl(fileName);
        photo_url = publicUrl;
      }
    }

    if (isEditing && selectedProject) {
      const { error } = await supabase
        .from('projects')
        .update({ name: newProject.name, type: newProject.type, photo_url })
        .eq('id', selectedProject.id);
      if (error) console.error(error);
    } else {
      const { data, error } = await supabase
        .from('projects')
        .insert([{ name: newProject.name, type: newProject.type, photo_url, user_id: user.id }])
        .select()
        .single();
      if (error) {
        console.error(error);
        return;
      }

      // Salvar pavimentos
      for (const pav of newProject.pavimentos) {
        if (pav.trim()) {
          await supabase.from('pavimentos').insert({ name: pav, project_id: data.id });
        }
      }

      // Salvar eap
      for (const eapItem of newProject.eap) {
        if (eapItem.trim()) {
          await supabase.from('eap').insert({ name: eapItem, project_id: data.id });
        }
      }
    }

    setNewProject({ name: '', type: 'vertical', pavimentos: [], eap: [], photoFile: null, photoUrl: null });
    setShowForm(false);
    setIsEditing(false);
    fetchProjects(user.id);
  };

  const handleEditProject = (project) => {
    setIsEditing(true);
    setShowForm(true);
    setNewProject({
      name: project.name,
      type: project.type,
      pavimentos: project.pavimentos?.map(p => p.name) || [],
      eap: project.eap?.map(e => e.name) || [],
      photoUrl: project.photo_url,
      photoFile: null,
    });
    setSelectedProject(project);
  };

  const openCardsPage = (project) => {
    navigate(`/cards/${encodeURIComponent(project.name)}`, {
      state: { projectName: project.name, projectPhoto: project.photo_url },
    });
  };

  return (
    <div className="containers-page">
      <header className="containers-header"><h1>Container</h1></header>

      <div className="containers-body">
        <aside className="containers-sidebar">
          <div className="sidebar-item"><FaCog className="icon" /><span>Controle</span></div>

          <button className="sidebar-btn" onClick={() => { setIsEditing(false); setShowForm(true); }}>
            <FaPlus className="icon" /> Novo Projeto
          </button>

          <button className="sidebar-btn"><FaPlus className="icon" /> Novo Setor</button>

          <div className="sidebar-projects">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className={`sidebar-project ${selectedProject?.id === proj.id ? 'active' : ''}`}
                onClick={() => setSelectedProject(proj)}
              >
                {proj.name}
              </div>
            ))}
          </div>
        </aside>

        <main className="containers-main">
          {!selectedProject ? (
            projects.length === 0 ? (
              <p className="no-projects">Tudo calmo por aqui ainda...</p>
            ) : (
              <div className="projects-grid">
                {projects.map((proj) => (
                  <div key={proj.id} className="project-box" onClick={() => openCardsPage(proj)}>
                    <div className="project-photo" style={{
                      backgroundColor: !proj.photo_url ? getRandomColor() : undefined,
                      color: '#fff', fontSize: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                      {proj.photo_url ? <img src={proj.photo_url} alt={proj.name} /> : proj.name.charAt(0).toUpperCase()}
                    </div>
                    <h3>{proj.name}</h3>
                    <p>{proj.type === 'vertical' ? 'Edificação Vertical' : 'Edificação Horizontal'}</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="project-details">
              <button className="back-btn" onClick={() => setSelectedProject(null)}>&larr; Voltar</button>

              <div className="details-photo" style={{
                backgroundColor: !selectedProject.photo_url ? getRandomColor() : undefined,
                color: '#fff', fontSize: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center',
                width: '100px', height: '100px', borderRadius: '50%'
              }}>
                {selectedProject.photo_url ? <img src={selectedProject.photo_url} alt={selectedProject.name} /> : selectedProject.name.charAt(0).toUpperCase()}
              </div>

              <h2>{selectedProject.name}</h2>
              <p>Tipo: {selectedProject.type === 'vertical' ? 'Edificação Vertical' : 'Edificação Horizontal'}</p>

              {selectedProject.type === 'vertical' && selectedProject.pavimentos.length > 0 && (
                <>
                  <h3>Pavimentos</h3>
                  <ul>{selectedProject.pavimentos.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
                </>
              )}

              {selectedProject.eap.length > 0 && (
                <>
                  <h3>EAP</h3>
                  <ul>{selectedProject.eap.map((e) => <li key={e.id}>{e.name}</li>)}</ul>
                </>
              )}

              <div className="details-actions">
                <button className="edit-btn" onClick={() => handleEditProject(selectedProject)}>Editar Projeto</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{isEditing ? 'Editar Projeto' : 'Novo Projeto'}</h2>

            <div className="project-photo-upload">
              <label htmlFor="photo-upload" className="photo-circle">
                {newProject.photoUrl ? <img src={newProject.photoUrl} alt="Projeto" /> : <FaCamera />}
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
            <input type="text" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} />

            <label>Tipo de Projeto</label>
            <select value={newProject.type} onChange={(e) => setNewProject({ ...newProject, type: e.target.value })}>
              <option value="vertical">Edificação Vertical</option>
              <option value="horizontal">Edificação Horizontal</option>
            </select>

            {newProject.type === 'vertical' && (
              <>
                <div className="list-header">Pavimentos <FaPlus className="add-icon" onClick={addPavimento} /></div>
                {newProject.pavimentos.map((p, i) => (
                  <div key={i} className="list-item">
                    <input type="text" placeholder={`Pavimento ${i + 1}`} value={p} onChange={(e) => updatePavimento(i, e.target.value)} />
                    <FaTrash className="delete-icon" onClick={() => removePavimento(i)} />
                  </div>
                ))}
              </>
            )}

            <div className="list-header">EAP <FaPlus className="add-icon" onClick={addEAP} /></div>
            {newProject.eap.map((e, i) => (
              <div key={i} className="list-item">
                <input type="text" placeholder={`EAP ${i + 1}`} value={e} onChange={(ev) => updateEAP(i, ev.target.value)} />
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
