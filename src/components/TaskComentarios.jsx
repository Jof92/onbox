// src/components/TaskComentarios.jsx
import React, { useState, useEffect, useRef } from "react";
import { FiUser, FiCalendar } from "react-icons/fi";
import { IoReturnUpBack } from "react-icons/io5";
import { formatText } from "../utils/formatText";
import TaskReactions from "./TaskReactions";
import "./Task.css";

const MencoesTooltip = ({ children, userId, projetoAtual, containerId, supabaseClient }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);
  const [loadingTooltip, setLoadingTooltip] = useState(false);

  useEffect(() => {
    if (!showTooltip || tooltipData || loadingTooltip || !userId) return;

    const fetchTooltipData = async () => {
      setLoadingTooltip(true);
      try {
        const { data: profile, error: profileError } = await supabaseClient
          .from("profiles")
          .select("nome, nickname, funcao, container, avatar_url")
          .eq("id", userId)
          .single();

        if (profileError || !profile) {
          setTooltipData({ error: true });
          return;
        }

        let pertenceA = "Não pertence a nenhuma entidade";

        const { data: projectMembers } = await supabaseClient
          .from("project_members")
          .select("project_id")
          .eq("user_id", userId);

        if (Array.isArray(projectMembers) && projectMembers.length > 0) {
          const projectIds = projectMembers.map(pm => pm.project_id);
          const { data: projectNames } = await supabaseClient
            .from("projects")
            .select("name")
            .in("id", projectIds)
            .limit(1);
          if (projectNames?.[0]?.name) {
            pertenceA = `Membro do Projeto "${projectNames[0].name}"`;
          }
        } else {
          const { data: setorMembers } = await supabaseClient
            .from("setor_members")
            .select("setor_id")
            .eq("user_id", userId);
          if (Array.isArray(setorMembers) && setorMembers.length > 0) {
            const setorIds = setorMembers.map(sm => sm.setor_id);
            const { data: setorNames } = await supabaseClient
              .from("setores")
              .select("name")
              .in("id", setorIds)
              .limit(1);
            if (setorNames?.[0]?.name) {
              pertenceA = `Membro do Setor "${setorNames[0].name}"`;
            }
          }
        }

        setTooltipData({
          nome: profile.nickname || profile.nome || "Usuário",
          funcao: profile.funcao || "Função não informada",
          container_id: profile.container || "—",
          pertenceA,
          avatar_url: profile.avatar_url,
        });
      } catch (err) {
        console.error("Erro ao carregar tooltip de menção:", err);
        setTooltipData({ error: true });
      } finally {
        setLoadingTooltip(false);
      }
    };

    fetchTooltipData();
  }, [showTooltip, userId, tooltipData, loadingTooltip, supabaseClient]);

  if (!userId) {
    return (
      <span style={{ color: "#1E88E5", textDecoration: "underline", fontWeight: "bold", cursor: "default" }}>
        {children}
      </span>
    );
  }

  return (
    <span
      style={{
        position: "relative",
        color: "#1E88E5",
        textDecoration: "underline",
        cursor: "pointer",
        fontWeight: "bold",
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div
          className="mencoes-tooltip"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "8px",
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "6px",
            padding: "10px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            zIndex: 1000,
            width: "220px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: "14px",
          }}
        >
          {loadingTooltip ? (
            <span>Carregando...</span>
          ) : tooltipData?.error ? (
            <span>Usuário não encontrado</span>
          ) : tooltipData ? (
            <>
              {tooltipData.avatar_url ? (
                <img
                  src={tooltipData.avatar_url}
                  alt={tooltipData.nome}
                  style={{ width: "40px", height: "40px", borderRadius: "50%", marginBottom: "6px" }}
                />
              ) : (
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#e0e0e0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "6px",
                    fontWeight: "bold",
                    color: "#555",
                  }}
                >
                  {(tooltipData.nome || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <strong>{tooltipData.nome}</strong>
              <div>{tooltipData.funcao}</div>
              <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                Container ID: {tooltipData.container_id}
              </div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "4px", textAlign: "center" }}>
                {tooltipData.pertenceA}
              </div>
            </>
          ) : null}
        </div>
      )}
    </span>
  );
};

