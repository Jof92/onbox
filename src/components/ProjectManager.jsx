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
  const location = useLocation();

  const [projects, setProjects] = useState([]);
  const [setores, setSetores] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newProject, setNewProject] = useState(initialProjectState());
  const [showSetoresModal, setShowSetoresModal] = useState(false);
  const [menuSetorAberto, setMenuSetorAberto] = useState(null);
  const [background, setBackground] = useState("#f1f1f1ff");
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const [profile, setProfile] = useState(null);

  // Estados para membros do projeto
  const [membrosTexto, setMembrosTexto] = useState("");
  const [membrosSelecionados, setMembrosSelecionados] = useState([]); // { id, nickname, avatar_url }
  const [sugestoesMembros, setSugestoesMembros] = useState([]);
  const [mostrarSugestoesMembros, setMostrarSugestoesMembros] = useState(false);
  const [posicaoCaretMembros, setPosicaoCaretMembros] = useState(0);

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

  // Carregar perfil do usuário logado
  useEffect(() => {
    if (containerAtual) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", containerAtual)
          .single();
        setProfile(data);
      };
      fetchProfile();
    }
  }, [containerAtual]);

  const handleSetBackground = async (value) => {
    setBackground(value);
    setShowBackgroundMenu(false);
    if (containerAtual) {
      const { error } = await supabase
        .from("profiles")
        .update({ background: value })
        .eq("id", containerAtual);
      if (error) {
        setBackground("#f1f1f1ff");
      }
    }
  };

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
      const loadUserBackground = async () => {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("background")
          .eq("id", containerAtual)
          .single();
        setBackground(profile?.background || "#f1f1f1ff");
      };

      Promise.all([
        loadUserBackground(),
        fetchProjects(containerAtual),
        fetchSetores(containerAtual)
      ]).finally(() => setLoading(false));
    }
  }, [containerAtual]);

  const getRandomColor = () => {
    const colors = ["#FFB74D", "#4DB6AC", "#BA68C8", "#7986CB", "#F06292", "#81C784"];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // === Funções de menção de membros ===
  const buscarSugestoesMembros = async (termo) => {
    if (!termo.trim() || !containerAtual) {
      setSugestoesMembros([]);
      return;
    }

    try {
      const { data: convites } = await supabase
        .from("convites")
        .select("remetente_id")
        .eq("user_id", containerAtual)
        .eq("status", "aceito");

      if (!convites?.length) {
        setSugestoesMembros([]);
        return;
      }

      const remetenteIds = convites.map(c => c.remetente_id);
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", remetenteIds)
        .ilike("nickname", `%${termo}%`)
        .limit(5);

      setSugestoesMembros(perfis || []);
    } catch {
      setSugestoesMembros([]);
    }
  };

  const handleMembrosChange = (e) => {
    const valor = e.target.value;
    setMembrosTexto(valor);

    const pos = e.target.selectionStart;
    const antes = valor.substring(0, pos);
    const ultimaArroba = antes.lastIndexOf("@");

    if (ultimaArroba !== -1) {
      const termo = antes.substring(ultimaArroba + 1).trim();
      if (termo) {
        setPosicaoCaretMembros(pos);
        setMostrarSugestoesMembros(true);
        buscarSugestoesMembros(termo);
      } else {
        setMostrarSugestoesMembros(false);
      }
    } else {
      setMostrarSugestoesMembros(false);
    }
  };

  const inserirMembro = (perfil) => {
    const prefixo = membrosTexto.substring(0, posicaoCaretMembros);
    const sufixo = membrosTexto.substring(posicaoCaretMembros);
    const ultimaArroba = prefixo.lastIndexOf("@");
    if (ultimaArroba === -1) return;

    const novoTexto = prefixo.substring(0, ultimaArroba + 1) + perfil.nickname + " " + sufixo;
    setMembrosTexto(novoTexto);
    setMostrarSugestoesMembros(false);

    if (!membrosSelecionados.some(m => m.id === perfil.id)) {
      setMembrosSelecionados(prev => [...prev, {
        id: perfil.id,
        nickname: perfil.nickname,
        avatar_url: perfil.avatar_url
      }]);
    }

    setTimeout(() => {
      const input = document.getElementById("membros-input");
      if (input) {
        input.focus();
        input.setSelectionRange(novoTexto.length, novoTexto.length);
      }
    }, 0);
  };

  // === Salvamento com membros ===
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

      // Upload de foto
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

      // Pavimentos e EAP
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

      // === SALVAR MEMBROS NA TABELA project_members ===
      if (membrosSelecionados.length > 0) {
        // Primeiro, remove membros antigos (se estiver editando)
        if (isEditing && selectedProject) {
          await supabase.from("project_members").delete().eq("project_id", currentProjectId);
        }

        // Insere novos membros
        const membrosParaInserir = membrosSelecionados.map(m => ({
          project_id: currentProjectId,
          user_id: m.id,
          added_by: containerAtual
        }));
        const { error: membrosError } = await supabase.from("project_members").insert(membrosParaInserir);
        if (membrosError) throw membrosError;

        // Envia notificações
        const notificacoes = membrosSelecionados.map(m => ({
          user_id: m.id,
          remetente_id: containerAtual,
          mensagem: `${profile?.nome || "Você"} te adicionou ao projeto "${projectResult.name}"`,
          projeto_id: currentProjectId,
          lido: false,
          created_at: new Date().toISOString(),
          tipo: "convite_projeto"
        }));
        await supabase.from("notificacoes").insert(notificacoes);
      }

      // Reset
      setNewProject(initialProjectState());
      setMembrosTexto("");
      setMembrosSelecionados([]);
      setShowForm(false);
      setIsEditing(false);
      await fetchProjects(containerAtual);
    } catch (err) {
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
      await supabase.from("project_members").delete().eq("project_id", projectId); // ✅ Remove membros
      await supabase.from("projects").delete().eq("id", projectId);

      if (selectedProject?.id === projectId) setSelectedProject(null);
      onProjectDeleted?.();
      await fetchProjects(containerAtual);
    } catch (err) {
      alert("Erro ao excluir projeto.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditProject = async (project) => {
    setSelectedProject(project);
    setIsEditing(true);
    setShowForm(true);

    // Carregar membros do projeto
    const { data: membros } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", project.id);

    if (membros?.length) {
      const userIds = membros.map(m => m.user_id);
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds);

      setMembrosSelecionados(perfis || []);
      setMembrosTexto(perfis?.map(p => `@${p.nickname}`).join(" ") || "");
    } else {
      setMembrosSelecionados([]);
      setMembrosTexto("");
    }

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
      alert("Usuário não identificado.");
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
        alert("Foto atualizada!");
      } catch (err) {
        alert("Erro ao atualizar a foto.");
      } finally {
        setLoading(false);
      }
    };
    fileInput.click();
  };

  const handleDeleteSetor = async (setorId) => {
    if (!window.confirm("Excluir setor?")) return;
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
      alert("Setor excluído!");
    } catch (err) {
      alert("Erro ao excluir.");
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
          setMembrosTexto("");
          setMembrosSelecionados([]);
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
                onClick={() => handleSetBackground(opt.value)}
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

        {/* ... resto do conteúdo (grid de projetos/setores) ... */}
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
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    setNewProject((p) => ({ ...p, photoFile: file, photoUrl: URL.createObjectURL(file) }));
                }}
                hidden
              />
            </div>

            <label>Nome do Projeto</label>
            <input
              type="text"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            />

            {/* ✅ Input de membros */}
            <label>Adicionar membros (digite @)</label>
            <div style={{ position: "relative" }}>
              <input
                id="membros-input"
                type="text"
                value={membrosTexto}
                onChange={handleMembrosChange}
                placeholder="Ex: @joao, @maria"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
                onBlur={() => setTimeout(() => setMostrarSugestoesMembros(false), 200)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && mostrarSugestoesMembros && sugestoesMembros.length > 0) {
                    e.preventDefault();
                    inserirMembro(sugestoesMembros[0]);
                  }
                }}
              />

              {mostrarSugestoesMembros && sugestoesMembros.length > 0 && (
                <div className="sugestoes-dropdown" style={{ position: "absolute", zIndex: 1000, width: "100%", background: "#fff", border: "1px solid #ddd", borderRadius: "4px", maxHeight: "150px", overflowY: "auto" }}>
                  {sugestoesMembros.map((sug) => (
                    <div
                      key={sug.id}
                      onClick={() => inserirMembro(sug)}
                      onMouseDown={(e) => e.preventDefault()}
                      style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #eee" }}
                    >
                      {sug.avatar_url ? (
                        <img src={sug.avatar_url} alt="" style={{ width: "20px", height: "20px", borderRadius: "50%", verticalAlign: "middle", marginRight: "8px" }} />
                      ) : (
                        <span style={{ display: "inline-block", width: "20px", height: "20px", backgroundColor: "#ccc", borderRadius: "50%", textAlign: "center", lineHeight: "20px", color: "#fff", marginRight: "8px" }}>
                          {sug.nickname?.charAt(0).toUpperCase() || "?"}
                        </span>
                      )}
                      {sug.nickname}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Avatares dos membros selecionados */}
            {membrosSelecionados.length > 0 && (
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {membrosSelecionados.map((membro) => (
                  <div key={membro.id} style={{ position: "relative", textAlign: "center" }}>
                    {membro.avatar_url ? (
                      <img
                        src={membro.avatar_url}
                        alt={membro.nickname}
                        style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2px solid #007bff" }}
                      />
                    ) : (
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#ccc", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", border: "2px solid #007bff" }}>
                        {membro.nickname?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontSize: "10px", display: "block", marginTop: "2px" }}>
                      {membro.nickname}
                    </span>
                  </div>
                ))}
              </div>
            )}

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
                  <FaPlus className="add-icon" onClick={() => {
                    setNewProject(p => ({ ...p, pavimentos: [...p.pavimentos, ""] }));
                  }} />
                </div>
                <div className="list-container">
                  {newProject.pavimentos.map((p, i) => (
                    <div key={i} className="list-item">
                      <input
                        type="text"
                        placeholder={`Pavimento ${i + 1}`}
                        value={p}
                        onChange={(e) => {
                          const novos = [...newProject.pavimentos];
                          novos[i] = e.target.value;
                          setNewProject({ ...newProject, pavimentos: novos });
                        }}
                      />
                      <FaTrash
                        className="delete-icon"
                        onClick={() => {
                          const novos = newProject.pavimentos.filter((_, idx) => idx !== i);
                          setNewProject({ ...newProject, pavimentos: novos });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="list-header">
              EAP <FaPlus className="add-icon" onClick={() => {
                setNewProject(p => ({ ...p, eap: [...p.eap, ""] }));
              }} />
            </div>
            <div className="list-container">
              {newProject.eap.map((e, i) => (
                <div key={i} className="list-item">
                  <input
                    type="text"
                    placeholder={`EAP ${i + 1}`}
                    value={e}
                    onChange={(ev) => {
                      const novos = [...newProject.eap];
                      novos[i] = ev.target.value;
                      setNewProject({ ...newProject, eap: novos });
                    }}
                  />
                  <FaTrash className="delete-icon" onClick={() => {
                    const novos = newProject.eap.filter((_, idx) => idx !== i);
                    setNewProject({ ...newProject, eap: novos });
                  }} />
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