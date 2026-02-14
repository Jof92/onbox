// src/components/Metas.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { FaTimes } from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faUserPlus, faCalendar } from "@fortawesome/free-solid-svg-icons";
import "./Meta.css";
import "./ListagemEspelho.css";

const ChipResponsavel = ({ responsavel, onRemove, disabled }) => {
  const nomeExibicao = responsavel.nome_exibicao || "Usuário";
  const isExterno = !responsavel.usuario_id;

  return (
    <span className={`chip-responsavel ${isExterno ? 'chip-externo' : ''}`}>
      {nomeExibicao}
      {!disabled && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove(responsavel);
          }}
          className="chip-remove"
        >
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

// Função para formatar data sem problemas de fuso horário
const formatarDataParaExibicao = (dataString) => {
  if (!dataString) return '';
  
  // Extrai apenas a parte da data (YYYY-MM-DD) e formata para DD/MM/YYYY
  const dataParte = dataString.split('T')[0];
  const [ano, mes, dia] = dataParte.split('-');
  return `${dia}/${mes}/${ano}`;
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
  const [novoMetaTexto, setNovoMetaTexto] = useState("");
  const [editingResponsavelId, setEditingResponsavelId] = useState(null);

  const cardRef = useRef(null);


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
  const adicionarMeta = async () => {
    if (!novoMetaTexto.trim()) return;
    
    try {
      const { error, data } = await supabase
        .from("metas")
        .insert({
          nota_id: notaId,
          descricao: novoMetaTexto.trim(),
          data_entrega: null,
          concluido: false,
          concluido_em: null,
          comentario: "",
        })
        .select()
        .single();

      if (error) throw error;

      setMetas(prev => [...prev, {
        id: data.id,
        descricao: data.descricao,
        data_entrega: data.data_entrega,
        concluido: data.concluido,
        concluido_em: data.concluido_em,
        comentario: data.comentario,
        responsaveis: [],
      }]);
      
      setNovoMetaTexto("");
    } catch (err) {
      console.error("Erro ao adicionar meta:", err);
      alert("Erro ao adicionar meta.");
    }
  };

  // Atualizar campo
  const atualizarMeta = (id, campo, valor) => {
    setMetas(prev => prev.map(m => m.id === id ? { ...m, [campo]: valor } : m));
  };

  // Buscar responsáveis com @
  const handleResponsavelInputChange = (e, metaId) => {
    const valor = e.target.value;
    setInputResponsavel(prev => ({ ...prev, [metaId]: valor }));

    if (valor.startsWith("@") && valor.length > 1 && projectId) {
      const termo = valor.slice(1).toLowerCase();
      supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .then(async ({ data: membros, error }) => {
          if (error || !membros?.length) return setSugestoesResponsavel(prev => ({ ...prev, [metaId]: [] }));

          const userIds = membros.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", userIds)
            .ilike("nome", `%${termo}%`);

          setSugestoesResponsavel(prev => ({ ...prev, [metaId]: profiles || [] }));
        });
    } else {
      setSugestoesResponsavel(prev => ({ ...prev, [metaId]: [] }));
    }
  };

  const adicionarResponsavelInterno = async (usuario, metaId) => {
    const meta = metas.find(m => m.id === metaId);
    if (!meta || meta.concluido || meta.responsaveis.some(r => r.usuario_id === usuario.id)) return;

    try {
      const { data } = await supabase
        .from("metas_responsaveis")
        .insert({
          meta_id: metaId,
          usuario_id: usuario.id,
          nome_externo: null
        })
        .select()
        .single();

      if (!data) return;

      setMetas(prev =>
        prev.map(m =>
          m.id === metaId
            ? {
                ...m,
                responsaveis: [
                  ...m.responsaveis,
                  {
                    id: data.id,
                    usuario_id: usuario.id,
                    nome_externo: null,
                    nome_exibicao: usuario.nome
                  }
                ]
              }
            : m
        )
      );
      setInputResponsavel(prev => ({ ...prev, [metaId]: "" }));
      setSugestoesResponsavel(prev => ({ ...prev, [metaId]: [] }));
      setEditingResponsavelId(null);
    } catch (err) {
      console.error("Erro ao adicionar responsável interno:", err);
    }
  };

  const adicionarResponsavelExterno = async (nome, metaId) => {
    if (!nome.trim()) return;
    const meta = metas.find(m => m.id === metaId);
    if (!meta || meta.concluido || meta.responsaveis.some(r => r.nome_externo === nome && !r.usuario_id)) return;

    try {
      const { data } = await supabase
        .from("metas_responsaveis")
        .insert({
          meta_id: metaId,
          nome_externo: nome.trim(),
          usuario_id: null
        })
        .select()
        .single();

      if (!data) return;

      setMetas(prev =>
        prev.map(m =>
          m.id === metaId
            ? {
                ...m,
                responsaveis: [
                  ...m.responsaveis,
                  {
                    id: data.id,
                    nome_externo: nome.trim(),
                    usuario_id: null,
                    nome_exibicao: nome.trim()
                  }
                ]
              }
            : m
        )
      );
      setInputResponsavel(prev => ({ ...prev, [metaId]: "" }));
      setEditingResponsavelId(null);
    } catch (err) {
      console.error("Erro ao adicionar responsável externo:", err);
    }
  };

  const removerResponsavel = async (responsavelId, metaId) => {
    setMetas(prev =>
      prev.map(m =>
        m.id === metaId
          ? { ...m, responsaveis: m.responsaveis.filter(r => r.id !== responsavelId) }
          : m
      )
    );
    try {
      await supabase
        .from("metas_responsaveis")
        .delete()
        .eq("id", responsavelId);
    } catch (err) {
      console.error("Erro ao remover responsável:", err);
    }
  };

  const toggleConclusao = async (id, concluidoAtual) => {
    const novoValor = !concluidoAtual;
    setMetas(prev => prev.map(m => m.id === id ? { ...m, concluido: novoValor } : m));
    try {
      await supabase
        .from("metas")
        .update({ concluido: novoValor, concluido_em: novoValor ? new Date().toISOString() : null })
        .eq("id", id);
    } catch (err) {
      console.error("Erro ao atualizar conclusão:", err);
      setMetas(prev => prev.map(m => m.id === id ? { ...m, concluido: concluidoAtual } : m));
    }
  };

  const atualizarDataEntrega = async (id, data) => {
    setMetas(prev => prev.map(m => m.id === id ? { ...m, data_entrega: data } : m));
    try {
      await supabase
        .from("metas")
        .update({ data_entrega: data || null })
        .eq("id", id);
    } catch (err) {
      console.error("Erro ao atualizar data de entrega:", err);
    }
  };

  const removerMeta = async (id) => {
    if (!window.confirm("Deseja realmente excluir esta meta?")) return;
    setMetas(prev => prev.filter(m => m.id !== id));
    try {
      await supabase
        .from("metas")
        .delete()
        .eq("id", id);
    } catch (err) {
      console.error("Erro ao excluir meta:", err);
    }
  };

  // Comentário
  const iniciarEdicaoComentario = (id, comentarioAtual) => {
    let puro = comentarioAtual || "";
    if (puro.includes(" — Comentário por ")) {
      const i = puro.lastIndexOf(" — Comentário por ");
      puro = puro.substring(0, i);
    }
    setEditandoComentario(prev => ({ ...prev, [id]: true }));
    setComentarioTemp(prev => ({ ...prev, [id]: puro }));
  };

  const cancelarComentario = (id) => {
    setEditandoComentario(prev => ({ ...prev, [id]: false }));
  };

  const salvarComentario = async (id) => {
    const comentario = `${comentarioTemp[id] || ""} — Comentário por ${meuNome}`;
    setMetas(prev => prev.map(m => m.id === id ? { ...m, comentario } : m));
    setEditandoComentario(prev => ({ ...prev, [id]: false }));
    
    try {
      await supabase
        .from("metas")
        .update({ comentario })
        .eq("id", id);
    } catch (err) {
      console.error("Erro ao salvar comentário:", err);
    }
  };

  const progressoPercent = metas.length
    ? Math.round((metas.filter(m => m.concluido).length / metas.length) * 100)
    : 0;

  return (
    <div className="metas-modal-overlay">
      <div className="metas-card" ref={cardRef}>
        {/* HEADER - igual ao AtaCard */}
        <div className="listagem-card">
          <div className="listagem-header-container">
            <div className="listagem-header-titles">
              <span className="project-name">{projetoNome || "Projeto"}</span>
              <div className="sub-info">
                <span className="nota-name">{notaNome || "Metas"}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {onClose && (
                <button
                  className="listagem-close-btn"
                  onClick={onClose}
                  aria-label="Fechar"
                >
                  <FaTimes />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="metas-container-completo">
          <div className="metas-header">
            <h4>Metas</h4>
          </div>

          {/* Barra de Progresso */}
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progressoPercent}%` }}></div>
            <span className="progress-percent">{progressoPercent}%</span>
          </div>

          {/* Formulário de Adição */}
          <div className="objetivos-add-form">
            <input
              type="text"
              value={novoMetaTexto}
              onChange={(e) => setNovoMetaTexto(e.target.value)}
              placeholder="Digite uma nova meta..."
              onKeyDown={(e) => e.key === "Enter" && adicionarMeta()}
              disabled={salvando}
            />
            <button
              type="button"
              className="objetivos-add-btn"
              onClick={adicionarMeta}
              disabled={!novoMetaTexto.trim() || salvando}
            >
              Adicionar
            </button>
          </div>

          {/* Lista de Metas */}
          <div className="objetivos-lista">
            {metas.map((meta, idx) => {
              const isConcluido = meta.concluido;
              const podeDesmarcar = podeDesmarcarConclusao(meta.concluido_em);
              const isEditingComentario = editandoComentario[meta.id];

              return (
                <div
                  key={meta.id}
                  className={`objetivo-item1 ${isConcluido ? 'objetivo-concluido' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isConcluido}
                    onChange={() => toggleConclusao(meta.id, isConcluido)}
                    disabled={isConcluido && !podeDesmarcar}
                  />
                  <span>
                    <strong>{idx + 1}.</strong> {meta.descricao}
                  </span>

                  <div className="objetivo-responsaveis-chips">
                    {meta.responsaveis.map(resp => (
                      <ChipResponsavel
                        key={resp.id}
                        responsavel={resp}
                        onRemove={(r) => removerResponsavel(r.id, meta.id)}
                        disabled={isConcluido}
                      />
                    ))}
                  </div>

                  <div className="objetivo-acao-direita">
                    {!isConcluido && (
                      <span
                        className="icone-editar"
                        title="Editar meta"
                        onClick={() => {
                          const novoTexto = prompt("Editar meta:", meta.descricao);
                          if (novoTexto !== null && novoTexto.trim() !== "" && novoTexto.trim() !== meta.descricao) {
                            setMetas(prev =>
                              prev.map(m =>
                                m.id === meta.id ? { ...m, descricao: novoTexto.trim() } : m
                              )
                            );
                            supabase
                              .from("metas")
                              .update({ descricao: novoTexto.trim() })
                              .eq("id", meta.id)
                              .then(({ error }) => {
                                if (error) {
                                  console.error("Erro ao salvar edição:", error);
                                  alert("Erro ao salvar alteração.");
                                  setMetas(prev =>
                                    prev.map(m =>
                                      m.id === meta.id ? { ...m, descricao: meta.descricao } : m
                                    )
                                  );
                                }
                              });
                          }
                        }}
                      >
                        <FontAwesomeIcon icon={faPenToSquare} />
                      </span>
                    )}

                    {!isConcluido && (
                      <span
                        className="icone-add-resp"
                        title="Adicionar responsável"
                        onClick={() => {
                          setEditingResponsavelId(meta.id);
                        }}
                      >
                        <FontAwesomeIcon icon={faUserPlus} />
                      </span>
                    )}

                    {editingResponsavelId === meta.id && !isConcluido && (
                      <div className="input-responsavel-flutuante">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Nome ou @menção"
                          value={inputResponsavel[meta.id] || ""}
                          onChange={(e) => handleResponsavelInputChange(e, meta.id)}
                          onBlur={() => {
                            setTimeout(() => setEditingResponsavelId(null), 200);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const valor = inputResponsavel[meta.id] || "";
                              if (!valor.startsWith("@")) {
                                adicionarResponsavelExterno(valor, meta.id);
                              }
                            } else if (e.key === "Escape") {
                              setEditingResponsavelId(null);
                            }
                          }}
                          disabled={salvando}
                        />
                        {sugestoesResponsavel[meta.id]?.length > 0 && (
                          <div className="sugestoes-list-flutuante">
                            {sugestoesResponsavel[meta.id].map(item => (
                              <div
                                key={item.id}
                                className="sugestao-item"
                                onClick={() => {
                                  adicionarResponsavelInterno(item, meta.id);
                                }}
                              >
                                @{item.nome}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="objetivo-acao">
                    {!isConcluido && (
                      <label
                        className="objetivo-data-entrega"
                        style={{ 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          position: 'relative'
                        }}
                      >
                        {meta.data_entrega ? (
                          <>
                            {formatarDataParaExibicao(meta.data_entrega)}
                            <FontAwesomeIcon icon={faCalendar} style={{ fontSize: '12px', color: '#555' }} />
                          </>
                        ) : (
                          <FontAwesomeIcon icon={faCalendar} style={{ fontSize: '14px', color: '#555' }} />
                        )}
                        <input
                          type="date"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer'
                          }}
                          value={meta.data_entrega || ''}
                          onChange={(e) => atualizarDataEntrega(meta.id, e.target.value || null)}
                          disabled={salvando}
                        />
                      </label>
                    )}

                    {isConcluido ? (
                      <ComentarioIcon
                        onClick={() => iniciarEdicaoComentario(meta.id, meta.comentario)}
                        title={meta.comentario ? "Editar comentário" : "Adicionar comentário"}
                      />
                    ) : (
                      <span
                        className="objetivo-excluir"
                        onClick={() => removerMeta(meta.id)}
                      >
                        ×
                      </span>
                    )}
                  </div>

                  {isEditingComentario && (
                    <div className="comentario-editor-flutuante">
                      <textarea
                        value={comentarioTemp[meta.id] || ""}
                        onChange={e => setComentarioTemp(prev => ({ ...prev, [meta.id]: e.target.value }))}
                        placeholder="Descreva como a meta foi concluída..."
                        rows={2}
                      />
                      <div className="comentario-botoes">
                        <button
                          className="btn-comentario-salvar"
                          onClick={() => salvarComentario(meta.id)}
                        >
                          Salvar
                        </button>
                        <button className="btn-comentario-cancelar" onClick={() => cancelarComentario(meta.id)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}