const renderTextoFormatadoComMencoes = (
  conteudo,
  perfilesPorId,
  projetoAtual,
  containerId,
  supabaseClient
) => {
  if (!conteudo) return conteudo;
  const regex = /(@[\p{L}\p{N}_-]+)/gu;
  const partes = conteudo.split(regex).filter(Boolean);
  const elementos = partes.map((parte, index) => {
    if (parte.startsWith("@")) {
      const nickname = parte.slice(1);
      const usuario = Object.values(perfilesPorId).find(
        (p) => p && p.id && (p.nickname === nickname || p.nome === nickname)
      );
      if (usuario && usuario.id) {
        return (
          <MencoesTooltip
            key={index}
            userId={usuario.id}
            projetoAtual={projetoAtual}
            containerId={containerId}
            supabaseClient={supabaseClient}
          >
            {parte}
          </MencoesTooltip>
        );
      } else {
        return (
          <span key={index} style={{ color: "#1E88E5", textDecoration: "underline" }}>
            {parte}
          </span>
        );
      }
    } else {
      return formatText(parte);
    }
  });
  return <>{elementos}</>;
};

const mencionaUsuario = (conteudo, userProfile) => {
  if (!userProfile || !conteudo) return false;
  const termos = [userProfile.nickname, userProfile.nome].filter(Boolean);
  const regex = /@([\p{L}\p{N}_-]+)/gu;
  const mencoes = [...conteudo.matchAll(regex)].map(m => m[1]);
  return mencoes.some(m => termos.includes(m));
};

const notificarParticipantesDoContainer = async ({
  conteudo,
  notaId,
  autorId,
  autorProfile,
  projetoAtual,
  containerIdDaNota,
  supabaseClient,
}) => {
  if (!containerIdDaNota) return;
  const { data: convites, error: convitesError } = await supabaseClient
    .from("convites")
    .select("user_id")
    .eq("container_id", containerIdDaNota)
    .eq("status", "aceito");

  if (convitesError || !convites?.length) return;

  const participantes = convites.map(c => c.user_id).filter(id => id !== autorId);
  if (participantes.length === 0) return;

  const mencionadosSet = new Set();
  const mencoes = conteudo.match(/@(\S+)/g);
  if (mencoes?.length > 0) {
    const nomesMencionados = mencoes.map(m => m.slice(1));
    const { data: candidatos } = await supabaseClient
      .from("profiles")
      .select("id")
      .or(
        `nickname.in.(${nomesMencionados.map(n => `"${n}"`).join(",")}),nome.in.(${nomesMencionados.map(n => `"${n}"`).join(",")})`
      );
    (candidatos || []).forEach(p => mencionadosSet.add(p.id));
  }

  const destinatarios = participantes.filter(id => !mencionadosSet.has(id));
  if (destinatarios.length === 0) return;

  const mensagem = `${autorProfile?.nickname || autorProfile?.nome || "Alguém"} fez um comentário na tarefa que você está adicionado.`;
  const notificacoes = destinatarios.map(destId => ({
    user_id: destId,
    remetente_id: autorId,
    nota_id: notaId,
    projeto_id: projetoAtual?.id || null,
    tipo: "comentario_na_tarefa",
    mensagem,
    lido: false,
  }));
  await supabaseClient.from("notificacoes").insert(notificacoes);
};

const carregarReacoesPorComentario = async (comentarioId, supabaseClient) => {
  const { data, error } = await supabaseClient
    .from("reacoes")
    .select("user_id, emoji")
    .eq("comentario_id", comentarioId);
  if (error) {
    console.error("Erro ao carregar reações:", error);
    return [];
  }
  return data;
};

const toggleReacao = async ({ comentarioId, userId, emoji, supabaseClient }) => {
  const { data: reacoesExistentes, error: checkError } = await supabaseClient
    .from("reacoes")
    .select("id")
    .eq("comentario_id", comentarioId)
    .eq("user_id", userId)
    .eq("emoji", emoji);

  if (checkError) {
    console.error("Erro ao verificar reação existente:", checkError);
    return "erro";
  }

  if (reacoesExistentes?.length > 0) {
    const { error } = await supabaseClient
      .from("reacoes")
      .delete()
      .eq("comentario_id", comentarioId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) {
      console.error("Erro ao remover reação:", error);
      return "erro";
    }
    return "removida";
  } else {
    const { error } = await supabaseClient
      .from("reacoes")
      .insert({ comentario_id: comentarioId, user_id: userId, emoji });
    if (error) {
      console.error("Erro ao adicionar reação:", error);
      return "erro";
    }
    return "adicionada";
  }
};

