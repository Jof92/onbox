// src/pages/ProjectManager.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Loading from "../components/Loading";
import SetoresManager from "../components/SetoresManager";
import ProjectForm from "../components/ProjectForm";
import ContainerGrid from "../components/ContainerGrid";
import EntityDetails from "../components/EntityDetails";
import backImg from "../assets/back.png";
import back1Img from "../assets/back1.png";
import back2Img from "../assets/back2.png";
import back3Img from "../assets/back3.png";
import "./Containers.css";

export default function ProjectManager({ containerAtual, user, onSidebarUpdate }) {
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

  const userId = user?.id;

  // Obter ID do usuário
  useEffect(() => {
    setCurrentUserId(userId);
  }, [userId]);

  // Carregar perfil
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

  // Reset seleção
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
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select(`*, pavimentos(*), eap(*)`)
        .eq("user_id", userId)
        .order("ordem_display", { ascending: true, nullsFirst: false })
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

          const { data: membersData } = await supabase
            .from("project_members")
            .select("user_id")
            .eq("project_id", proj.id);

          let membrosDetalhados = [];
          if (membersData?.length) {
            const userIds = membersData.map(m => m.user_id);
            const { data: perfis } = await supabase
              .from("profiles")
              .select("id, nickname, avatar_url")
              .in("id", userIds);
            membrosDetalhados = perfis || [];
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
      const { data: setoresData } = await supabase
        .from("setores")
        .select("*")
        .eq("user_id", userId)
        .order("ordem_display", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

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
      const { data: membersData } = await supabase
        .from("setor_members")
        .select("user_id")
        .eq("setor_id", setor.id);

      let membrosDetalhados = [];
      if (membersData?.length) {
        const userIds = membersData.map(m => m.user_id);
        const { data: perfis } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", userIds);
        membrosDetalhados = perfis || [];
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
        const { data: profileData } = await supabase
          .from("profiles")
          .select("background, gerente_container_id")
          .eq("id", containerAtual)
          .single();

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
  const hasContainerEditPermissions = currentUserId && (
    currentUserId === containerAtual || 
    currentUserId === gerenteContainerId
  );

  const canEditEntity = (entity) => {
    if (!currentUserId || !entity) return false;
    if (hasContainerEditPermissions) return true;
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
      membrosSelecionados,
      engenheiroResponsavel,
      dataInicio,
      dataFinalizacao
    } = formData;

    if (!name?.trim()) return alert("Digite o nome do projeto!");
    setLoading(true);

    let currentProjectId = isEditing ? selectedProject?.id : null;
    let projectResult;

    try {
      // Dados base do projeto
      const projectData = {
        name,
        type: type || "vertical",
        engenheiro_id: engenheiroResponsavel?.id || null,
        data_inicio: dataInicio || null,
        data_finalizacao: dataFinalizacao || null
      };

      if (isEditing && selectedProject) {
        const { data, error } = await supabase
          .from("projects")
          .update(projectData)
          .eq("id", selectedProject.id)
          .select()
          .single();
        if (error) throw error;
        projectResult = data;
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert([{ ...projectData, user_id: containerAtual }])
          .select()
          .single();
        if (error) throw error;
        projectResult = data;
        currentProjectId = data.id;
      }

      // Upload de foto
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

      // Pavimentos
      await supabase.from("pavimentos").delete().eq("project_id", currentProjectId);
      const pavimentosToInsert = pavimentos
        .filter(Boolean)
        .map((name, index) => ({ name, project_id: currentProjectId, ordem: index }));
      if (pavimentosToInsert.length > 0) {
        await supabase.from("pavimentos").insert(pavimentosToInsert);
      }

      // EAP
      await supabase.from("eap").delete().eq("project_id", currentProjectId);
      const eapToInsert = eap
        .filter(Boolean)
        .map((name, index) => ({ name, project_id: currentProjectId, ordem: index }));
      if (eapToInsert.length > 0) {
        await supabase.from("eap").insert(eapToInsert);
      }

      // Membros
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

        // Notificações
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
    } catch (err) {
      console.error("Erro ao salvar projeto:", err);
      alert("Erro ao salvar projeto.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ MEMORIZADA com useCallback
  const handleDeleteProject = useCallback(async (projectId) => {
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

      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) setSelectedProject(null);
      await fetchProjects(containerAtual);
    } catch (err) {
      alert("Erro ao excluir projeto.");
    } finally {
      setLoading(false);
    }
  }, [containerAtual, selectedProject]);

  const handleEditProject = async (project) => {
    // Carregar membros
    const { data: membros } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", project.id);

    let membrosSelecionados = [];

    if (membros?.length) {
      const userIds = membros.map(m => m.user_id);
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds);
      membrosSelecionados = perfis || [];
    }

    // Carregar dados do engenheiro responsável
    let engenheiroResponsavel = null;
    if (project.engenheiro_id) {
      const { data: engenheiro } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .eq("id", project.engenheiro_id)
        .single();
      engenheiroResponsavel = engenheiro;
    }

    const formData = {
      name: project.name || "",
      type: project.type || "vertical",
      pavimentos: project.pavimentos?.map((p) => p.name) || [],
      eap: project.eap?.map((e) => e.name) || [],
      photoFile: null,
      photoUrl: project.photo_url || null,
      membrosSelecionados,
      engenheiroResponsavel,
      dataInicio: project.data_inicio || "",
      dataFinalizacao: project.data_finalizacao || "",
    };

    setSelectedProject(project);
    setIsEditing(true);
    setInitialFormData(formData);
    setShowForm(true);
  };

  // === Setores ===
  // ✅ MEMORIZADA com useCallback
  const handleOpenSetoresManager = useCallback(() => {
    if (!containerAtual) {
      alert("Usuário não identificado.");
      return;
    }
    setShowSetoresModal(true);
  }, [containerAtual]);

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
      setSetores(prev => prev.filter(s => s.id !== setorId));
      setMenuSetorAberto(null);
      setSelectedSetor(null);
      setSetorDetalhado(null);
    } catch (err) {
      alert("Erro ao excluir.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Salvar ordem dos projetos
  const handleReorderProjects = async (reorderedProjects) => {
    try {
      // Atualiza a ordem no estado local
      setProjects(reorderedProjects);

      // Salva a ordem no banco de dados
      const updates = reorderedProjects.map((proj, index) => ({
        id: proj.id,
        ordem_display: index,
      }));

      for (const update of updates) {
        await supabase
          .from("projects")
          .update({ ordem_display: update.ordem_display })
          .eq("id", update.id);
      }
    } catch (err) {
      console.error("Erro ao salvar ordem dos projetos:", err);
    }
  };

  // ✅ Salvar ordem dos setores
  const handleReorderSetores = async (reorderedSetores) => {
    try {
      // Atualiza a ordem no estado local
      setSetores(reorderedSetores);

      // Salva a ordem no banco de dados
      const updates = reorderedSetores.map((setor, index) => ({
        id: setor.id,
        ordem_display: index,
      }));

      for (const update of updates) {
        await supabase
          .from("setores")
          .update({ ordem_display: update.ordem_display })
          .eq("id", update.id);
      }
    } catch (err) {
      console.error("Erro ao salvar ordem dos setores:", err);
    }
  };

  const openCardsPage = (proj) => {
    const params = new URLSearchParams({
      entityId: proj.id,
      type: 'project',
      containerId: containerAtual
    });
    
    const urlFinal = `/cards/${encodeURIComponent(proj.name || "Projeto")}?${params.toString()}`;
    
    const stateData = {
      projectId: proj.id,
      projectName: proj.name,
      projectPhoto: proj.photo_url,
      from: location.pathname,
      containerId: containerAtual,
    };
    
    navigate(urlFinal, { state: stateData });
  };

  const openSetorCardsPage = (setor) => {
    const params = new URLSearchParams({
      entityId: setor.id,
      type: 'setor',
      containerId: containerAtual
    });
    
    const urlFinal = `/cards/${encodeURIComponent(setor.name || "Setor")}?${params.toString()}`;
    
    const stateData = {
      setorId: setor.id,
      setorName: setor.name,
      setorPhoto: setor.photo_url,
      entityType: "setor",
      from: location.pathname,
      containerId: containerAtual,
    };
    
    navigate(urlFinal, { state: stateData });
  };

  // ✅ Funções de callback memorizadas
  const onCreateProject = useCallback(() => {
    setIsEditing(false);
    setInitialFormData(null);
    setShowForm(true);
  }, []);

  const onProjectSelect = useCallback((proj) => {
    setSelectedProject(proj);
  }, []);

  // ✅ Expor dados para o Sidebar (via callback obrigatório)
  useEffect(() => {
    if (onSidebarUpdate) {
      onSidebarUpdate({
        projects,
        selectedProject,
        onCreateProject,
        onProjectSelect,
        onDeleteProject: handleDeleteProject,
        onOpenSetoresManager: handleOpenSetoresManager,
        currentUserId,
        containerOwnerId: containerAtual,
        gerenteContainerId,
      });
    }
  }, [
    projects,
    selectedProject,
    onCreateProject,
    onProjectSelect,
    handleDeleteProject,
    handleOpenSetoresManager,
    currentUserId,
    containerAtual,
    gerenteContainerId,
    onSidebarUpdate,
  ]);

  // === Renderização ===
  if (loading) return <Loading />;
  if (error) {
    return (
      <div style={{ padding: "20px", color: "red", textAlign: "center" }}>
        <h3>⚠️ Erro</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
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
          canEdit={canEditEntity(setorDetalhado)}
          containerId={containerAtual} 
        />
      ) : selectedProject ? (
        <EntityDetails
          entityType="project"
          entity={selectedProject}
          onBack={() => setSelectedProject(null)}
          onEdit={(updated) => {
            setSelectedProject(updated);
            setProjects(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
          }}
          canEdit={canEditEntity(selectedProject)}
        >
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
          containerId={containerAtual}
          currentUserId={currentUserId}
          onReorderProjects={handleReorderProjects}
          onReorderSetores={handleReorderSetores}
        />
      )}

      <ProjectForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setIsEditing(false);
          setInitialFormData(null);
        }}
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
    </main>
  );
}