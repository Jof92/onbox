import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaTrash, FaCamera } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import Sidebar from "./Sidebar";
import SetoresManager from "./SetoresManager";
import "./Containers.css";

export default function ProjectManager({ containerAtual, onProjectSelect, onProjectDeleted }) {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [setores, setSetores] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newProject, setNewProject] = useState(initialProjectState());
  const [showSetoresModal, setShowSetoresModal] = useState(false);

  function initialProjectState() {
    return {
      name: "",
      type: "vertical",
      pavimentos: [],
      eap: [],
      photoFile: null,
      photoUrl: null,
    };
  }

  const fetchProjects = async (userId) => {
    const { data: projectsData, error } = await supabase
      .from("projects")
      .select("*, pavimentos(*), eap(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setProjects([]);
      return;
    }

    const projectsWithPhotos = await Promise.all(
      (projectsData || []).map(async (proj) => {
        const { data: photoData } = await supabase
          .from("projects_photos")
          .select("photo_url")
          .eq("project_id", proj.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        return { ...proj, photo_url: photoData?.photo_url || null };
      })
    );

    setProjects(projectsWithPhotos);
    setSelectedProject(null);
  };

  const fetchSetores = async (userId) => {
    const { data: setoresData, error } = await supabase
      .from("setores")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao buscar setores:", error);
      setSetores([]);
    } else {
      setSetores(setoresData || []);
    }
  };

  useEffect(() => {
    if (containerAtual) {
      setLoading(true);
      Promise.all([fetchProjects(containerAtual), fetchSetores(containerAtual)]).finally(() =>
        setLoading(false)
      );
    }
  }, [containerAtual]);

  const getRandomColor = () => {
    const colors = ["#FFB74D", "#4DB6AC", "#BA68C8", "#7986CB", "#F06292", "#81C784"];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file)
      setNewProject((p) => ({ ...p, photoFile: file, photoUrl: URL.createObjectURL(file) }));
  };

  const handleListChange = (list, index, value) =>
    setNewProject((p) => ({ ...p, [list]: p[list].map((item, i) => (i === index ? value : item)) }));

  const addListItem = (list) => setNewProject((p) => ({ ...p, [list]: [...p[list], ""] }));
  const removeListItem = (list, index) =>
    setNewProject((p) => ({ ...p, [list]: p[list].filter((_, i) => i !== index) }));

  const saveProject = async () => {
    if (!newProject.name.trim()) return alert("Digite o nome do projeto!");
    setLoading(true);

    let currentProjectId = selectedProject?.id;
    let projectResult;

    if (isEditing && selectedProject) {
      const { data, error } = await supabase
        .from("projects")
        .update({ name: newProject.name, type: newProject.type })
        .eq("id", selectedProject.id)
        .select()
        .single();
      if (error) {
        setLoading(false);
        return alert("Erro ao atualizar projeto");
      }
      projectResult = data;
    } else {
      const { data, error } = await supabase
        .from("projects")
        .insert([{ name: newProject.name, type: newProject.type, user_id: containerAtual }])
        .select()
        .single();
      if (error) {
        setLoading(false);
        return alert("Erro ao criar projeto");
      }
      projectResult = data;
      currentProjectId = data.id;
    }

    if (newProject.photoFile) {
      const fileName = `${Date.now()}_${newProject.photoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("projects_photos")
        .upload(fileName, newProject.photoFile, { upsert: true });

      if (uploadError) {
        setLoading(false);
        return alert("Erro ao enviar foto");
      }

      const { data: urlData } = supabase.storage.from("projects_photos").getPublicUrl(fileName);
      await supabase.from("projects_photos").insert([
        { project_id: currentProjectId, photo_url: urlData.publicUrl },
      ]);
    }

    await supabase.from("pavimentos").delete().eq("project_id", currentProjectId);
    await supabase.from("eap").delete().eq("project_id", currentProjectId);

    for (const pav of newProject.pavimentos.filter(Boolean))
      await supabase.from("pavimentos").insert({ name: pav, project_id: currentProjectId });
    for (const eap of newProject.eap.filter(Boolean))
      await supabase.from("eap").insert({ name: eap, project_id: currentProjectId });

    setNewProject(initialProjectState());
    setShowForm(false);
    setIsEditing(false);
    await fetchProjects(containerAtual);
    setLoading(false);
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm("Deseja realmente apagar este projeto?")) return;
    setLoading(true);

    const { data: photoRecords } = await supabase
      .from("projects_photos")
      .select("photo_url")
      .eq("project_id", projectId);
    if (photoRecords?.length) {
      const fileNames = photoRecords.map((p) => p.photo_url.split("/").pop());
      await supabase.storage.from("projects_photos").remove(fileNames);
      await supabase.from("projects_photos").delete().eq("project_id", projectId);
    }

    await supabase.from("pavimentos").delete().eq("project_id", projectId);
    await supabase.from("eap").delete().eq("project_id", projectId);
    await supabase.from("projects").delete().eq("id", projectId);

    if (selectedProject?.id === projectId) setSelectedProject(null);
    onProjectDeleted?.();
    await fetchProjects(containerAtual);
    setLoading(false);
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setIsEditing(true);
    setShowForm(true);
    setNewProject({
      name: project.name || "",
      type: project.type || "vertical",
      pavimentos: project.pavimentos?.map((p) => p.name) || [],
      eap: project.eap?.map((e) => e.name) || [],
      photoFile: null,
      photoUrl: project.photo_url || null,
    });
  };

  const openCardsPage = (proj) => {
    navigate(`/cards/${encodeURIComponent(proj.name || "Projeto")}`, {
      state: { projectId: proj.id, projectName: proj.name, projectPhoto: proj.photo_url },
    });
  };

  const openSetorCardsPage = (setor) => {
    navigate(`/cards/${encodeURIComponent(setor.name || "Setor")}`, {
      state: {
        setorId: setor.id,
        setorName: setor.name,
        setorPhoto: setor.photo_url,
        entityType: "setor",
      },
    });
  };

  const handleOpenSetoresManager = () => {
    if (!containerAtual) {
      alert("Usuário não identificado. Faça login novamente.");
      return;
    }
    setShowSetoresModal(true);
  };

  if (loading && !projects.length && !setores.length) return <Loading />;

  return (
    <>
      <Sidebar
        projects={projects}
        selectedProject={selectedProject}
        onCreateProject={() => {
          setIsEditing(false);
          setShowForm(true);
        }}
        onProjectSelect={(proj) => {
          setSelectedProject(proj);
          onProjectSelect?.(proj);
        }}
        onDeleteProject={handleDeleteProject}
        onOpenSetoresManager={handleOpenSetoresManager}
      />

      <main className="containers-main">
        {!selectedProject ? (
          <>
            {/* Seção de Projetos */}
            {projects.length > 0 ? (
              <div className="projects-grid">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="project-box"
                    onClick={() => openCardsPage(proj)}
                  >
                    <div
                      className="project-photo"
                      style={{
                        backgroundColor: proj.photo_url ? undefined : getRandomColor(),
                        color: "#fff",
                      }}
                    >
                      {proj.photo_url ? (
                        <img src={proj.photo_url} alt={proj.name || "Projeto"} />
                      ) : (
                        proj.name?.charAt(0).toUpperCase() || "?"
                      )}
                    </div>
                    <h3>{proj.name || "Projeto"}</h3>
                    <p>
                      {proj.type === "vertical" ? "Edificação Vertical" : "Edificação Horizontal"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-projects">Tudo calmo por aqui ainda...</p>
            )}

            {/* Linha divisória e Setores (só se houver setores) */}
            {setores.length > 0 && (
              <>
                <hr className="setores-divider" />
                <div className="projects-grid">
                  {setores.map((setor) => (
                    <div
                      key={setor.id}
                      className="project-box"
                      onClick={() => openSetorCardsPage(setor)}
                    >
                      <div
                        className="project-photo"
                        style={{
                          backgroundColor: setor.photo_url ? undefined : getRandomColor(),
                          color: "#fff",
                        }}
                      >
                        {setor.photo_url ? (
                          <img src={setor.photo_url} alt={setor.name || "Setor"} />
                        ) : (
                          setor.name?.charAt(0).toUpperCase() || "?"
                        )}
                      </div>
                      <h3>{setor.name || "Setor"}</h3>
                      <p>Setor</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          /* Detalhes do projeto selecionado */
          <div className="project-details">
            <button className="back-btn" onClick={() => setSelectedProject(null)}>
              <FaArrowLeft />
            </button>

            <div
              className="details-photo"
              style={{
                backgroundColor: selectedProject.photo_url ? undefined : getRandomColor(),
                color: "#fff",
              }}
            >
              {selectedProject.photo_url ? (
                <img src={selectedProject.photo_url} alt={selectedProject.name || "Projeto"} />
              ) : (
                selectedProject.name?.charAt(0).toUpperCase() || "?"
              )}
            </div>

            <h2>{selectedProject.name || "Projeto"}</h2>
            <p>
              Tipo:{" "}
              {selectedProject.type === "vertical" ? "Edificação Vertical" : "Edificação Horizontal"}
            </p>

            {(selectedProject.pavimentos?.length > 0 || selectedProject.eap?.length > 0) && (
              <div className="project-sections">
                {selectedProject.pavimentos?.length > 0 && (
                  <div className="project-section">
                    <h3>Pavimentos</h3>
                    <div className="project-list-container">
                      <ul>
                        {selectedProject.pavimentos.map((p) => (
                          <li key={p.id}>{p.name || ""}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {selectedProject.eap?.length > 0 && (
                  <div className="project-section">
                    <h3>EAP</h3>
                    <div className="project-list-container">
                      <ul>
                        {selectedProject.eap.map((e) => (
                          <li key={e.id}>{e.name || ""}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button className="edit-btn" onClick={() => handleEditProject(selectedProject)}>
              Editar
            </button>
          </div>
        )}
      </main>

      {/* Modal de projeto */}
      {showForm && (
        <div className="modal-overlay1">
          <div className="modal-content1">
            <h2>{isEditing ? "Editar Projeto" : "Novo Projeto"}</h2>

            <div className="project-photo-upload">
              <label htmlFor="photo-upload" className="photo-circle">
                {newProject.photoUrl ? (
                  <img src={newProject.photoUrl} alt="Projeto" />
                ) : (
                  <FaCamera />
                )}
              </label>
              <input
                type="file"
                id="photo-upload"
                accept="image/*"
                onChange={handlePhotoUpload}
                hidden
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

            {newProject.type === "vertical" && (
              <div>
                <div className="list-header">
                  Pavimentos{" "}
                  <FaPlus
                    className="add-icon"
                    onClick={() => addListItem("pavimentos")}
                  />
                </div>
                <div className="list-container">
                  {newProject.pavimentos.map((p, i) => (
                    <div key={i} className="list-item">
                      <input
                        type="text"
                        placeholder={`Pavimento ${i + 1}`}
                        value={p}
                        onChange={(e) => handleListChange("pavimentos", i, e.target.value)}
                      />
                      <FaTrash
                        className="delete-icon"
                        onClick={() => removeListItem("pavimentos", i)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="list-header">
              EAP <FaPlus className="add-icon" onClick={() => addListItem("eap")} />
            </div>
            <div className="list-container">
              {newProject.eap.map((e, i) => (
                <div key={i} className="list-item">
                  <input
                    type="text"
                    placeholder={`EAP ${i + 1}`}
                    value={e}
                    onChange={(ev) => handleListChange("eap", i, ev.target.value)}
                  />
                  <FaTrash className="delete-icon" onClick={() => removeListItem("eap", i)} />
                </div>
              ))}
            </div>

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

      {/* Modal de Setor */}
      {showSetoresModal && containerAtual && (
        <SetoresManager
          userId={containerAtual}
          onClose={() => {
            setShowSetoresModal(false);
            fetchSetores(containerAtual);
          }}
        />
      )}
    </>
  );
}