const TaskComentarios = ({ notaId, userId, userProfile, projetoAtual, containerId, supabaseClient }) => {
  const [comentario, setComentario] = useState("");
  const [comentarios, setComentarios] = useState([]);
  const [sugestoesMencoes, setSugestoesMencoes] = useState([]);
  const [comentando, setComentando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingExcluir, setLoadingExcluir] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [respondendoA, setRespondendoA] = useState(null);
  const textareaRef = useRef(null);
  const respostaTextareaRef = useRef(null);
  const [containerIdDaNota, setContainerIdDaNota] = useState(containerId);

  useEffect(() => {
    if (!notaId) return;
    const fetchNotaContainer = async () => {
      const { data, error } = await supabaseClient
        .from("notas")
        .select("container_id")
        .eq("id", notaId)
        .single();
      if (!error && data?.container_id) {
        setContainerIdDaNota(data.container_id);
      }
    };
    fetchNotaContainer();
  }, [notaId, supabaseClient]);

  const formatarDataComentario = (dateString) => {
    const date = new Date(dateString);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const isSameDay = (d1, d2) =>
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
    const hora = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (isSameDay(date, hoje)) return `Hoje às ${hora}`;
    if (isSameDay(date, ontem)) return `Ontem às ${hora}`;
    return `em ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} às ${hora}`;
  };

  const podeEditarComentario = (createdAt, autorId) => {
    if (autorId !== userId) return false;
    const agora = new Date();
    const criadoEm = new Date(createdAt);
    const diffMin = (agora - criadoEm) / (1000 * 60);
    return diffMin < 60;
  };

  useEffect(() => {
    let isMounted = true;
    const fetchComentarios = async () => {
      setLoading(true);
      try {
        const { data: comentariosData } = await supabaseClient
          .from("comentarios")
          .select("id, conteudo, created_at, user_id, agendado_por, respondendo_a")
          .eq("nota_id", notaId)
          .order("created_at", { ascending: false });

        if (comentariosData?.length > 0) {
          const userIds = [...new Set(comentariosData.map((c) => c.user_id))];
          const { data: profiles } = await supabaseClient
            .from("profiles")
            .select("id, nome, nickname, avatar_url")
            .in("id", userIds);
          const profileMap = {};
          profiles?.forEach((p) => (profileMap[p.id] = p));

          const comentariosComUsuario = await Promise.all(
            comentariosData.map(async (c) => {
              // Carregar reações com detalhes dos usuários
              const reacoesRaw = await carregarReacoesPorComentario(c.id, supabaseClient);
              const reacoes = {};
              reacoesRaw.forEach((r) => {
                reacoes[r.emoji] = (reacoes[r.emoji] || 0) + 1;
              });

              // Buscar perfis dos usuários que reagiram
              const userIdsReacoes = [...new Set(reacoesRaw.map(r => r.user_id))];
              const { data: profilesReacoes } = await supabaseClient
                .from("profiles")
                .select("id, nome, nickname, avatar_url")
                .in("id", userIdsReacoes);

              const profileMapReacoes = {};
              profilesReacoes?.forEach(p => {
                profileMapReacoes[p.id] = p;
              });

              const reacoesDetalhadas = reacoesRaw.map(r => ({
                user_id: r.user_id,
                emoji: r.emoji,
                user_name: (profileMapReacoes[r.user_id]?.nickname || profileMapReacoes[r.user_id]?.nome || "Usuário"),
                avatar_url: profileMapReacoes[r.user_id]?.avatar_url || null,
              }));

              return {
                ...c,
                profiles: profileMap[c.user_id] || { nome: "Usuário", nickname: null, avatar_url: null },
                formattedDate: formatarDataComentario(c.created_at),
                isEditing: false,
                editValue: undefined,
                mencionaUsuarioLogado: mencionaUsuario(c.conteudo, userProfile),
                estaAgendadoPeloUsuario: c.agendado_por === userId,
                ehResposta: !!c.respondendo_a,
                reacoes,
                reacoesDetalhadas, // ← nova prop essencial
              };
            })
          );

          if (isMounted) setComentarios(comentariosComUsuario);
        } else if (isMounted) {
          setComentarios([]);
        }
      } catch (err) {
        console.error("Erro ao carregar comentários:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchComentarios();
    return () => { isMounted = false; };
  }, [notaId, userId, userProfile, supabaseClient]);

  const handleComentarioChange = (e) => {
    const valor = e.target.value;
    setComentario(valor);
    const cursor = e.target.selectionStart;
    const textoAteCursor = valor.slice(0, cursor);
    const match = textoAteCursor.match(/@([\p{L}\p{N}_-]*)$/u);
    if (match?.[1] && containerIdDaNota) {
      const termo = match[1];
      if (termo.length >= 1) {
        supabaseClient
          .from("convites")
          .select("user_id")
          .eq("container_id", containerIdDaNota)
          .eq("status", "aceito")
          .then(({ data: convitesAceitos, error }) => {
            if (error) {
              console.error("Erro ao buscar convites:", error);
              setSugestoesMencoes([]);
              return;
            }
            const userIdsDoContainer = convitesAceitos.map(c => c.user_id);
            if (userIdsDoContainer.length === 0) {
              setSugestoesMencoes([]);
              return;
            }
            supabaseClient
              .from("profiles")
              .select("id, nome, nickname, avatar_url")
              .in("id", userIdsDoContainer)
              .ilike("nickname", `%${termo}%`)
              .or(`nome.ilike.%${termo}%`)
              .limit(5)
              .then(({ data }) => {
                setSugestoesMencoes(data || []);
              });
          });
      } else {
        setSugestoesMencoes([]);
      }
    } else {
      setSugestoesMencoes([]);
    }
  };

  const inserirMencoes = (usuario) => {
    const textarea = respondendoA ? respostaTextareaRef.current : textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const valorAtual = respondendoA
      ? comentarios.find(c => c.id === respondendoA)?.respostaTemp || ""
      : comentario;
    const textoAntes = valorAtual.slice(0, cursorPos);
    const textoDepois = valorAtual.slice(cursorPos);
    const nomeParaMencoes = usuario.nickname || usuario.nome;
    const novoTextoAntes = textoAntes.replace(/@[\p{L}\p{N}_-]*$/u, `@${nomeParaMencoes}`);
    const novoTexto = novoTextoAntes + " " + textoDepois;

    if (respondendoA) {
      setComentarios(prev =>
        prev.map(c => (c.id === respondendoA ? { ...c, respostaTemp: novoTexto } : c))
      );
    } else {
      setComentario(novoTexto);
    }
    setSugestoesMencoes([]);
    setTimeout(() => {
      const novaPos = novoTextoAntes.length + 1;
      textarea.focus();
      textarea.setSelectionRange(novaPos, novaPos);
    }, 0);
  };

  const iniciarResposta = (comentarioId) => {
    setComentarios(prev =>
      prev.map(c =>
        c.id === comentarioId
          ? { ...c, respostaTemp: "", respostaAtiva: true }
          : { ...c, respostaAtiva: false }
      )
    );
    setRespondendoA(comentarioId);
  };

  const enviarResposta = async (comentarioPaiId) => {
    const comentarioPai = comentarios.find(c => c.id === comentarioPaiId);
    if (!comentarioPai || !comentarioPai.respostaTemp?.trim()) return;
    setComentando(true);
    try {
      const { data: novoComentario, error: insertError } = await supabaseClient
        .from("comentarios")
        .insert({
          nota_id: notaId,
          user_id: userId,
          conteudo: comentarioPai.respostaTemp.trim(),
          respondendo_a: comentarioPaiId,
        })
        .select('id, nota_id, user_id, conteudo, created_at, agendado_por, respondendo_a')
        .single();

      if (insertError) throw insertError;

      const { id, created_at } = novoComentario;
      const novoComentarioLocal = {
        id,
        nota_id: notaId,
        user_id: userId,
        conteudo: novoComentario.conteudo,
        created_at,
        agendado_por: null,
        respondendo_a: comentarioPaiId,
        profiles: userProfile || { nome: "Você", nickname: null, avatar_url: null },
        formattedDate: formatarDataComentario(created_at),
        isEditing: false,
        editValue: undefined,
        mencionaUsuarioLogado: mencionaUsuario(novoComentario.conteudo, userProfile),
        estaAgendadoPeloUsuario: false,
        ehResposta: true,
        reacoes: {},
        reacoesDetalhadas: [],
      };

      setComentarios(prev => [novoComentarioLocal, ...prev]);

      const mencionados = novoComentario.conteudo.match(/@(\S+)/g);
      if (mencionados?.length > 0) {
        const nomesMencionados = mencionados.map(m => m.slice(1));
        const { data: candidatos } = await supabaseClient
          .from("profiles")
          .select("id, nickname, nome")
          .or(
            `nickname.in.(${nomesMencionados.map(n => `"${n}"`).join(",")}),nome.in.(${nomesMencionados.map(n => `"${n}"`).join(",")})`
          );
        const mencionadosValidos = (candidatos || []).filter(p =>
          nomesMencionados.includes(p.nickname || p.nome)
        );
        for (const u of mencionadosValidos) {
          await supabaseClient.from("notificacoes").insert({
            user_id: u.id,
            remetente_id: userId,
            nota_id: notaId,
            projeto_id: projetoAtual?.id || null,
            tipo: "menção",
            mensagem: `${userProfile?.nickname || userProfile?.nome || "Você"} marcou você em um comentário na tarefa ${projetoAtual?.nome || projetoAtual?.name || "Sem projeto"}`,
            lido: false,
          });
        }
      }

      await notificarParticipantesDoContainer({
        conteudo: novoComentario.conteudo,
        notaId,
        autorId: userId,
        autorProfile: userProfile,
        projetoAtual,
        containerIdDaNota,
        supabaseClient,
      });

      setComentarios(prev =>
        prev.map(c => c.id === comentarioPaiId ? { ...c, respostaAtiva: false, respostaTemp: undefined } : c)
      );
      setRespondendoA(null);
    } catch (err) {
      console.error("Erro ao enviar resposta:", err);
      alert("Erro ao enviar resposta.");
    } finally {
      setComentando(false);
    }
  };

  const cancelarResposta = (comentarioId) => {
    setComentarios(prev =>
      prev.map(c => c.id === comentarioId ? { ...c, respostaAtiva: false, respostaTemp: undefined } : c)
    );
    setRespondendoA(null);
  };

  const handleAddComentario = async () => {
    if (!comentario.trim()) return;
    setComentando(true);
    try {
      const { data: novoComentario, error: insertError } = await supabaseClient
        .from("comentarios")
        .insert({
          nota_id: notaId,
          user_id: userId,
          conteudo: comentario.trim(),
          respondendo_a: null,
        })
        .select('id, nota_id, user_id, conteudo, created_at, agendado_por, respondendo_a')
        .single();

      if (insertError) throw insertError;

      const { id, created_at } = novoComentario;
      const novoComentarioLocal = {
        id,
        nota_id: notaId,
        user_id: userId,
        conteudo: novoComentario.conteudo,
        created_at,
        agendado_por: null,
        respondendo_a: null,
        profiles: userProfile || { nome: "Você", nickname: null, avatar_url: null },
        formattedDate: formatarDataComentario(created_at),
        isEditing: false,
        editValue: undefined,
        mencionaUsuarioLogado: mencionaUsuario(novoComentario.conteudo, userProfile),
        estaAgendadoPeloUsuario: false,
        ehResposta: false,
        reacoes: {},
        reacoesDetalhadas: [],
      };

      setComentarios(prev => [novoComentarioLocal, ...prev]);
      setComentario("");
      setSugestoesMencoes([]);

      const mencionados = novoComentario.conteudo.match(/@(\S+)/g);
      if (mencionados?.length > 0) {
        const nomesMencionados = mencionados.map(m => m.slice(1));
        const { data: candidatos } = await supabaseClient
          .from("profiles")
          .select("id, nickname, nome")
          .or(
            `nickname.in.(${nomesMencionados.map(n => `"${n}"`).join(",")}),nome.in.(${nomesMencionados.map(n => `"${n}"`).join(",")})`
          );
        const mencionadosValidos = (candidatos || []).filter(p =>
          nomesMencionados.includes(p.nickname || p.nome)
        );
        for (const u of mencionadosValidos) {
          await supabaseClient.from("notificacoes").insert({
            user_id: u.id,
            remetente_id: userId,
            nota_id: notaId,
            projeto_id: projetoAtual?.id || null,
            tipo: "menção",
            mensagem: `${userProfile?.nickname || userProfile?.nome || "Você"} marcou você em um comentário na tarefa ${projetoAtual?.nome || projetoAtual?.name || "Sem projeto"}`,
            lido: false,
          });
        }
      }

      await notificarParticipantesDoContainer({
        conteudo: novoComentario.conteudo,
        notaId,
        autorId: userId,
        autorProfile: userProfile,
        projetoAtual,
        containerIdDaNota,
        supabaseClient,
      });
    } catch (err) {
      console.error("Erro ao salvar comentário:", err);
      alert("Erro ao salvar comentário.");
    } finally {
      setComentando(false);
    }
  };

  const handleEnviarParaAgenda = async (comentarioId) => {
    if (!comentarioId || typeof comentarioId !== 'string') return;
    const { data, error } = await supabaseClient
      .from("comentarios")
      .update({ agendado_por: userId })
      .eq("id", comentarioId)
      .select("agendado_por");
    if (error) {
      alert("Erro ao adicionar à agenda: " + (error.message || "tente novamente"));
    } else if (data?.[0]?.agendado_por === userId) {
      setComentarios(prev =>
        prev.map(c => c.id === comentarioId ? { ...c, estaAgendadoPeloUsuario: true } : c)
      );
      alert("Adicionado à agenda!");
    } else {
      alert("Não foi possível adicionar à agenda.");
    }
  };

  const handleSaveEdit = async (comentarioId) => {
    const alvo = comentarios.find((c) => c.id === comentarioId);
    const novoConteudo = (alvo?.editValue !== undefined ? alvo.editValue : alvo?.conteudo) || "";
    if (!novoConteudo.trim()) return;
    setLoading(true);
    try {
      await supabaseClient
        .from("comentarios")
        .update({ conteudo: novoConteudo.trim() })
        .eq("id", comentarioId)
        .eq("user_id", userId);
      setComentarios(prev =>
        prev.map(c =>
          c.id === comentarioId
            ? {
                ...c,
                conteudo: novoConteudo.trim(),
                isEditing: false,
                editValue: undefined,
                mencionaUsuarioLogado: mencionaUsuario(novoConteudo.trim(), userProfile),
                reacoes: c.reacoes,
                reacoesDetalhadas: c.reacoesDetalhadas,
              }
            : c
        )
      );
    } catch (err) {
      console.error("Erro ao editar comentário:", err);
      alert("Erro ao editar comentário.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (comentarioId) => {
    setComentarios(prev =>
      prev.map(c => (c.id === comentarioId ? { ...c, isEditing: true, editValue: c.conteudo } : c))
    );
    setMenuAberto(null);
  };

  const handleCancelEdit = (comentarioId) => {
    setComentarios(prev =>
      prev.map(c => (c.id === comentarioId ? { ...c, isEditing: false, editValue: undefined } : c))
    );
    setMenuAberto(null);
  };

  const handleExcluirComentario = async (comentarioId) => {
    setLoadingExcluir(true);
    try {
      await supabaseClient
        .from("comentarios")
        .delete()
        .eq("id", comentarioId)
        .eq("user_id", userId);
      setComentarios(prev => prev.filter(c => c.id !== comentarioId));
      setMenuAberto(null);
    } catch (err) {
      console.error("Erro ao excluir comentário:", err);
      alert("Erro ao excluir comentário.");
    } finally {
      setLoadingExcluir(false);
    }
  };

  const handleReacaoClick = async (comentarioId, emoji) => {
    const resultado = await toggleReacao({ comentarioId, userId, emoji, supabaseClient });
    if (resultado === "erro") {
      alert("Erro ao processar reação.");
      return;
    }
    setComentarios(prev =>
      prev.map(c => {
        if (c.id !== comentarioId) return c;
        const novasReacoes = { ...c.reacoes };
        if (resultado === "adicionada") {
          novasReacoes[emoji] = (novasReacoes[emoji] || 0) + 1;
        } else if (resultado === "removida") {
          if (novasReacoes[emoji] <= 1) {
            delete novasReacoes[emoji];
          } else {
            novasReacoes[emoji] -= 1;
          }
        }
        return { ...c, reacoes: novasReacoes };
      })
    );
  };

  const agruparComentarios = () => {
    const todos = [...comentarios];
    const principais = todos.filter(c => !c.ehResposta);
    const respostas = todos.filter(c => c.ehResposta);
    const mapaRespostas = {};
    respostas.forEach(r => {
      if (!mapaRespostas[r.respondendo_a]) {
        mapaRespostas[r.respondendo_a] = [];
      }
      mapaRespostas[r.respondendo_a].push(r);
    });
    Object.keys(mapaRespostas).forEach(paiId => {
      mapaRespostas[paiId].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });
    const resultado = [];
    principais.forEach(pai => {
      resultado.push({ ...pai, respostasFilhas: mapaRespostas[pai.id] || [] });
    });
    return resultado;
  };

  const perfilesPorId = {};
  comentarios.forEach(c => {
    if (c.profiles?.id) perfilesPorId[c.profiles.id] = c.profiles;
  });
  const comentariosAgrupados = agruparComentarios();

  return (
    <div className="comentarios-section">
      <h3>Comentários e atividades</h3>
      <div style={{ position: "relative" }}>
        <textarea
          ref={textareaRef}
          placeholder="Escrever um comentário... (use @ para mencionar, *bold* ou _itálico_)"
          value={comentario}
          onChange={handleComentarioChange}
          rows={3}
          disabled={loading || respondendoA}
        />
        {sugestoesMencoes.length > 0 && (
          <div
            className="sugestoes-list"
            style={{
              position: "absolute",
              zIndex: 10,
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
              marginTop: "4px",
              width: "250px",
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            {sugestoesMencoes.map((u) => {
              const nomeExibicao = u.nickname || u.nome;
              return (
                <div
                  key={u.id}
                  onClick={() => inserirMencoes(u)}
                  style={{
                    padding: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt={nomeExibicao}
                      style={{ width: "24px", height: "24px", borderRadius: "50%" }}
                    />
                  ) : (
                    <FiUser style={{ width: "24px", height: "24px" }} />
                  )}
                  <span>{nomeExibicao}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
        <button
          type="button"
          className="coment-btn"
          onClick={handleAddComentario}
          disabled={loading || comentando || !comentario.trim() || respondendoA}
        >
          Comentar
        </button>
        {(comentando || loadingExcluir) && <span className="loader"></span>}
      </div>
      <div className="comentarios-lista">
        {comentariosAgrupados.map((pai) => {
          const profile = pai.profiles || { nome: "Usuário", nickname: null, avatar_url: null };
          const nomeExibicao = profile.nickname || profile.nome;
          const editavel = podeEditarComentario(pai.created_at, pai.user_id);
          const podeEnviarParaAgenda = pai.mencionaUsuarioLogado && !pai.estaAgendadoPeloUsuario;

          return (
            <React.Fragment key={pai.id}>
              <div className="comentario-item">
                <div className="comentario-avatar">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={nomeExibicao}
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "block";
                      }}
                    />
                  ) : (
                    <FiUser className="avatar-placeholder" />
                  )}
                </div>
                <div className="comentario-conteudo">
                  <div className="comentario-header">
                    <div className="comentario-autor">
                      <strong>{nomeExibicao}</strong>
                    </div>
                    <div className="comentario-meta" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        type="button"
                        title={`Responder a ${nomeExibicao}`}
                        onClick={() => iniciarResposta(pai.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#666",
                          fontSize: "16px",
                          display: "flex",
                          alignItems: "center",
                        }}
                        aria-label={`Responder a ${nomeExibicao}`}
                      >
                        <IoReturnUpBack />
                      </button>
                      <span>{pai.formattedDate}</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <TaskReactions
                          comentarioId={pai.id}
                          userId={userId}
                          reacoes={pai.reacoes}
                          reacoesDetalhadas={pai.reacoesDetalhadas}
                          onToggleReacao={handleReacaoClick}
                          disabled={loading || comentando}
                        />
                        {podeEnviarParaAgenda && (
                          <button
                            type="button"
                            title="Adicionar à minha agenda"
                            onClick={() => handleEnviarParaAgenda(pai.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#1E88E5", fontSize: "16px" }}
                            aria-label="Adicionar à agenda"
                          >
                            <FiCalendar />
                          </button>
                        )}
                        {editavel && !pai.isEditing && (
                          <button
                            type="button"
                            className="comentario-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuAberto(menuAberto === pai.id ? null : pai.id);
                            }}
                            aria-label="Opções"
                          >
                            ⋮
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {pai.isEditing ? (
                    <div>
                      <textarea
                        value={pai.editValue !== undefined ? pai.editValue : pai.conteudo}
                        onChange={(e) =>
                          setComentarios(prev =>
                            prev.map(x => (x.id === pai.id ? { ...x, editValue: e.target.value } : x))
                          )
                        }
                        rows={3}
                        style={{ width: "100%", resize: "none", marginTop: "4px" }}
                      />
                      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                        <button type="button" onClick={() => handleSaveEdit(pai.id)} disabled={loading}>
                          Salvar
                        </button>
                        <button type="button" onClick={() => handleCancelEdit(pai.id)} disabled={loading}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="comentario-texto">
                      {renderTextoFormatadoComMencoes(pai.conteudo, perfilesPorId, projetoAtual, containerIdDaNota, supabaseClient)}
                    </div>
                  )}
                  {menuAberto === pai.id && editavel && !pai.isEditing && (
                    <div className="comentario-menu">
                      <button type="button" onClick={() => handleStartEdit(pai.id)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => handleExcluirComentario(pai.id)}>
                        Excluir
                      </button>
                    </div>
                  )}
                  {pai.respostaAtiva && (
                    <div style={{ marginTop: "12px", marginLeft: "40px", width: "calc(100% - 40px)" }}>
                      <textarea
                        ref={respostaTextareaRef}
                        placeholder="Escreva sua resposta..."
                        value={pai.respostaTemp || ""}
                        onChange={(e) =>
                          setComentarios(prev =>
                            prev.map(x =>
                              x.id === pai.id ? { ...x, respostaTemp: e.target.value } : x
                            )
                          )
                        }
                        rows={2}
                        style={{
                          width: "100%",
                          fontSize: "14px",
                          padding: "6px",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          resize: "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                        <button
                          type="button"
                          className="coment-btn"
                          onClick={() => enviarResposta(pai.id)}
                          disabled={!pai.respostaTemp?.trim()}
                        >
                          Responder
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelarResposta(pai.id)}
                          style={{ background: "none", color: "#666" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {pai.respostasFilhas.map((resposta) => {
                const respProfile = resposta.profiles || { nome: "Usuário", nickname: null, avatar_url: null };
                const respNome = respProfile.nickname || respProfile.nome;
                return (
                  <div key={resposta.id} className="comentario-item comentario-resposta">
                    <div className="comentario-avatar">
                      {respProfile.avatar_url ? (
                        <img
                          src={respProfile.avatar_url}
                          alt={respNome}
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "block";
                          }}
                        />
                      ) : (
                        <FiUser className="avatar-placeholder" />
                      )}
                    </div>
                    <div className="comentario-conteudo">
                      <div className="comentario-header">
                        <div className="comentario-autor">
                          <strong>{respNome}</strong>
                        </div>
                        <div className="comentario-meta" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.9em", color: "#888" }}>{resposta.formattedDate}</span>
                          <TaskReactions
                            comentarioId={resposta.id}
                            userId={userId}
                            reacoes={resposta.reacoes}
                            reacoesDetalhadas={resposta.reacoesDetalhadas}
                            onToggleReacao={handleReacaoClick}
                            disabled={loading || comentando}
                          />
                        </div>
                      </div>
                      <div className="comentario-texto">
                        {renderTextoFormatadoComMencoes(resposta.conteudo, perfilesPorId, projetoAtual, containerIdDaNota, supabaseClient)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TaskComentarios;