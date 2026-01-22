// src/components/Metas.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { FaTimes } from "react-icons/fa";
import "./Meta.css";

const ChipResponsavel = ({ responsavel, onRemove, disabled }) => {
  const nomeExibicao = responsavel.nome_exibicao || "Usuário";
  const isExterno = !responsavel.usuario_id;

  return (
    <span className={`chip-responsavel ${isExterno ? "externo" : "interno"}`}>
      {nomeExibicao}
      {!disabled && (
        <span className="chip-remove" onClick={(e) => {
          e.stopPropagation();
          onRemove(responsavel);
        }}>
          ×
        </span>
      )}
    </span>
  );
};

const ComentarioIcon = ({ onClick, title }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ cursor: "pointer" }} onClick={onClick} title={title}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const podeDesmarcarConclusao = (concluidoEm) => {
  if (!concluidoEm) return true;
  const agora = new Date();
  const diffHoras = (agora - new Date(concluidoEm)) / (1000 * 60 * 60);
  return diffHoras < 24;
};

export default function Metas({ 
  notaId, 
  projectId, 
  usuarioId, 
  projetoNome, 
  notaNome, 
  onClose 
}) {
  const [metas, setMetas] = useState([]);
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState({});
  const [inputResponsavel, setInputResponsavel] = useState({});
  const [editandoComentario, setEditandoComentario] = useState({});
  const [comentarioTemp, setComentarioTemp] = useState({});
  const [meuNome, setMeuNome] = useState("Você");
  const [salvando, setSalvando] = useState(false);

  const cardRef = useRef(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (onClose && cardRef.current && !cardRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (onClose) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [onClose]);

  // Carrega nome do usuário
  useEffect(() => {
    if (!usuarioId) return;
    const fetchMeuNome = async () => {
      const { data } = await supabase.from("profiles").select("nome").eq("id", usuarioId).single();
      if (data?.nome) setMeuNome(data.nome);
    };
    fetchMeuNome();
  }, [usuarioId]);

  // Carrega metas da nota
  const carregarMetas = useCallback(async () => {
    if (!notaId) return setMetas([]);

    const { data: metasData, error } = await supabase
      .from("metas")
      .select(`*, metas_responsaveis(id, usuario_id, nome_externo)`)
      .eq("nota_id", notaId)
      .order("criado_em", { ascending: true });

    if (error) {
      console.error("Erro ao carregar metas:", error);
      return setMetas([]);
    }

    const metasEnriquecidas = metasData.map(m => {
      const responsaveis = (m.metas_responsaveis || []).map(r => ({
        id: r.id,
        usuario_id: r.usuario_id,
        nome_externo: r.nome_externo,
        nome_exibicao: r.usuario_id ? "" : r.nome_externo,
      }));
      delete m.metas_responsaveis;
      return { ...m, responsaveis };
    });

    // Preencher nomes de responsáveis internos
    const idsInternos = metasEnriquecidas.flatMap(m => m.responsaveis)
      .filter(r => r.usuario_id)
      .map(r => r.usuario_id);

    if (idsInternos.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", idsInternos);

      const mapNomes = {};
      profiles?.forEach(p => { mapNomes[p.id] = p.nome; });

      metasEnriquecidas.forEach(m => {
        m.responsaveis.forEach(r => {
          if (r.usuario_id) r.nome_exibicao = mapNomes[r.usuario_id] || "Usuário";
        });
      });
    }

    setMetas(metasEnriquecidas);
  }, [notaId]);

  useEffect(() => {
    carregarMetas();
  }, [carregarMetas]);

  // Adicionar nova meta
  const adicionarMeta = () => {
    setMetas(prev => [...prev, {
      id: `temp-${Date.now()}`,
      descricao: "",
      data_entrega: null,
      concluido: false,
      concluido_em: null,
      comentario: "",
      responsaveis: [],
    }]);
  };

  // Atualizar campo
  const atualizarMeta = (index, campo, valor) => {
    setMetas(prev => {
      const novas = [...prev];
      novas[index] = { ...novas[index], [campo]: valor };
      return novas;
    });
  };

  // Buscar responsáveis com @
  const handleResponsavelInputChange = (e, index) => {
    const valor = e.target.value;
    setInputResponsavel(prev => ({ ...prev, [index]: valor }));

    if (valor.startsWith("@") && valor.length > 1 && projectId) {
      const termo = valor.slice(1).toLowerCase();
      supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .then(async ({ data: membros, error }) => {
          if (error || !membros?.length) return setSugestoesResponsavel(prev => ({ ...prev, [index]: [] }));

          const userIds = membros.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", userIds)
            .ilike("nome", `%${termo}%`);

          setSugestoesResponsavel(prev => ({ ...prev, [index]: profiles || [] }));
        });
    } else {
      setSugestoesResponsavel(prev => ({ ...prev, [index]: [] }));
    }
  };

  const adicionarResponsavelInterno = (usuario, index) => {
    const meta = metas[index];
    if (meta.concluido || meta.responsaveis.some(r => r.usuario_id === usuario.id)) return;

    const novoResp = {
      id: `temp-resp-${Date.now()}`,
      usuario_id: usuario.id,
      nome_externo: null,
      nome_exibicao: usuario.nome,
    };

    setMetas(prev => {
      const novas = [...prev];
      novas[index] = { ...novas[index], responsaveis: [...meta.responsaveis, novoResp] };
      return novas;
    });
    setInputResponsavel(prev => ({ ...prev, [index]: "" }));
    setSugestoesResponsavel(prev => ({ ...prev, [index]: [] }));
  };

  const adicionarResponsavelExterno = (nome, index) => {
    const meta = metas[index];
    if (meta.concluido || meta.responsaveis.some(r => r.nome_externo === nome && !r.usuario_id)) return;

    const novoResp = {
      id: `temp-resp-${Date.now()}`,
      usuario_id: null,
      nome_externo: nome,
      nome_exibicao: nome,
    };

    setMetas(prev => {
      const novas = [...prev];
      novas[index] = { ...novas[index], responsaveis: [...meta.responsaveis, novoResp] };
      return novas;
    });
  };

  const removerResponsavel = (responsavel, index) => {
    if (metas[index].concluido) return;
    setMetas(prev => {
      const novas = [...prev];
      novas[index].responsaveis = novas[index].responsaveis.filter(r => r.id !== responsavel.id);
      return novas;
    });
  };

  const handleKeyDownResponsavel = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nome = e.target.value.trim();
      if (nome && !nome.startsWith("@")) {
        adicionarResponsavelExterno(nome, index);
        setInputResponsavel(prev => ({ ...prev, [index]: "" }));
      }
    }
  };

  // Comentário
  const iniciarEdicaoComentario = (index, comentarioAtual) => {
    let puro = comentarioAtual || "";
    if (puro.includes(" — Comentário por ")) {
      const i = puro.lastIndexOf(" — Comentário por ");
      puro = puro.substring(0, i);
    }
    setEditandoComentario(prev => ({ ...prev, [index]: true }));
    setComentarioTemp(prev => ({ ...prev, [index]: puro }));
  };

  const cancelarComentario = (index) => {
    setEditandoComentario(prev => ({ ...prev, [index]: false }));
  };

  // Salvar todas as metas
  const handleSalvarTudo = async () => {
    if (salvando) return;
    setSalvando(true);

    try {
      const metasParaAtualizar = [];
      const metasTempIds = new Map();

      // Inserir metas novas
      for (const meta of metas) {
        if (String(meta.id).startsWith("temp")) {
          const { error, data } = await supabase
            .from("metas")
            .insert({
              nota_id: notaId,
              descricao: meta.descricao,
              data_entrega: meta.data_entrega,
              concluido: meta.concluido,
              concluido_em: meta.concluido ? new Date().toISOString() : null,
              comentario: meta.comentario,
            })
            .select()
            .single();

          if (error) throw error;
          metasParaAtualizar.push({ ...meta, id: data.id });
          metasTempIds.set(meta.id, data.id);
        } else {
          metasParaAtualizar.push(meta);
        }
      }

      // Atualizar metas existentes
      for (const meta of metasParaAtualizar) {
        if (!String(meta.id).startsWith("temp")) {
          await supabase
            .from("metas")
            .update({
              descricao: meta.descricao,
              data_entrega: meta.data_entrega,
              concluido: meta.concluido,
              concluido_em: meta.concluido ? new Date().toISOString() : null,
              comentario: meta.comentario,
            })
            .eq("id", meta.id);
        }
      }

      // Deletar e recriar responsáveis
      const todosIds = metasParaAtualizar.map(m => m.id);
      if (todosIds.length > 0) {
        await supabase.from("metas_responsaveis").delete().in("meta_id", todosIds);
      }

      const responsaveisParaInserir = [];
      for (const meta of metasParaAtualizar) {
        for (const resp of meta.responsaveis) {
          responsaveisParaInserir.push({
            meta_id: meta.id,
            usuario_id: resp.usuario_id || null,
            nome_externo: resp.nome_externo || null,
          });
        }
      }

      if (responsaveisParaInserir.length > 0) {
        await supabase.from("metas_responsaveis").insert(responsaveisParaInserir);
      }

      await carregarMetas();
      alert("Metas salvas com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar metas:", err);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="metas-modal-overlay">
      <div className="metas-card" ref={cardRef}>
        {/* HEADER */}
        <div className="listagem-card">
          <div className="listagem-header-container">
            <div className="listagem-header-titles">
              <span className="project-name">{projetoNome || "Projeto"}</span>
              <div className="sub-info">
                <span className="nota-name">{notaNome || "Metas"}</span>
              </div>
            </div>
            {onClose && (
              <button className="listagem-close-btn" onClick={onClose} aria-label="Fechar">
                <FaTimes />
              </button>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="metas-container-completo">
          <div className="metas-header">
            <h4>Metas</h4>
            <button className="btn-adicionar-meta" onClick={adicionarMeta}>+</button>
          </div>

          <div className="metas-grid">
            <div className="metas-grid-header">
              <span>Status</span>
              <span>Descrição</span>
              <span>Responsável</span>
              <span>Link</span>
              <span>Data de entrega</span>
              <span>Ações</span>
            </div>

            {metas.map((meta, i) => {
              const isConcluido = meta.concluido;
              const podeDesmarcar = podeDesmarcarConclusao(meta.concluido_em);
              const isEditingComentario = editandoComentario[i];

              return (
                <div key={meta.id} className={`meta-item ${isConcluido ? "concluido" : ""}`}>
                  <div className="meta-checkbox">
                    <input
                      type="checkbox"
                      checked={isConcluido}
                      onChange={() => atualizarMeta(i, "concluido", !isConcluido)}
                      disabled={isConcluido && !podeDesmarcar}
                    />
                  </div>

                  <div className="meta-descricao">
                    <input
                      type="text"
                      value={meta.descricao}
                      onChange={e => atualizarMeta(i, "descricao", e.target.value)}
                      placeholder="Descreva a meta..."
                      disabled={isConcluido}
                    />
                  </div>

                  <div className="meta-responsaveis">
                    <div className="responsaveis-list">
                      {meta.responsaveis.map(resp => (
                        <ChipResponsavel
                          key={resp.id}
                          responsavel={resp}
                          onRemove={r => removerResponsavel(r, i)}
                          disabled={isConcluido}
                        />
                      ))}
                    </div>
                    {!isConcluido && (
                      <input
                        type="text"
                        value={inputResponsavel[i] || ""}
                        onChange={e => handleResponsavelInputChange(e, i)}
                        onKeyDown={e => handleKeyDownResponsavel(e, i)}
                        placeholder={meta.responsaveis.length === 0 ? "@nome ou digite..." : ""}
                        className="input-responsavel"
                      />
                    )}
                    {sugestoesResponsavel[i]?.length > 0 && !isConcluido && (
                      <div className="sugestoes-responsavel">
                        {sugestoesResponsavel[i].map(u => (
                          <div key={u.id} className="sugestao-item" onClick={() => adicionarResponsavelInterno(u, i)}>
                            @{u.nome}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="meta-link">
                    <span>{projectId ? "Projeto" : "–"}</span>
                  </div>

                  <div className="meta-data">
                    <input
                      type="date"
                      value={meta.data_entrega || ""}
                      onChange={e => atualizarMeta(i, "data_entrega", e.target.value || null)}
                      disabled={isConcluido}
                    />
                  </div>

                  <div className="meta-acoes">
                    {isConcluido ? (
                      <ComentarioIcon
                        onClick={() => iniciarEdicaoComentario(i, meta.comentario)}
                        title={meta.comentario ? "Editar comentário" : "Adicionar comentário"}
                      />
                    ) : (
                      <button className="btn-excluir-meta" onClick={() => setMetas(prev => prev.filter((_, idx) => idx !== i))}>
                        ×
                      </button>
                    )}
                  </div>

                  {isEditingComentario && (
                    <div className="comentario-editor">
                      <textarea
                        value={comentarioTemp[i] || ""}
                        onChange={e => setComentarioTemp(prev => ({ ...prev, [i]: e.target.value }))}
                        placeholder="Descreva como a meta foi concluída..."
                        rows={2}
                      />
                      <div className="comentario-botoes">
                        <button
                          className="btn-comentario-salvar"
                          onClick={() => {
                            const comentario = `${comentarioTemp[i] || ""} — Comentário por ${meuNome}`;
                            atualizarMeta(i, "comentario", comentario);
                            cancelarComentario(i);
                          }}
                        >
                          Salvar
                        </button>
                        <button className="btn-comentario-cancelar" onClick={() => cancelarComentario(i)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="metas-footer">
            <button className="btn-salvar-metas" onClick={handleSalvarTudo} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar Metas"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}