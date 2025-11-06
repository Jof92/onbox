// src/components/ProjectManager.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaTrash, FaCamera } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import Sidebar from "./Sidebar";
import SetoresManager from "./SetoresManager";
import backImg from "../assets/back.png";
import back1Img from "../assets/back1.png";
import back2Img from "../assets/back2.png";
import back3Img from "../assets/back3.png";
import "./Containers.css";

export default function ProjectManager({ containerAtual, onProjectSelect, onProjectDeleted }) {
  const navigate = useNavigate();
  const location = useLocation(); // para passar 'from' ao navegar

  const [projects, setProjects] = useState([]);
  const [setores, setSetores] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newProject, setNewProject] = useState(initialProjectState());
  const [showSetoresModal, setShowSetoresModal] = useState(false);
  const [menuSetorAberto, setMenuSetorAberto] = useState(null);
  const [background, setBackground] = useState("#f1f1f1ff"); // padrão
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);

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
      .select(`
        *,
        pavimentos(*),
        eap(*)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar projetos:", error);
      setProjects([]);
      return;
    }

    const projectsWithPhotos = await Promise.all(
      (projectsData || []).map(async (proj) => {
        const sortedPavimentos = [...(proj.pavimentos || [])].sort(
          (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
        );
        const sortedEap = [...(proj.eap || [])].sort(
          (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
        );

        const { data: photoData } = await supabase
          .from("projects_photos")
          .select("photo_url")
          .eq("project_id", proj.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          ...proj,
          pavimentos: sortedPavimentos,
          eap: sortedEap,
          photo_url: photoData?.photo_url || null,
        };
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
      return;
    }

    const setoresComFoto = await Promise.all(
      (setoresData || []).map(async (setor) => {
        const { data: photoData } = await supabase
          .from("setores_photos")
          .select("photo_url")
          .eq("setor_id", setor.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        return { ...setor, photo_url: photoData?.photo_url || null };
      })
    );

    setSetores(setoresComFoto);
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

    try {
      if (isEditing && selectedProject) {
        const { data, error } = await supabase
          .from("projects")
          .update({ name: newProject.name, type: newProject.type })
          .eq("id", selectedProject.id)
          .select()
          .single();
        if (error) throw error;
        projectResult = data;
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert([{ name: newProject.name, type: newProject.type, user_id: containerAtual }])
          .select()
          .single();
        if (error) throw error;
        projectResult = data;
        currentProjectId = data.id;
      }

      if (newProject.photoFile) {
        const fileName = `${Date.now()}_${newProject.photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("projects_photos")
          .upload(fileName, newProject.photoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("projects_photos").getPublicUrl(fileName);
        await supabase.from("projects_photos").insert([
          { project_id: currentProjectId, photo_url: urlData.publicUrl },
        ]);
      }

      await supabase.from("pavimentos").delete().eq("project_id", currentProjectId);
      const pavimentosToInsert = newProject.pavimentos
        .filter(Boolean)
        .map((name, index) => ({ name, project_id: currentProjectId, ordem: index }));
      if (pavimentosToInsert.length > 0) {
        await supabase.from("pavimentos").insert(pavimentosToInsert);
      }

      await supabase.from("eap").delete().eq("project_id", currentProjectId);
      const eapToInsert = newProject.eap
        .filter(Boolean)
        .map((name, index) => ({ name, project_id: currentProjectId, ordem: index }));
      if (eapToInsert.length > 0) {
        await supabase.from("eap").insert(eapToInsert);
      }

      setNewProject(initialProjectState());
      setShowForm(false);
      setIsEditing(false);
      await fetchProjects(containerAtual);
    } catch (err) {
      console.error("Erro ao salvar projeto:", err);
      alert("Erro ao salvar projeto.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm("Deseja realmente apagar este projeto?")) return;
    setLoading(true);

    try {
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
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
      alert("Erro ao excluir projeto.");
    } finally {
      setLoading(false);
    }
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

  // ✅ Navegação com `from` para permitir retorno preciso nas Pilhas
  const openCardsPage = (proj) => {
    navigate(`/cards/${encodeURIComponent(proj.name || "Projeto")}`, {
      state: {
        projectId: proj.id,
        projectName: proj.name,
        projectPhoto: proj.photo_url,
        from: location.pathname,
        containerId: containerAtual,
      },
    });
  };

  const openSetorCardsPage = (setor) => {
    navigate(`/cards/${encodeURIComponent(setor.name || "Setor")}`, {
      state: {
        setorId: setor.id,
        setorName: setor.name,
        setorPhoto: setor.photo_url,
        entityType: "setor",
        from: location.pathname,
        containerId: containerAtual,
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

  const handleUpdateSetorPhoto = async (setor) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setLoading(true);
      try {
        const { data: oldPhotos } = await supabase
          .from("setores_photos")
          .select("photo_url")
          .eq("setor_id", setor.id);

        if (oldPhotos?.length) {
          const fileNames = oldPhotos.map((p) => p.photo_url.split("/").pop());
          await supabase.storage.from("setores_photos").remove(fileNames);
          await supabase.from("setores_photos").delete().eq("setor_id", setor.id);
        }

        const fileName = `setores/${setor.id}_${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("setores_photos")
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("setores_photos").getPublicUrl(fileName);
        const newPhotoUrl = urlData.publicUrl;

        await supabase
          .from("setores_photos")
          .insert({ setor_id: setor.id, photo_url: newPhotoUrl });

        setSetores((prev) =>
          prev.map((s) => (s.id === setor.id ? { ...s, photo_url: newPhotoUrl } : s))
        );

        alert("Foto atualizada com sucesso!");
      } catch (err) {
        console.error("Erro ao atualizar foto:", err);
        alert("Erro ao atualizar a foto do setor.");
      } finally {
        setLoading(false);
      }
    };
    fileInput.click();
  };

  const handleDeleteSetor = async (setorId) => {
    if (!window.confirm("Deseja realmente excluir este setor?")) return;

    setLoading(true);
    try {
      const { data: photoRecords } = await supabase
        .from("setores_photos")
        .select("photo_url")
        .eq("setor_id", setorId);

      if (photoRecords?.length) {
        const fileNames = photoRecords.map((p) => p.photo_url.split("/").pop());
        await supabase.storage.from("setores_photos").remove(fileNames);
        await supabase.from("setores_photos").delete().eq("setor_id", setorId);
      }

      await supabase.from("setores").delete().eq("id", setorId);
      setSetores((prev) => prev.filter((s) => s.id !== setorId));
      setMenuSetorAberto(null);
      alert("Setor excluído com sucesso!");
    } catch (err) {
      console.error("Erro ao excluir setor:", err);
      alert("Erro ao excluir o setor.");
    } finally {
      setLoading(false);
    }
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

      <main className="containers-main"
          style={{
          background: background.startsWith("#")
            ? background
            : `url(${background}) center/300px auto repeat`,
        }}
      >
        {/* Botão de três pontos */}
        <div className="dot-btn"
          style={{
            position: "absolute",
            right: "10px",
            cursor: "pointer",
            fontSize: "20px",
            zIndex: 1001,
            color: "#fff",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
          onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
        >
          ⋮
        </div>

        {/* Menu de fundo */}
        {showBackgroundMenu && (
          <div className="background-menu">
            {[
              { label: "Padrão", value: "#f1f1f1ff" },
              { label: "Preto", value: "#000000" },
              { label: "Branco", value: "#ffffff" },
              { label: "Azul Leve", value: "#e3f2fd" },
              { label: "Verde Leve", value: "#e8f5e9" },
              { label: "Fundo 1", value: backImg },
              { label: "Fundo 2", value: back1Img },
              { label: "Fundo 3", value: back2Img },
              { label: "Fundo 4", value: back3Img },
            ].map((opt) => (
              <div
                key={opt.value}
                className="background-option"
                onClick={() => {
                  setBackground(opt.value);
                  setShowBackgroundMenu(false);
                }}
              >
                <div
                  className="background-swatch"
                  style={{
                    backgroundColor: opt.value.startsWith("#") ? opt.value : "transparent",
                    backgroundImage: opt.value.startsWith("#")
                      ? "none"
                      : `url(${opt.value})`,
                  }}
                />
                {opt.label}
              </div>
            ))}
          </div>
        )}
        {!selectedProject ? (
          <>
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

            {setores.length > 0 && (
              <>
                <hr className="setores-divider" />
                <div className="projects-grid">
                  {setores.map((setor) => (
                    <div
                      key={setor.id}
                      className="project-box"
                      onClick={() => openSetorCardsPage(setor)}
                      style={{ position: "relative", cursor: "pointer" }}
                    >
                      <div
                        className="setor-actions-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuSetorAberto(menuSetorAberto === setor.id ? null : setor.id);
                        }}
                      >
                        <span className="setor-actions-dots">⋯</span>
                      </div>

                      {menuSetorAberto === setor.id && (
                        <div className="setor-actions-menu">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleUpdateSetorPhoto(setor);
                              setMenuSetorAberto(null);
                            }}
                          >
                            Mudar foto
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleDeleteSetor(setor.id);
                              setMenuSetorAberto(null);
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      )}

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
              {selectedProject.type === "vertical"
                ? "Edificação Vertical"
                : "Edificação Horizontal"}
            </p>

            {(selectedProject.pavimentos?.length > 0 || selectedProject.eap?.length > 0) && (
              <div className="project-sections">
                {selectedProject.pavimentos?.length > 0 && (
                  <div className="project-section">
                    <h3>Pavimentos</h3>
                    <ul>
                      {selectedProject.pavimentos.map((p) => (
                        <li key={p.id}>{p.name || ""}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedProject.eap?.length > 0 && (
                  <div className="project-section">
                    <h3>EAP</h3>
                    <ul>
                      {selectedProject.eap.map((e) => (
                        <li key={e.id}>{e.name || ""}</li>
                      ))}
                    </ul>
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
                  <FaPlus className="add-icon" onClick={() => addListItem("pavimentos")} />
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