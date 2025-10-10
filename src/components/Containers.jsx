import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCog, FaPlus, FaTrash, FaCamera } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import './Containers.css';

export default function Containers() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newProject, setNewProject] = useState(initialProjectState());

  function initialProjectState() {
    return { name: '', type: 'vertical', pavimentos: [], eap: [], photoFile: null, photoUrl: null };
  }

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUser(data.user);
        fetchProjects(data.user.id);
      }
    };
    loadUser();
  }, []);

  const fetchProjects = async (userId) => {
    const { data: projectsData, error } = await supabase
      .from('projects')
      .select('*, pavimentos(*), eap(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return console.error(error);

    const projectsWithPhotos = await Promise.all(
      (projectsData || []).map(async (proj) => {
        const { data: photoData } = await supabase
          .from('projects_photos')
          .select('photo_url')
          .eq('project_id', proj.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return { ...proj, photo_url: photoData?.photo_url || null };
      })
    );

    setProjects(projectsWithPhotos);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) setNewProject((p) => ({ ...p, photoFile: file, photoUrl: URL.createObjectURL(file) }));
  };

  const handleListChange = (list, index, value) =>
    setNewProject((p) => ({ ...p, [list]: p[list].map((item, i) => (i === index ? value : item)) }));

  const addListItem = (list) => setNewProject((p) => ({ ...p, [list]: [...p[list], ''] }));
  const removeListItem = (list, index) =>
    setNewProject((p) => ({ ...p, [list]: p[list].filter((_, i) => i !== index) }));

  const getRandomColor = () => {
    const colors = ['#FFB74D', '#4DB6AC', '#BA68C8', '#7986CB', '#F06292', '#81C784'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const saveProject = async () => {
    if (!newProject.name.trim()) return alert('Digite o nome do projeto!');

    let currentProjectId = selectedProject?.id;
    let projectResult;

    if (isEditing && selectedProject) {
      const { data, error } = await supabase
        .from('projects')
        .update({ name: newProject.name, type: newProject.type })
        .eq('id', selectedProject.id)
        .select()
        .single();
      if (error) return alert('Erro ao atualizar projeto');
      projectResult = data;
    } else {
      const { data, error } = await supabase
        .from('projects')
        .insert([{ name: newProject.name, type: newProject.type, user_id: user.id }])
        .select()
        .single();
      if (error) return alert('Erro ao criar projeto');
      projectResult = data;
      currentProjectId = data.id;
    }

    if (newProject.photoFile) {
      const fileName = `${Date.now()}_${newProject.photoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('projects_photos')
        .upload(fileName, newProject.photoFile, { upsert: true });
      if (uploadError) return alert('Erro ao enviar foto');

      const { data: urlData } = supabase.storage
        .from('projects_photos')
        .getPublicUrl(fileName);

      await supabase
        .from('projects_photos')
        .insert([{ project_id: currentProjectId, photo_url: urlData.publicUrl }]);
    }

    // Limpar Pavimentos e EAP existentes
    await supabase.from('pavimentos').delete().eq('project_id', currentProjectId);
    await supabase.from('eap').delete().eq('project_id', currentProjectId);

    // Inserir Pavimentos e EAP
    for (const pav of newProject.pavimentos.filter(Boolean))
      await supabase.from('pavimentos').insert({ name: pav, project_id: currentProjectId });
    for (const eap of newProject.eap.filter(Boolean))
      await supabase.from('eap').insert({ name: eap, project_id: currentProjectId });

    setNewProject(initialProjectState());
    setShowForm(false);
    setIsEditing(false);
    fetchProjects(user.id);
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Deseja realmente apagar este projeto?')) return;

    const { data: photoRecords } = await supabase
      .from('projects_photos')
      .select('photo_url')
      .eq('project_id', projectId);

    if (photoRecords?.length) {
      const fileNames = photoRecords.map((p) => p.photo_url.split('/').pop());
      await supabase.storage.from('projects_photos').remove(fileNames);
      await supabase.from('projects_photos').delete().eq('project_id', projectId);
    }

    await supabase.from('pavimentos').delete().eq('project_id', projectId);
    await supabase.from('eap').delete().eq('project_id', projectId);
    await supabase.from('projects').delete().eq('id', projectId);

    if (selectedProject?.id === projectId) setSelectedProject(null);
    fetchProjects(user.id);
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setIsEditing(true);
    setShowForm(true);
    setNewProject({
      name: project.name,
      type: project.type,
      pavimentos: project.pavimentos?.map((p) => p.name) || [],
      eap: project.eap?.map((e) => e.name) || [],
      photoFile: null,
      photoUrl: project.photo_url,
    });
  };

  const openCardsPage = (proj) => {
    navigate(`/cards/${encodeURIComponent(proj.name)}`, {
      state: { projectName: proj.name, projectPhoto: proj.photo_url },
    });
  };

  return (
    <div className="containers-page">
      <header className="containers-header"><h1>Container</h1></header>

      <div className="containers-body">
        {/* Sidebar */}
        <aside className="containers-sidebar">
          <div className="sidebar-item"><FaCog className="icon" /><span>Controle</span></div>
          <button className="sidebar-btn" onClick={() => { setIsEditing(false); setShowForm(true); }}>
            <FaPlus className="icon" /> Novo Projeto
          </button>

          <div className="sidebar-projects">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className={`sidebar-project ${selectedProject?.id === proj.id ? 'active' : ''}`}
                onClick={() => setSelectedProject(proj)}
              >
                <span className="project-name">{proj.name}</span>
                <FaTrash
                  className="delete-icon hidden"
                  onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id); }}
                />
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="containers-main">
          {!selectedProject ? (
            projects.length ? (
              <div className="projects-grid">
                {projects.map((proj) => (
                  <div key={proj.id} className="project-box" onClick={() => openCardsPage(proj)}>
                    <div
                      className="project-photo"
                      style={{ backgroundColor: proj.photo_url ? undefined : getRandomColor(), color: '#fff' }}
                    >
                      {proj.photo_url ? <img src={proj.photo_url} alt={proj.name} /> : proj.name.charAt(0)}
                    </div>
                    <h3>{proj.name}</h3>
                    <p>{proj.type === 'vertical' ? 'Edificação Vertical' : 'Edificação Horizontal'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-projects">Tudo calmo por aqui ainda...</p>
            )
          ) : (
            <div className="project-details">
              <button className="back-btn" onClick={() => setSelectedProject(null)}>&larr; Voltar</button>

              <div
                className="details-photo"
                style={{ backgroundColor: selectedProject.photo_url ? undefined : getRandomColor(), color: '#fff' }}
              >
                {selectedProject.photo_url ? <img src={selectedProject.photo_url} alt={selectedProject.name} /> : selectedProject.name.charAt(0)}
              </div>

              <h2>{selectedProject.name}</h2>
              <p>Tipo: {selectedProject.type === 'vertical' ? 'Edificação Vertical' : 'Edificação Horizontal'}</p>

              {/* Pavimentos */}
              {selectedProject.pavimentos?.length > 0 && (
                <div className="project-section">
                  <h3>Pavimentos:</h3>
                  <ul>
                    {selectedProject.pavimentos.map((pav) => (
                      <li key={pav.id}>{pav.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* EAP */}
              {selectedProject.eap?.length > 0 && (
                <div className="project-section">
                  <h3>EAP:</h3>
                  <ul>
                    {selectedProject.eap.map((eapItem) => (
                      <li key={eapItem.id}>{eapItem.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button className="edit-btn" onClick={() => handleEditProject(selectedProject)}>Editar</button>
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{isEditing ? 'Editar Projeto' : 'Novo Projeto'}</h2>

            <div className="project-photo-upload">
              <label htmlFor="photo-upload" className="photo-circle">
                {newProject.photoUrl ? <img src={newProject.photoUrl} alt="Projeto" /> : <FaCamera />}
              </label>
              <input type="file" id="photo-upload" accept="image/*" onChange={handlePhotoUpload} hidden />
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
                <div className="list-header">Pavimentos <FaPlus className="add-icon" onClick={() => addListItem('pavimentos')} /></div>
                {newProject.pavimentos.map((p, i) => (
                  <div key={i} className="list-item">
                    <input type="text" placeholder={`Pavimento ${i + 1}`} value={p} onChange={(e) => handleListChange('pavimentos', i, e.target.value)} />
                    <FaTrash className="delete-icon" onClick={() => removeListItem('pavimentos', i)} />
                  </div>
                ))}
              </>
            )}

            <div className="list-header">EAP <FaPlus className="add-icon" onClick={() => addListItem('eap')} /></div>
            {newProject.eap.map((e, i) => (
              <div key={i} className="list-item">
                <input type="text" placeholder={`EAP ${i + 1}`} value={e} onChange={(ev) => handleListChange('eap', i, ev.target.value)} />
                <FaTrash className="delete-icon" onClick={() => removeListItem('eap', i)} />
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
