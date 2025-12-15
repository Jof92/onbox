// src/components/Task.jsx
import React, { useState, useEffect, useRef } from "react";
import "./Task.css";
import { FaTimes } from "react-icons/fa";
import { MdPersonAddAlt1 } from "react-icons/md";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import ComentariosSection from "./TaskComentarios";
import TaskAnexos from "./TaskAnexos";

export default function Task({ onClose, projetoAtual, notaAtual, containerId: containerIdProp }) {
  const [descricao, setDescricao] = useState("");
  const [anexosSalvos, setAnexosSalvos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [meuNome, setMeuNome] = useState("Você");
  const [dataEntregaTarefa, setDataEntregaTarefa] = useState("");
  const [imagemAmpliada, setImagemAmpliada] = useState(null);
  const [containerIdValidado, setContainerIdValidado] = useState(null);
  const [responsaveisTarefa, setResponsaveisTarefa] = useState([]);
  const [showInputResponsaveis, setShowInputResponsaveis] = useState(false);
  const [inputResponsavelTarefa, setInputResponsavelTarefa] = useState("");
  const [sugestoesMembros, setSugestoesMembros] = useState([]);
  const modalRef = useRef(null);
  const inputRef = useRef(null);

  // Fechar input ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (onClose && modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
      if (showInputResponsaveis && inputRef.current && !inputRef.current.contains(e.target)) {
        setShowInputResponsaveis(false);
        setInputResponsavelTarefa("");
        setSugestoesMembros([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, showInputResponsaveis]);

  // Carregar usuário logado
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome, nickname, avatar_url, container") // ✅ incluir "container"
          .eq("id", user.id)
          .single();

        const safeProfile = profile || { nome: "Você", nickname: "usuario", avatar_url: null, container: "" };
        setUserProfile(safeProfile);
        setMeuNome(safeProfile.nome || "Você");
      }
    };
    fetchUser();
  }, []);

  // Validar container_id e carregar responsáveis
  useEffect(() => {
    if (!notaAtual?.id) {
      setContainerIdValidado(null);
      setResponsaveisTarefa([]);
      return;
    }

    const fetchContainerId = async () => {
      const { data: nota, error } = await supabase
        .from("notas")
        .select("container_id")
        .eq("id", notaAtual.id)
        .single();

      if (error || !nota?.container_id) {
        console.error("Não foi possível obter container_id da nota", error);
        setContainerIdValidado(null);
        return;
      }

      setContainerIdValidado(nota.container_id);

      const { data: responsaveis } = await supabase
        .from("nota_responsaveis")
        .select("usuario_id")
        .eq("nota_id", notaAtual.id);

      if (responsaveis?.length > 0) {
        const userIds = responsaveis.map(r => r.usuario_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, nickname, avatar_url")
          .in("id", userIds);
        setResponsaveisTarefa(profiles || []);
      } else {
        setResponsaveisTarefa([]);
      }
    };

    fetchContainerId();
  }, [notaAtual?.id]);

  // Carregar dados da nota
  useEffect(() => {
    if (!notaAtual?.id) {
      setDescricao("");
      setAnexosSalvos([]);
      setDataEntregaTarefa("");
      return;
    }

    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: nota } = await supabase
          .from("notas")
          .select("descricao, data_entrega")
          .eq("id", notaAtual.id)
          .single();
        if (isMounted) {
          setDescricao(nota?.descricao || "");
          setDataEntregaTarefa(nota?.data_entrega || "");
        }

        const { data: anexos } = await supabase
          .from("anexos")
          .select("id, file_name, file_url, mime_type")
          .eq("nota_id", notaAtual.id)
          .order("created_at", { ascending: true });
        if (isMounted) setAnexosSalvos(anexos || []);
      } catch (err) {
        console.error("Erro ao carregar dados da nota:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [notaAtual?.id]);

  // Carregar objetivos
  const [objetivos, setObjetivos] = useState([]);
  const [showObjetivos, setShowObjetivos] = useState(false);
  const [novoObjetivoTexto, setNovoObjetivoTexto] = useState("");
  const [inputResponsavel, setInputResponsavel] = useState({});
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState({});

  useEffect(() => {
    if (!notaAtual?.id || !containerIdValidado) {
      setObjetivos([]);
      setShowObjetivos(false);
      return;
    }

    const fetchObjetivos = async () => {
      setLoading(true);
      try {
        const { data: checklist } = await supabase
          .from("checklists")
          .select("id")
          .eq("nota_id", notaAtual.id)
          .single();

        if (!checklist) {
          setObjetivos([]);
          setShowObjetivos(false);
          return;
        }

        const { data: items } = await supabase
          .from("checklist_items")
          .select("*")
          .eq("checklist_id", checklist.id)
          .order("created_at", { ascending: true });

        const itemIds = items.map(i => i.id);
        let respMap = {};
        if (itemIds.length > 0) {
          const { data: responsaveis } = await supabase
            .from("checklist_responsaveis")
            .select("*")
            .in("checklist_item_id", itemIds);

          if (responsaveis) {
            respMap = responsaveis.reduce((acc, r) => {
              if (!acc[r.checklist_item_id]) acc[r.checklist_item_id] = [];
              acc[r.checklist_item_id].push({
                id: r.id,
                usuario_id: r.usuario_id,
                nome_externo: r.nome_externo,
                nome_exibicao: r.nome_externo || "Usuário"
              });
              return acc;
            }, {});
          }
        }

        const objetivosCompletos = items.map(item => ({
          id: item.id,
          texto: item.description || "",
          concluido: item.is_completed || false,
          dataEntrega: item.data_entrega || null,
          responsaveis: respMap[item.id] || [],
          checklist_id: checklist.id
        }));

        setObjetivos(objetivosCompletos);
        setShowObjetivos(objetivosCompletos.length > 0);
      } catch (err) {
        console.error("Erro ao carregar objetivos:", err);
        setObjetivos([]);
        setShowObjetivos(false);
      } finally {
        setLoading(false);
      }
    };

    fetchObjetivos();
  }, [notaAtual?.id, containerIdValidado]);

  useEffect(() => {
    if (objetivos.length > 0) {
      setShowObjetivos(true);
    } else {
      setShowObjetivos(false);
    }
  }, [objetivos.length]);

  // Funções de responsáveis da tarefa
  const handleInputResponsavelChange = (e) => {
    const valor = e.target.value;
    setInputResponsavelTarefa(valor);
    if (valor.startsWith("@") && valor.length > 1 && containerIdValidado) {
      const termo = valor.slice(1).toLowerCase();
      supabase
        .from("convites")
        .select("user_id")
        .eq("container_id", containerIdValidado)
        .eq("status", "aceito")
        .then(async ({ data: convites }) => {
          const userIds = convites?.map(c => c.user_id).filter(Boolean) || [];
          if (userIds.length === 0) {
            setSugestoesMembros([]);
            return;
          }
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, nome, nickname, avatar_url")
            .in("id", userIds);
          const sugestoes = profiles?.filter(p =>
            (p.nickname?.toLowerCase().includes(termo)) ||
            (p.nome?.toLowerCase().includes(termo))
          ) || [];
          setSugestoesMembros(sugestoes.slice(0, 5));
        });
    } else {
      setSugestoesMembros([]);
    }
  };

  // ✅ Função atualizada: envia notificação ao adicionar responsável
  const adicionarResponsavelTarefa = async (perfil) => {
    if (responsaveisTarefa.some(r => r.id === perfil.id)) return;

    const novoResponsavel = {
      id: perfil.id,
      nome: perfil.nome,
      nickname: perfil.nickname,
      avatar_url: perfil.avatar_url
    };
    setResponsaveisTarefa(prev => [...prev, novoResponsavel]);

    try {
      // 1. Adicionar na tabela nota_responsaveis
      const { error: insertError } = await supabase
        .from("nota_responsaveis")
        .insert({
          nota_id: notaAtual.id,
          usuario_id: perfil.id
        });

      if (insertError) {
        throw new Error(`Erro ao vincular responsável: ${insertError.message}`);
      }

      // 2. Obter nome do container (vem do perfil do usuário logado)
      const nomeContainer = userProfile?.container || "";

      // 3. Montar a mensagem
      const nomeTarefa = getNomeNota();
      const nomeProjeto = getNomeProjeto();
      const mensagem = nomeContainer
        ? `Você foi adicionado a tarefa "${nomeTarefa}" do projeto "${nomeProjeto}" da container "${nomeContainer}" por ${meuNome}.`
        : `Você foi adicionado a tarefa "${nomeTarefa}" do projeto "${nomeProjeto}" por ${meuNome}.`;

      // 4. Montar URL de redirecionamento
      const url = `/container/${containerIdValidado}/projeto/${projetoAtual?.id}/nota/${notaAtual.id}`;

      // 5. Inserir notificação
      const { error: notifError } = await supabase
        .from("notificacoes")
        .insert({
          user_id: perfil.id,
          remetente_id: userId,
          mensagem,
          projeto_id: projetoAtual?.id || null,
          nota_id: notaAtual.id,
          tipo: "atribuição",
          lido: false,
          url: url
        });

      if (notifError) {
        console.warn("Falha ao enviar notificação:", notifError);
        // Mesmo com falha na notificação, mantemos a atribuição
      }
    } catch (err) {
      console.error("Erro ao atribuir responsável:", err);
      setResponsaveisTarefa(prev => prev.filter(r => r.id !== perfil.id));
      alert("Erro ao adicionar responsável. Tente novamente.");
      return;
    }

    setInputResponsavelTarefa("");
    setSugestoesMembros([]);
  };

  const removerResponsavelTarefa = async (usuarioId) => {
    setResponsaveisTarefa(prev => prev.filter(r => r.id !== usuarioId));
    try {
      await supabase
        .from("nota_responsaveis")
        .delete()
        .eq("nota_id", notaAtual.id)
        .eq("usuario_id", usuarioId);
    } catch (err) {
      console.error("Erro ao remover responsável:", err);
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, nome, nickname, avatar_url")
        .eq("id", usuarioId)
        .single();
      if (profile) {
        setResponsaveisTarefa(prev => [...prev, profile]);
      }
    }
  };

  const handleSaveDescricao = async () => {
    if (!notaAtual?.id) return;
    setLoading(true);
    try {
      await supabase
        .from("notas")
        .update({ descricao: descricao || null })
        .eq("id", notaAtual.id);
    } catch (err) {
      console.error("Erro ao salvar descrição:", err);
      alert("Erro ao salvar descrição.");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarDataEntregaTarefa = async (novaData) => {
    if (!notaAtual?.id) return;
    setLoading(true);
    try {
      await supabase
        .from("notas")
        .update({ data_entrega: novaData || null })
        .eq("id", notaAtual.id);
      setDataEntregaTarefa(novaData || "");
    } catch (err) {
      console.error("Erro ao salvar data de entrega da tarefa:", err);
      alert("Erro ao salvar data de entrega.");
    } finally {
      setLoading(false);
    }
  };

  const getNomeProjeto = () => projetoAtual?.nome || projetoAtual?.name || "Sem projeto";
  const getNomeNota = () => notaAtual?.nome || notaAtual?.name || "Sem nota";

  if (loading || (notaAtual?.id && containerIdValidado === null)) {
    return (
      <div className="task-modal" ref={modalRef}>
        <div className="task-loading-container">
          <Loading size={200} />
        </div>
      </div>
    );
  }

  return (
    <div className="task-modal" ref={modalRef}>
      <div className="task-header">
        <div className="task-header-titles">
          <span className="project-name">{getNomeProjeto()}</span>
          <div className="sub-info">
            <span className="nota-name">{getNomeNota()}</span>
          </div>
        </div>
        {onClose && (
          <button className="listagem-close-btn" onClick={onClose} aria-label="Fechar">
            <FaTimes />
          </button>
        )}
      </div>

      <div className="task-title-container">
        <h2 className="task-title">{getNomeNota()}</h2>

        {/* ✅ ÚNICO COMPONENTE: avatares + botão */}
        <div className="grupo-responsaveis-tarefa">
          <div className="lista-avatares-responsaveis">
            {responsaveisTarefa.map(resp => (
              <div
                key={resp.id}
                className="avatar-responsavel"
                title={resp.nickname || resp.nome}
                onClick={() => removerResponsavelTarefa(resp.id)}
              >
                {resp.avatar_url ? (
                  <img src={resp.avatar_url} alt={resp.nickname || resp.nome} />
                ) : (
                  <div className="avatar-placeholder">
                    {(resp.nickname || resp.nome || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-adicionar-responsavel"
            onClick={() => setShowInputResponsaveis(!showInputResponsaveis)}
            disabled={loading || !containerIdValidado}
            title="Adicionar responsáveis"
          >
            <MdPersonAddAlt1 />
          </button>

          {/* Input flutuante de menção */}
          {showInputResponsaveis && (
            <div ref={inputRef} className="input-responsavel-flutuante">
              <input
                type="text"
                value={inputResponsavelTarefa}
                onChange={handleInputResponsavelChange}
                placeholder="Digite @ para mencionar membros"
                autoFocus
              />
              {sugestoesMembros.length > 0 && (
                <div className="sugestoes-responsaveis-lista">
                  {sugestoesMembros.map(perfil => (
                    <div
                      key={perfil.id}
                      onClick={() => adicionarResponsavelTarefa(perfil)}
                      className="sugestao-responsavel-item"
                    >
                      {perfil.avatar_url ? (
                        <img src={perfil.avatar_url} alt={perfil.nickname || perfil.nome} />
                      ) : (
                        <div className="avatar-placeholder-small">
                          {(perfil.nickname || perfil.nome || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{perfil.nickname || perfil.nome}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ✅ Wrapper de data — intacto, como sempre esteve */}
        <div className="data-entrega-wrapper">
          <label className="data-entrega-label">Data de entrega</label>
          <input
            type="date"
            value={dataEntregaTarefa || ""}
            onChange={(e) => setDataEntregaTarefa(e.target.value)}
            onBlur={(e) => handleSalvarDataEntregaTarefa(e.target.value || null)}
            className="data-entrega-input"
            disabled={loading}
          />
        </div>
      </div>

      <div className="descricao-section">
        <h3>Descrição</h3>
        <textarea
          className="descricao-editor-textarea"
          value={descricao}
          onChange={(e) => {
            setDescricao(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={handleSaveDescricao}
          placeholder="Clique aqui para adicionar uma descrição..."
          rows={3}
          style={{ minHeight: "3.25em", height: "8em", resize: "none" }}
          disabled={loading}
        />
      </div>

      {containerIdValidado && (
        <TaskAnexos
          notaAtual={notaAtual}
          userId={userId}
          loading={loading}
          anexosSalvos={anexosSalvos}
          setAnexosSalvos={setAnexosSalvos}
          objetivos={objetivos}
          setObjetivos={setObjetivos}
          showObjetivos={showObjetivos}
          setShowObjetivos={setShowObjetivos}
          novoObjetivoTexto={novoObjetivoTexto}
          setNovoObjetivoTexto={setNovoObjetivoTexto}
          inputResponsavel={inputResponsavel}
          setInputResponsavel={setInputResponsavel}
          sugestoesResponsavel={sugestoesResponsavel}
          setSugestoesResponsavel={setSugestoesResponsavel}
          containerId={containerIdValidado}
          setImagemAmpliada={setImagemAmpliada}
        />
      )}

      {notaAtual?.id && userId && userProfile && containerIdValidado && (
        <ComentariosSection
          notaId={notaAtual.id}
          userId={userId}
          userProfile={userProfile}
          projetoAtual={projetoAtual}
          containerId={containerIdValidado}
          supabaseClient={supabase}
        />
      )}

      {imagemAmpliada && (
        <div
          className="imagem-ampliada-modal"
          onClick={() => setImagemAmpliada(null)}
          onKeyDown={(e) => e.key === 'Escape' && setImagemAmpliada(null)}
          tabIndex={-1}
        >
          <button className="imagem-ampliada-fechar" onClick={() => setImagemAmpliada(null)} aria-label="Fechar imagem">
            <FaTimes />
          </button>

          {imagemAmpliada.imagens.length > 1 && (
            <>
              <button
                className="seta-navegacao esquerda"
                onClick={(e) => {
                  e.stopPropagation();
                  const novoIndex = (imagemAmpliada.index - 1 + imagemAmpliada.imagens.length) % imagemAmpliada.imagens.length;
                  setImagemAmpliada({ ...imagemAmpliada, index: novoIndex });
                }}
                aria-label="Imagem anterior"
              >
                ‹
              </button>
              <button
                className="seta-navegacao direita"
                onClick={(e) => {
                  e.stopPropagation();
                  const novoIndex = (imagemAmpliada.index + 1) % imagemAmpliada.imagens.length;
                  setImagemAmpliada({ ...imagemAmpliada, index: novoIndex });
                }}
                aria-label="Próxima imagem"
              >
                ›
              </button>
            </>
          )}

          <div className="imagem-ampliada-wrapper">
            <img
              src={imagemAmpliada.imagens[imagemAmpliada.index]?.file_url}
              alt={imagemAmpliada.imagens[imagemAmpliada.index]?.file_name || "Imagem"}
            />
          </div>
        </div>
      )}
    </div>
  );
}