// src/components/Metas.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { FaTimes, FaGripVertical, FaAlignLeft, FaAlignCenter, FaAlignRight } from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faUserPlus, faCalendar, faPalette } from "@fortawesome/free-solid-svg-icons";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./Meta.css";
import "./ListagemEspelho.css";

const CORES_PREDEFINIDAS = [
  "#ffffff", "#fef9c3", "#dcfce7", "#dbeafe", "#fce7f3",
  "#ede9fe", "#ffedd5", "#f0fdf4", "#fdf4ff", "#ecfeff",
];

// ─── Chip de Responsável ──────────────────────────────────────────────────────
const ChipResponsavel = ({ responsavel, onRemove, disabled }) => {
  const nomeExibicao = responsavel.nome_exibicao || "Usuário";
  const isExterno    = !responsavel.usuario_id;
  const avatarUrl    = responsavel.avatar_url;

  const gerarAbreviacao = (nome) => {
    if (!nome) return "U";
    if (nome.includes(' ')) return nome.split(' ').filter(p => p.length > 0).map(p => p.charAt(0).toUpperCase()).join('');
    return nome.substring(0, 2).toUpperCase();
  };

  return (
    <span className={`chip-responsavel ${isExterno ? 'chip-externo' : ''}`} title={nomeExibicao}>
      <div className="chip-responsavel-avatar-container">
        {avatarUrl && !isExterno ? (
          <img src={avatarUrl} alt={nomeExibicao} className="chip-responsavel-avatar"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
        ) : null}
        <div className="chip-responsavel-iniciais" style={{ display: avatarUrl && !isExterno ? 'none' : 'flex' }}>
          {gerarAbreviacao(nomeExibicao)}
        </div>
      </div>
      {!disabled && (
        <span onClick={(e) => { e.stopPropagation(); onRemove(responsavel); }} className="chip-remove">×</span>
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
  return (new Date() - new Date(concluidoEm)) / (1000 * 60 * 60) < 24;
};

const formatarDataParaExibicao = (dataString) => {
  if (!dataString) return '';
  const [ano, mes, dia] = dataString.split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
};

// ─── Tooltip de edição de descrição (estilo FormBuilder) ──────────────────────
function DescricaoTooltip({ valor, fontSize, color, align, onChange, onClose }) {
  const wrapRef  = useRef(null);
  const [draft,  setDraft]  = useState(valor || "");
  const [fSize,  setFSize]  = useState(Number(fontSize) || 14);
  const [fColor, setFColor] = useState(color || "#374151");
  const [fAlign, setFAlign] = useState(align || "left");

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        commit();
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [draft, fSize, fColor, fAlign]);

  const commit = () => onChange({ text: draft, fontSize: fSize, color: fColor, align: fAlign });

  return (
    <div ref={wrapRef} className="fb-text-tooltip1 metas-desc-tooltip" onMouseDown={e => e.stopPropagation()}>
      <div className="fb-tt-arrow" />

      <textarea
        autoFocus
        className="fb-tt-text-input metas-desc-textarea-tt"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Escape") { onClose(); }
          if (e.key === "Enter" && e.ctrlKey) { commit(); onClose(); }
          e.stopPropagation();
        }}
        placeholder="Descrição da tabela de metas..."
        rows={3}
      />
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Ctrl+Enter para confirmar · Esc para cancelar</div>

      <div className="fb-tt-controls">
        <div className="fb-tt-align-group">
          {[
            { v: "left",   Icon: FaAlignLeft },
            { v: "center", Icon: FaAlignCenter },
            { v: "right",  Icon: FaAlignRight },
          ].map(({ v, Icon }) => (
            <button key={v}
              className={`fb-tt-align-btn${fAlign === v ? " active" : ""}`}
              onMouseDown={e => { e.preventDefault(); setFAlign(v); }}>
              <Icon size={13} />
            </button>
          ))}
        </div>

        <div className="fb-tt-size-group">
          <button className="fb-tt-sz-btn" onMouseDown={e => { e.preventDefault(); setFSize(s => Math.max(9, s - 1)); }}>−</button>
          <span className="fb-tt-sz-val">{fSize}</span>
          <button className="fb-tt-sz-btn" onMouseDown={e => { e.preventDefault(); setFSize(s => Math.min(48, s + 1)); }}>+</button>
        </div>

        <label className="fb-tt-color-label" title="Cor do texto">
          <span className="fb-tt-color-swatch" style={{ background: fColor }} />
          <input type="color" className="fb-tt-color-hidden" value={fColor}
            onChange={e => setFColor(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

// ─── Área de Descrição clicável ───────────────────────────────────────────────
function DescricaoArea({ descricaoData, onChange }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const text     = descricaoData?.text     || "";
  const fontSize = descricaoData?.fontSize || 14;
  const color    = descricaoData?.color    || "#374151";
  const align    = descricaoData?.align    || "left";

  return (
    <div className="metas-descricao-wrapper">
      <div
        className={`metas-descricao-display ${!text ? 'metas-descricao-vazia' : ''}`}
        style={{ fontSize: `${fontSize}px`, color, textAlign: align }}
        onClick={() => setTooltipOpen(o => !o)}
        title="Clique para editar descrição"
      >
        <span style={{ whiteSpace: 'pre-wrap' }}>{text || "Clique para adicionar uma descrição para esta tabela de metas…"}</span>
        <span className="fb-text-click-hint">✎</span>
      </div>

      {tooltipOpen && (
        <DescricaoTooltip
          valor={text}
          fontSize={fontSize}
          color={color}
          align={align}
          onChange={(novosDados) => { onChange(novosDados); setTooltipOpen(false); }}
          onClose={() => setTooltipOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Metas({
  notaId,
  projectId,
  usuarioId,
  projetoNome,
  notaNome,
  onClose,
  containerAtual,   // ← igual ao AtaObjetivos — { id: "..." }
}) {
  const [metas, setMetas]                               = useState([]);
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState({});
  const [inputResponsavel, setInputResponsavel]         = useState({});
  const [editandoComentario, setEditandoComentario]     = useState({});
  const [comentarioTemp, setComentarioTemp]             = useState({});
  const [meuNome, setMeuNome]                           = useState("Você");
  const [salvando, setSalvando]                         = useState(false);
  const [novoMetaTexto, setNovoMetaTexto]               = useState("");
  const [editingResponsavelId, setEditingResponsavelId] = useState(null);
  const [colorPickerMetaId, setColorPickerMetaId]       = useState(null);
  const [descricaoData, setDescricaoData]               = useState({ text: "", fontSize: 14, color: "#374151", align: "left" });
  const [salvandoDesc, setSalvandoDesc]                 = useState(false);
  const descTimerRef = useRef(null);
  const cardRef      = useRef(null);

  // ── Nome do usuário ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!usuarioId) return;
    supabase.from("profiles").select("nome").eq("id", usuarioId).single()
      .then(({ data }) => { if (data?.nome) setMeuNome(data.nome); });
  }, [usuarioId]);

  // ── Descrição (JSON armazenado na coluna descricao) ──────────────────────
  useEffect(() => {
    if (!notaId) return;
    supabase.from("notas").select("descricao").eq("id", notaId).single()
      .then(({ data }) => {
        if (!data?.descricao) return;
        try {
          const parsed = typeof data.descricao === "string" ? JSON.parse(data.descricao) : data.descricao;
          if (parsed?.text !== undefined) {
            setDescricaoData(parsed);
          } else {
            setDescricaoData({ text: String(data.descricao), fontSize: 14, color: "#374151", align: "left" });
          }
        } catch {
          setDescricaoData({ text: String(data.descricao), fontSize: 14, color: "#374151", align: "left" });
        }
      });
  }, [notaId]);

  const salvarDescricao = useCallback(async (dados) => {
    if (!notaId) return;
    setSalvandoDesc(true);
    await supabase.from("notas").update({ descricao: JSON.stringify(dados) }).eq("id", notaId);
    setSalvandoDesc(false);
  }, [notaId]);

  const handleDescricaoChange = (novosDados) => {
    setDescricaoData(novosDados);
    clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => salvarDescricao(novosDados), 500);
  };

  // ── Metas ────────────────────────────────────────────────────────────────
  const carregarMetas = useCallback(async () => {
    if (!notaId) return setMetas([]);
    const { data: metasData, error } = await supabase
      .from("metas")
      .select(`*, metas_responsaveis(id, usuario_id, nome_externo)`)
      .eq("nota_id", notaId)
      .order("ordem", { ascending: true })
      .order("criado_em", { ascending: true });

    if (error) { console.error("Erro ao carregar metas:", error); return setMetas([]); }

    const enriquecidas = metasData.map(m => {
      const responsaveis = (m.metas_responsaveis || []).map(r => ({
        id: r.id, usuario_id: r.usuario_id, nome_externo: r.nome_externo,
        nome_exibicao: r.usuario_id ? "" : r.nome_externo, avatar_url: null,
      }));
      delete m.metas_responsaveis;
      return { ...m, responsaveis };
    });

    const idsInternos = enriquecidas.flatMap(m => m.responsaveis)
      .filter(r => r.usuario_id).map(r => r.usuario_id);

    if (idsInternos.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles").select("id, nome, avatar_url").in("id", idsInternos);
      const map = {};
      profiles?.forEach(p => { map[p.id] = p; });
      enriquecidas.forEach(m => m.responsaveis.forEach(r => {
        if (r.usuario_id && map[r.usuario_id]) {
          r.nome_exibicao = map[r.usuario_id].nome || "Usuário";
          r.avatar_url    = map[r.usuario_id].avatar_url || null;
        }
      }));
    }
    setMetas(enriquecidas);
  }, [notaId]);

  useEffect(() => { carregarMetas(); }, [carregarMetas]);

  const adicionarMeta = async () => {
    if (!novoMetaTexto.trim()) return;
    try {
      const maxOrdem = metas.reduce((max, m) => Math.max(max, m.ordem ?? 0), -1);
      const { error, data } = await supabase.from("metas").insert({
        nota_id: notaId, descricao: novoMetaTexto.trim(),
        data_entrega: null, concluido: false, concluido_em: null,
        comentario: "", ordem: maxOrdem + 1, cor: "#ffffff",
      }).select().single();
      if (error) throw error;
      setMetas(prev => [...prev, { ...data, responsaveis: [] }]);
      setNovoMetaTexto("");
    } catch (err) {
      console.error("Erro ao adicionar meta:", err);
      alert("Erro ao adicionar meta.");
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to   = result.destination.index;
    if (from === to) return;
    const novas = Array.from(metas);
    const [moved] = novas.splice(from, 1);
    novas.splice(to, 0, moved);
    setMetas(novas);
    for (let i = 0; i < novas.length; i++) {
      if (novas[i].id) await supabase.from("metas").update({ ordem: i }).eq("id", novas[i].id);
    }
  };

  const atualizarCor = async (id, cor) => {
    setMetas(prev => prev.map(m => m.id === id ? { ...m, cor } : m));
    setColorPickerMetaId(null);
    await supabase.from("metas").update({ cor }).eq("id", id);
  };

  // ── Responsáveis — MESMA lógica do AtaObjetivos (convites do container) ───
  const handleResponsavelInputChange = (e, metaId) => {
    const valor = e.target.value;
    setInputResponsavel(prev => ({ ...prev, [metaId]: valor }));

    if (valor.startsWith("@") && valor.length > 1) {
      const termo = valor.slice(1).toLowerCase();
      const cid   = containerAtual?.id;

      if (cid) {
        // Busca via tabela convites (igual AtaObjetivos)
        supabase.from("convites").select("user_id")
          .eq("container_id", cid).eq("status", "aceito")
          .then(async ({ data: convites, error: convErr }) => {
            if (convErr || !convites?.length)
              return setSugestoesResponsavel(prev => ({ ...prev, [metaId]: [] }));
            const userIds = convites.map(c => c.user_id).filter(Boolean);
            if (!userIds.length)
              return setSugestoesResponsavel(prev => ({ ...prev, [metaId]: [] }));
            const { data: profiles } = await supabase
              .from("profiles").select("id, nome, nickname, avatar_url").in("id", userIds);
            const filtrados = (profiles || []).filter(p =>
              p.nickname?.toLowerCase().includes(termo) || p.nome?.toLowerCase().includes(termo)
            );
            const seen = new Set();
            const unicos = filtrados.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
            setSugestoesResponsavel(prev => ({ ...prev, [metaId]: unicos.slice(0, 10) }));
          })
          .catch(() => setSugestoesResponsavel(prev => ({ ...prev, [metaId]: [] })));

      } else if (projectId) {
        // Fallback: project_members
        supabase.from("project_members").select("user_id").eq("project_id", projectId)
          .then(async ({ data: membros }) => {
            if (!membros?.length) return setSugestoesResponsavel(prev => ({ ...prev, [metaId]: [] }));
            const userIds = membros.map(m => m.user_id);
            const { data: profiles } = await supabase
              .from("profiles").select("id, nome, nickname, avatar_url").in("id", userIds);
            const filtrados = (profiles || []).filter(p =>
              p.nome?.toLowerCase().includes(termo) || p.nickname?.toLowerCase().includes(termo)
            );
            setSugestoesResponsavel(prev => ({ ...prev, [metaId]: filtrados.slice(0, 10) }));
          });
      }
    } else {
      setSugestoesResponsavel(prev => ({ ...prev, [metaId]: [] }));
    }
  };

  const adicionarResponsavelInterno = async (usuario, metaId) => {
    const meta = metas.find(m => m.id === metaId);
    if (!meta || meta.concluido || meta.responsaveis.some(r => r.usuario_id === usuario.id)) return;
    try {
      const { data } = await supabase.from("metas_responsaveis")
        .insert({ meta_id: metaId, usuario_id: usuario.id, nome_externo: null })
        .select().single();
      if (!data) return;
      setMetas(prev => prev.map(m => m.id === metaId
        ? { ...m, responsaveis: [...m.responsaveis, {
            id: data.id, usuario_id: usuario.id, nome_externo: null,
            nome_exibicao: usuario.nome || usuario.nickname || "Usuário",
            avatar_url: usuario.avatar_url || null,
          }] }
        : m
      ));
      setInputResponsavel(prev => ({ ...prev, [metaId]: "" }));
      setSugestoesResponsavel(prev => ({ ...prev, [metaId]: [] }));
      setEditingResponsavelId(null);
    } catch (err) { console.error("Erro ao adicionar responsável interno:", err); }
  };

  const adicionarResponsavelExterno = async (nome, metaId) => {
    if (!nome.trim()) return;
    const meta = metas.find(m => m.id === metaId);
    if (!meta || meta.concluido || meta.responsaveis.some(r => r.nome_externo === nome && !r.usuario_id)) return;
    try {
      const { data } = await supabase.from("metas_responsaveis")
        .insert({ meta_id: metaId, nome_externo: nome.trim(), usuario_id: null })
        .select().single();
      if (!data) return;
      setMetas(prev => prev.map(m => m.id === metaId
        ? { ...m, responsaveis: [...m.responsaveis, {
            id: data.id, nome_externo: nome.trim(), usuario_id: null,
            nome_exibicao: nome.trim(), avatar_url: null,
          }] }
        : m
      ));
      setInputResponsavel(prev => ({ ...prev, [metaId]: "" }));
      setEditingResponsavelId(null);
    } catch (err) { console.error("Erro ao adicionar responsável externo:", err); }
  };

  const removerResponsavel = async (responsavelId, metaId) => {
    setMetas(prev => prev.map(m => m.id === metaId
      ? { ...m, responsaveis: m.responsaveis.filter(r => r.id !== responsavelId) }
      : m
    ));
    await supabase.from("metas_responsaveis").delete().eq("id", responsavelId);
  };

  const toggleConclusao = async (id, concluidoAtual) => {
    const novoValor = !concluidoAtual;
    setMetas(prev => prev.map(m => m.id === id ? { ...m, concluido: novoValor } : m));
    await supabase.from("metas").update({
      concluido: novoValor,
      concluido_em: novoValor ? new Date().toISOString() : null,
    }).eq("id", id);
  };

  const atualizarDataEntrega = async (id, data) => {
    setMetas(prev => prev.map(m => m.id === id ? { ...m, data_entrega: data } : m));
    await supabase.from("metas").update({ data_entrega: data || null }).eq("id", id);
  };

  const removerMeta = async (id) => {
    if (!window.confirm("Deseja realmente excluir esta meta?")) return;
    setMetas(prev => prev.filter(m => m.id !== id));
    await supabase.from("metas").delete().eq("id", id);
  };

  const iniciarEdicaoComentario = (id, comentarioAtual) => {
    let puro = comentarioAtual || "";
    if (puro.includes(" — Comentário por "))
      puro = puro.substring(0, puro.lastIndexOf(" — Comentário por "));
    setEditandoComentario(prev => ({ ...prev, [id]: true }));
    setComentarioTemp(prev => ({ ...prev, [id]: puro }));
  };

  const salvarComentario = async (id) => {
    const comentario = `${comentarioTemp[id] || ""} — Comentário por ${meuNome}`;
    setMetas(prev => prev.map(m => m.id === id ? { ...m, comentario } : m));
    setEditandoComentario(prev => ({ ...prev, [id]: false }));
    await supabase.from("metas").update({ comentario }).eq("id", id);
  };

  const progressoPercent = metas.length
    ? Math.round((metas.filter(m => m.concluido).length / metas.length) * 100) : 0;

  useEffect(() => {
    if (!colorPickerMetaId) return;
    const handler = (e) => {
      if (!e.target.closest('.color-picker-popover') && !e.target.closest('.icone-cor'))
        setColorPickerMetaId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colorPickerMetaId]);

  // ── Render ────────────────────────────────────────────────────────────────
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {onClose && (
                <button className="listagem-close-btn" onClick={onClose} aria-label="Fechar">
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
            {salvandoDesc && <span style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>salvando…</span>}
          </div>

          {/* Área de descrição com tooltip */}
          <DescricaoArea descricaoData={descricaoData} onChange={handleDescricaoChange} />

          {/* Barra de progresso */}
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progressoPercent}%` }} />
            <span className="progress-percent">{progressoPercent}%</span>
          </div>

          {/* Novo item */}
          <div className="objetivos-add-form">
            <input
              type="text"
              value={novoMetaTexto}
              onChange={(e) => setNovoMetaTexto(e.target.value)}
              placeholder="Digite uma nova meta..."
              onKeyDown={(e) => e.key === "Enter" && adicionarMeta()}
              disabled={salvando}
            />
            <button type="button" className="objetivos-add-btn"
              onClick={adicionarMeta} disabled={!novoMetaTexto.trim() || salvando}>
              Adicionar
            </button>
          </div>

          {/* Lista */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="metas-list">
              {(provided) => (
                <div className="objetivos-lista" ref={provided.innerRef} {...provided.droppableProps}>
                  {metas.map((meta, idx) => {
                    const isConcluido         = meta.concluido;
                    const podeDesmarcar       = podeDesmarcarConclusao(meta.concluido_em);
                    const isEditingComentario = editandoComentario[meta.id];
                    const corLinha            = meta.cor || "#ffffff";

                    return (
                      <Draggable key={String(meta.id)} draggableId={String(meta.id)} index={idx} isDragDisabled={isConcluido}>
                        {(prov, snapshot) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            className={`objetivo-item1 ${isConcluido ? 'objetivo-concluido' : ''} ${snapshot.isDragging ? 'meta-dragging' : ''}`}
                            style={{
                              ...prov.draggableProps.style,
                              backgroundColor: corLinha,
                              opacity: snapshot.isDragging ? 0.85 : 1,
                            }}
                          >
                            {!isConcluido && (
                              <span {...prov.dragHandleProps} className="meta-drag-handle" title="Arrastar">
                                <FaGripVertical />
                              </span>
                            )}

                            <input
                              type="checkbox"
                              checked={isConcluido}
                              onChange={() => toggleConclusao(meta.id, isConcluido)}
                              disabled={isConcluido && !podeDesmarcar}
                            />

                            <span><strong>{idx + 1}.</strong> {meta.descricao}</span>

                            {/* Chips */}
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

                            {/* Ações direita */}
                            <div className="objetivo-acao-direita">
                              {!isConcluido && (
                                <span className="icone-editar" title="Editar meta"
                                  onClick={() => {
                                    const novo = prompt("Editar meta:", meta.descricao);
                                    if (novo !== null && novo.trim() && novo.trim() !== meta.descricao) {
                                      setMetas(prev => prev.map(m => m.id === meta.id ? { ...m, descricao: novo.trim() } : m));
                                      supabase.from("metas").update({ descricao: novo.trim() }).eq("id", meta.id);
                                    }
                                  }}>
                                  <FontAwesomeIcon icon={faPenToSquare} />
                                </span>
                              )}

                              {!isConcluido && (
                                <span className="icone-add-resp" title="Adicionar responsável"
                                  onClick={() => setEditingResponsavelId(meta.id)}>
                                  <FontAwesomeIcon icon={faUserPlus} />
                                </span>
                              )}

                              {!isConcluido && (
                                <span className="icone-cor" title="Mudar cor da linha"
                                  style={{ color: corLinha === "#ffffff" ? "#aaa" : corLinha }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setColorPickerMetaId(colorPickerMetaId === meta.id ? null : meta.id);
                                  }}>
                                  <FontAwesomeIcon icon={faPalette} />
                                </span>
                              )}

                              {colorPickerMetaId === meta.id && (
                                <div className="color-picker-popover" onClick={e => e.stopPropagation()}>
                                  {CORES_PREDEFINIDAS.map(cor => (
                                    <div key={cor}
                                      className={`color-swatch ${corLinha === cor ? 'color-swatch--ativo' : ''}`}
                                      style={{ backgroundColor: cor }}
                                      onClick={() => atualizarCor(meta.id, cor)}
                                    />
                                  ))}
                                </div>
                              )}

                              {editingResponsavelId === meta.id && !isConcluido && (
                                <div className="input-responsavel-flutuante">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Nome ou @menção"
                                    value={inputResponsavel[meta.id] || ""}
                                    onChange={(e) => handleResponsavelInputChange(e, meta.id)}
                                    onBlur={() => setTimeout(() => setEditingResponsavelId(null), 200)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        const valor = inputResponsavel[meta.id] || "";
                                        if (!valor.startsWith("@")) adicionarResponsavelExterno(valor, meta.id);
                                      } else if (e.key === "Escape") {
                                        setEditingResponsavelId(null);
                                      }
                                    }}
                                    disabled={salvando}
                                  />
                                  {sugestoesResponsavel[meta.id]?.length > 0 && (
                                    <div className="sugestoes-list-flutuante">
                                      {sugestoesResponsavel[meta.id].map(item => (
                                        <div key={item.id} className="sugestao-item"
                                          onClick={() => adicionarResponsavelInterno(item, meta.id)}>
                                          @{item.nickname || item.nome}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Ações (data, comentário, excluir) */}
                            <div className="objetivo-acao">
                              {!isConcluido && (
                                <label className="objetivo-data-entrega"
                                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
                                  {meta.data_entrega
                                    ? <>{formatarDataParaExibicao(meta.data_entrega)}<FontAwesomeIcon icon={faCalendar} style={{ fontSize: '12px', color: '#555' }} /></>
                                    : <FontAwesomeIcon icon={faCalendar} style={{ fontSize: '14px', color: '#555' }} />
                                  }
                                  <input type="date"
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
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
                                <span className="objetivo-excluir" onClick={() => removerMeta(meta.id)}>×</span>
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
                                  <button className="btn-comentario-salvar" onClick={() => salvarComentario(meta.id)}>Salvar</button>
                                  <button className="btn-comentario-cancelar" onClick={() => setEditandoComentario(prev => ({ ...prev, [meta.id]: false }))}>Cancelar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
}