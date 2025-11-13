// src/components/ProjectManager.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import Sidebar from "./Sidebar";
import SetoresManager from "./SetoresManager";
import ProjectForm from "./ProjectForm";
import ContainerGrid from "./ContainerGrid";
import EntityDetails from "./EntityDetails";
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
  const [selectedSetor, setSelectedSetor] = useState(null);
  const [setorDetalhado, setSetorDetalhado] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetoresModal, setShowSetoresModal] = useState(false);
  const [menuSetorAberto, setMenuSetorAberto] = useState(null);
  const [background, setBackground] = useState("#f1f1f1ff");
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const [profile, setProfile] = useState(null);
  const [initialFormData, setInitialFormData] = useState(null);
  const [error, setError] = useState(null);
  const [setorEmEdicao, setSetorEmEdicao] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [gerenteContainerId, setGerenteContainerId] = useState(null);

  // 🔹 Obter o ID do usuário logado
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
    };
    fetchCurrentUser();
  }, []);

  // Carregar perfil (nome do container)
  useEffect(() => {
    const loadProfile = async () => {
      if (!containerAtual) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", containerAtual)
        .single();
      if (!error) setProfile(data);
    };
    loadProfile();
  }, [containerAtual]);

  // 🔹 RESETAR SELEÇÃO AO MUDAR DE CONTAINER
  useEffect(() => {
    setSelectedProject(null);
    setSelectedSetor(null);
    setSetorDetalhado(null);
  }, [containerAtual]);

  const handleSetBackground = async (value) => {
    setBackground(value);
    setShowBackgroundMenu(false);
    if (containerAtual) {
      const { error } = await supabase
        .from("profiles")
        .update({ background: value })
        .eq("id", containerAtual);
      if (error) setBackground("#f1f1f1ff");
    }
  };

  const fetchProjects = async (userId) => {
    if (!userId) {
      setProjects([]);
      return;
    }

    try {
      // Incluímos explicitamente gerente_caixa_id
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select(`*, pavimentos(*), eap(*)`)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      const enhancedProjects = [];
      for (const proj of projectsData || []) {
        try {
          const { data: photoData } = await supabase
            .from("projects_photos")
            .select("photo_url")
            .eq("project_id", proj.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const { data: membersData, error: membersError } = await supabase
            .from("project_members")
            .select("user_id")
            .eq("project_id", proj.id);

          let membrosDetalhados = [];
          if (!membersError && membersData?.length) {
            const userIds = membersData.map(m => m.user_id);
            const { data: perfis, error: perfisError } = await supabase
              .from("profiles")
              .select("id, nickname, avatar_url")
              .in("id", userIds);

            if (!perfisError) {
              membrosDetalhados = perfis || [];
            }
          }

          const sortedPavimentos = [...(proj.pavimentos || [])].sort(
            (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
          );
          const sortedEap = [...(proj.eap || [])].sort(
            (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
          );

          enhancedProjects.push({
            ...proj,
            pavimentos: sortedPavimentos,
            eap: sortedEap,
            photo_url: photoData?.photo_url || null,
            membros: membrosDetalhados,
            // gerente_caixa_id já vem do select
          });
        } catch (err) {
          enhancedProjects.push({
            ...proj,
            pavimentos: proj.pavimentos || [],
            eap: proj.eap || [],
            photo_url: null,
            membros: [],
          });
        }
      }

      setProjects(enhancedProjects);
    } catch (err) {
      setError("Erro ao carregar projetos");
      setProjects([]);
    }
  };

  const fetchSetores = async (userId) => {
    if (!userId) {
      setSetores([]);
      return;
    }

    try {
      // Incluímos gerente_caixa_id
      const { data: setoresData, error } = await supabase
        .from("setores")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

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
    } catch (err) {
      setError("Erro ao carregar setores");
      setSetores([]);
    }
  };

  const loadSetorDetails = async (setor) => {
    setLoading(true);
    try {
      const { data: membersData, error: membersError } = await supabase
        .from("setor_members")
        .select("user_id")
        .eq("setor_id", setor.id);

      let membrosDetalhados = [];
      if (!membersError && membersData?.length) {
        const userIds = membersData.map(m => m.user_id);
        const { data: perfis, error: perfisError } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", userIds);

        if (!perfisError) {
          membrosDetalhados = perfis || [];
        }
      }

      setSetorDetalhado({ ...setor, membros: membrosDetalhados });
    } catch (err) {
      console.error("Erro ao carregar membros do setor:", err);
      setSetorDetalhado({ ...setor, membros: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!containerAtual) {
      setLoading(false);
      setError("Usuário não identificado");
      return;
    }

    setLoading(true);
    setError(null);

    const loadAll = async () => {
      try {
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("background, gerente_container_id")
          .eq("id", containerAtual)
          .single();

        if (error) throw error;

        setBackground(profileData?.background || "#f1f1f1ff");
        setGerenteContainerId(profileData?.gerente_container_id);

        await Promise.all([
          fetchProjects(containerAtual),
          fetchSetores(containerAtual)
        ]);
      } catch (err) {
        setError("Falha ao carregar dados do container");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [containerAtual]);

  // === LÓGICA DE PERMISSÃO ===

  // Permissão de container (criar, apagar, gerenciar todos os itens)
  const hasContainerEditPermissions = currentUserId && (
    currentUserId === containerAtual || 
    currentUserId === gerenteContainerId
  );

  // Permissão por entidade (editar um projeto/setor específico)
  const canEditEntity = (entity) => {
    if (!currentUserId || !entity) return false;
    // Dono ou gerente de container sempre pode
    if (hasContainerEditPermissions) return true;
    // Ou é gerente da caixa específica
    return currentUserId === entity.gerente_caixa_id;
  };

  // === Projetos ===

  const handleSaveProject = async (formData) => {
    const {
      name,
      type,
      pavimentos,
      eap,
      photoFile,
      membrosSelecionados
    } = formData;

    if (!name?.trim()) return alert("Digite o nome do projeto!");
    setLoading(true);

    let currentProjectId = isEditing ? selectedProject?.id : null;
    let projectResult;

    try {
      if (isEditing && selectedProject) {
        const { data, error } = await supabase
          .from("projects")
          .update({ name, type })
          .eq("id", selectedProject.id)
          .select()
          .single();
        if (error) throw error;
        projectResult = data;
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert([{ name, type, user_id: containerAtual }])
          .select()
          .single();
        if (error) throw error;
        projectResult = data;
        currentProjectId = data.id;
      }

      if (photoFile) {
        const fileName = `${Date.now()}_${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("projects_photos")
          .upload(fileName, photoFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("projects_photos").getPublicUrl(fileName);
        await supabase.from("projects_photos").insert([
          { project_id: currentProjectId, photo_url: urlData.publicUrl },
        ]);
      }

      await supabase.from("pavimentos").delete().eq("project_id", currentProjectId);
      const pavimentosToInsert = pavimentos
        .filter(Boolean)
        .map((name, index) => ({ name, project_id: currentProjectId, ordem: index }));
      if (pavimentosToInsert.length > 0) {
        await supabase.from("pavimentos").insert(pavimentosToInsert);
      }

      await supabase.from("eap").delete().eq("project_id", currentProjectId);
      const eapToInsert = eap
        .filter(Boolean)
        .map((name, index) => ({ name, project_id: currentProjectId, ordem: index }));
      if (eapToInsert.length > 0) {
        await supabase.from("eap").insert(eapToInsert);
      }

      if (membrosSelecionados?.length > 0) {
        if (isEditing) {
          await supabase.from("project_members").delete().eq("project_id", currentProjectId);
        }
        const membrosParaInserir = membrosSelecionados.map(m => ({
          project_id: currentProjectId,
          user_id: m.id,
          added_by: containerAtual
        }));
        const { error: membrosError } = await supabase.from("project_members").insert(membrosParaInserir);
        if (membrosError) throw membrosError;

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

      setShowForm(false);
      setIsEditing(false);
      setSelectedProject(null);
      await fetchProjects(containerAtual);
      onProjectSelect?.(projectResult);
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
      await supabase.from("project_members").delete().eq("project_id", projectId);
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
    const { data: membros, error: membrosError } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", project.id);

    let membrosSelecionados = [];
    let membrosTexto = "";

    if (!membrosError && membros?.length) {
      const userIds = membros.map(m => m.user_id);
      const { data: perfis, error: perfisError } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds);

      if (!perfisError) {
        membrosSelecionados = perfis || [];
        membrosTexto = perfis?.map(p => `@${p.nickname}`).join(" ") || "";
      }
    }

    const formData = {
      name: project.name || "",
      type: project.type || "vertical",
      pavimentos: project.pavimentos?.map((p) => p.name) || [],
      eap: project.eap?.map((e) => e.name) || [],
      photoFile: null,
      photoUrl: project.photo_url || null,
      membrosTexto,
      membrosSelecionados,
    };

    setSelectedProject(project);
    setIsEditing(true);
    setInitialFormData(formData);
    setShowForm(true);
  };

  // === Navegação ===

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

  // === Setores ===

  const handleOpenSetoresManager = () => {
    if (!containerAtual) {
      alert("Usuário não identificado.");
      return;
    }
    setShowSetoresModal(true);
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

      await supabase.from("setor_members").delete().eq("setor_id", setorId);
      await supabase.from("setores").delete().eq("id", setorId);
      setSetores((prev) => prev.filter((s) => s.id !== setorId));
      setMenuSetorAberto(null);
      setSelectedSetor(null);
      setSetorDetalhado(null);
      alert("Setor excluído!");
    } catch (err) {
      alert("Erro ao excluir.");
    } finally {
      setLoading(false);
    }
  };

  // === Renderização ===

  if (loading) {
  return <Loading />;
}

  if (error) {
    return (
      <div style={{ padding: "20px", color: "red", textAlign: "center" }}>
        <h3>⚠️ Erro</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <Sidebar
        projects={projects}
        selectedProject={selectedProject}
        onCreateProject={() => {
          setIsEditing(false);
          setInitialFormData(null);
          setShowForm(true);
        }}
        onProjectSelect={(proj) => {
          setSelectedProject(proj);
          onProjectSelect?.(proj);
        }}
        onDeleteProject={handleDeleteProject}
        onOpenSetoresManager={handleOpenSetoresManager}
        currentUserId={currentUserId}
        containerOwnerId={containerAtual}
        gerenteContainerId={gerenteContainerId}
      />

      <main
        className="containers-main"
        style={{
          background: background.startsWith("#")
            ? background
            : `url(${background}) center/300px auto repeat`,
        }}
      >
        <div
          className="dot-btn"
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

        {selectedSetor && setorDetalhado ? (
          <EntityDetails
            entityType="setor"
            entity={setorDetalhado}
            onBack={() => setSelectedSetor(null)}
            onEdit={() => {
              setSetorEmEdicao(setorDetalhado.id);
              setShowSetoresModal(true);
            }}
            canEdit={canEditEntity(setorDetalhado)} // ✅ Permissão por caixa
          />
        ) : selectedProject ? (
          <EntityDetails
            entityType="project"
            entity={selectedProject}
            onBack={() => setSelectedProject(null)}
            onEdit={() => handleEditProject(selectedProject)}
            canEdit={canEditEntity(selectedProject)} // ✅ Permissão por caixa
          >
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
          </EntityDetails>
        ) : (
          <ContainerGrid
            projects={projects}
            setores={setores}
            onProjectClick={openCardsPage}
            onSetorClick={openSetorCardsPage}
            onSetorAction={(action, setor) => {
              if (action === "verPerfil") {
                setSelectedSetor(setor);
                loadSetorDetails(setor);
              } else if (action === "delete") {
                handleDeleteSetor(setor.id);
              }
            }}
            menuSetorAberto={menuSetorAberto}
            setMenuSetorAberto={setMenuSetorAberto}
          />
        )}
      </main>

      <ProjectForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSaveProject}
        initialData={initialFormData}
        containerAtual={containerAtual}
        profile={profile}
        isEditing={isEditing}
      />

      {showSetoresModal && containerAtual && (
        <SetoresManager
          userId={containerAtual}
          setorId={setorEmEdicao}
          onClose={() => {
            setShowSetoresModal(false);
            setSetorEmEdicao(null);
            fetchSetores(containerAtual);
            if (setorEmEdicao) {
              const setorAtualizado = setores.find(s => s.id === setorEmEdicao);
              if (setorAtualizado) {
                loadSetorDetails(setorAtualizado);
              }
            }
          }}
        />
      )}
    </>
  );
}