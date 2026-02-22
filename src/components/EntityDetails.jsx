// src/components/EntityDetails.jsx
import React, { useState, useEffect, useRef } from "react";
import { FaArrowLeft, FaTimes, FaSave, FaEdit } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./EntityDetails.css";

const INCC_API_URL = "https://incc-api.onrender.com";

const getConsistentColor = (str) => {
  if (!str) return "#81C784";
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 60%)`;
};

const formatarData = (data) => {
  if (!data) return "Não definida";
  const d = new Date(data);
  return isNaN(d.getTime()) ? "Data inválida" : d.toLocaleDateString("pt-BR");
};

const formatarMoeda = (valor) => {
  if (valor == null || valor === "") return "—";
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const extrairTexto = (item) => {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.name ?? item.nome ?? "";
};

// Converte string "Jan/2024" para Date
const parseMesAno = (mesAno) => {
  if (!mesAno) return null;
  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const [mes, ano] = mesAno.split("/");
  const idx = MESES.findIndex((m) => m.toLowerCase() === mes.toLowerCase());
  if (idx === -1 || !ano) return null;
  return new Date(parseInt(ano), idx, 1);
};

// Encontra o índice INCC mais próximo a uma data
const encontrarIndiceParaData = (historico, data) => {
  if (!historico?.length || !data) return null;
  const target = new Date(data);
  let melhor = null;
  let menorDiff = Infinity;
  for (const row of historico) {
    const d = parseMesAno(row.mes);
    if (!d) continue;
    const diff = Math.abs(d - target);
    if (diff < menorDiff) { menorDiff = diff; melhor = row; }
  }
  return melhor;
};

// ─── Modal de Edição do Projeto ───────────────────────────────────────────────
function ModalEdicao({ entity, eap, onClose, onSave, inccHistorico, containerId }) {
  const [form, setForm] = useState({
    data_inicio:      entity.data_inicio      ?? "",
    data_finalizacao: entity.data_finalizacao ?? "",
    engenheiro_id:    entity.engenheiro_id    ?? "",
  });
  const [membros, setMembros]             = useState([]);
  const [membrosSelecionados, setMembrosSelecionados] = useState(
    Array.isArray(entity.membrosSelecionados)
      ? entity.membrosSelecionados
      : Array.isArray(entity.membros)
      ? entity.membros
      : []
  );
  const [profiles, setProfiles]           = useState([]);
  const [eapValores, setEapValores]       = useState({});
  const [salvando, setSalvando]           = useState(false);
  const [erro, setErro]                   = useState("");

  // Carrega membros com convite ACEITO no container
  useEffect(() => {
    const fetchMembros = async () => {
      // Se não tiver containerId, tenta buscar via entity.container_id diretamente
      const cid = containerId || entity?.container_id;

      if (!cid) {
        // fallback: mostra todos os perfis se não tiver container_id
        const { data: todos } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url");
        if (todos) setProfiles(todos);
        return;
      }

      // Busca convites aceitos do container
      const { data: convites, error: convErr } = await supabase
        .from("convites")
        .select("user_id, nickname")
        .eq("container_id", cid)
        .eq("status", "aceito");

      if (convErr) {
        console.error("Erro ao buscar convites:", convErr);
        return;
      }

      if (!convites?.length) {
        console.warn("Nenhum convite aceito encontrado para container:", cid);
        return;
      }

      // Busca os perfis completos pelos user_ids
      const userIds = convites.map((c) => c.user_id).filter(Boolean);
      if (!userIds.length) return;

      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds);

      if (perfis) setProfiles(perfis);
    };
    fetchMembros();
  }, [containerId, entity?.container_id]);

  // Carrega orçamentos EAP já salvos
  useEffect(() => {
    if (!eap?.length) return;
    const ids = eap.map((e) => e?.id).filter(Boolean);
    if (!ids.length) return;
    supabase.from("eap").select("id, orcamento_base").in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        const vals = {};
        data.forEach((row) => {
          if (row.orcamento_base != null) {
            vals[row.id] = String(row.orcamento_base).replace(".", ",");
          }
        });
        setEapValores(vals);
      });
  }, [eap]);

  const totalEap = Object.values(eapValores).reduce((acc, v) => {
    const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);

  // Calcula INCC: índice na data de início e índice atual (último)
  const inccInicio  = encontrarIndiceParaData(inccHistorico, form.data_inicio);
  const inccAtual   = inccHistorico?.length ? inccHistorico[inccHistorico.length - 1] : null;
  const fatorIncc   = inccInicio && inccAtual ? inccAtual.indice / inccInicio.indice : null;
  const totalCorrigido = fatorIncc && totalEap > 0 ? totalEap * fatorIncc : null;
  const variacaoIncc   = fatorIncc ? ((fatorIncc - 1) * 100).toFixed(2) : null;

  const toggleMembro = (profile) => {
    setMembrosSelecionados((prev) => {
      const existe = prev.find((m) => m.id === profile.id);
      return existe ? prev.filter((m) => m.id !== profile.id) : [...prev, profile];
    });
  };

  const handleSave = async () => {
    setSalvando(true);
    setErro("");
    try {
      // 1. Atualiza datas e engenheiro no projeto
      const updateProject = {
        data_inicio:      form.data_inicio      || null,
        data_finalizacao: form.data_finalizacao || null,
        engenheiro_id:    form.engenheiro_id    || null,
        membros:          membrosSelecionados.map((m) => m.id),
        indice_incc_inicio:  inccInicio?.indice  ?? null,
        indice_incc_atual:   inccAtual?.indice   ?? null,
        orcamento_corrigido: totalCorrigido       ?? null,
      };
      const { error: errProj } = await supabase
        .from("projects")
        .update(updateProject)
        .eq("id", entity.id);
      if (errProj) throw errProj;

      // 2. Atualiza orcamento_base de cada EAP
      const updates = eap
        .filter((e) => e?.id)
        .map((e) => {
          const raw = eapValores[e.id] ?? "";
          const val = parseFloat(String(raw).replace(/\./g, "").replace(",", "."));
          return supabase.from("eap").update({ orcamento_base: isNaN(val) ? null : val }).eq("id", e.id);
        });
      await Promise.all(updates);

      onSave({
        ...entity,
        ...updateProject,
        membrosSelecionados,
        orcamento_corrigido: totalCorrigido,
      });
      onClose();
    } catch (err) {
      console.error(err);
      setErro("Erro ao salvar. Verifique os dados e tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="ed-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ed-modal">

        {/* Header */}
        <div className="ed-modal-header">
          <h3>Editar Projeto</h3>
          <button className="ed-modal-close" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="ed-modal-body">

          {/* Datas */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Período da Obra</p>
            <div className="ed-modal-row">
              <div className="ed-modal-field">
                <label>Data de Início</label>
                <input type="date" value={form.data_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div className="ed-modal-field">
                <label>Data de Término</label>
                <input type="date" value={form.data_finalizacao}
                  onChange={(e) => setForm((f) => ({ ...f, data_finalizacao: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Engenheiro */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Engenheiro Responsável</p>
            <select
              value={form.engenheiro_id}
              onChange={(e) => setForm((f) => ({ ...f, engenheiro_id: e.target.value }))}
              className="ed-modal-select"
            >
              <option value="">Selecione...</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.nickname}</option>
              ))}
            </select>
          </div>

          {/* Membros */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Membros do Projeto</p>
            <div className="ed-modal-profiles">
              {profiles.map((p) => {
                const sel = membrosSelecionados.some((m) => m.id === p.id);
                return (
                  <div
                    key={p.id}
                    className={`ed-modal-profile ${sel ? "ed-modal-profile--sel" : ""}`}
                    onClick={() => toggleMembro(p)}
                  >
                    <div className="ed-modal-profile-av">
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt={p.nickname} />
                        : p.nickname?.charAt(0).toUpperCase()
                      }
                    </div>
                    <span>{p.nickname}</span>
                    {sel && <span className="ed-modal-profile-check">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* EAP com valores */}
          {eap?.length > 0 && (
            <div className="ed-modal-section">
              <p className="ed-modal-section-title">Orçamento por EAP (valores na data de início)</p>
              <div className="ed-modal-eap-list">
                {eap.map((e, i) => {
                  const key = e?.id ?? i;
                  const texto = extrairTexto(e);
                  return (
                    <div key={key} className="ed-modal-eap-row">
                      <span className="ed-modal-eap-nome">{texto}</span>
                      <div className="ed-modal-eap-input-wrap">
                        <span className="ed-modal-eap-prefix">R$</span>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={eapValores[key] ?? ""}
                          onChange={(ev) =>
                            setEapValores((prev) => ({ ...prev, [key]: ev.target.value }))
                          }
                          className="ed-modal-eap-input"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resumo INCC */}
              <div className="ed-modal-incc-box">
                <div className="ed-modal-incc-row">
                  <span>Total base (soma EAPs)</span>
                  <strong>{formatarMoeda(totalEap || null)}</strong>
                </div>
                {inccInicio && (
                  <div className="ed-modal-incc-row ed-modal-incc-sub">
                    <span>INCC referência ({inccInicio.mes})</span>
                    <span>{inccInicio.indice?.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</span>
                  </div>
                )}
                {inccAtual && (
                  <div className="ed-modal-incc-row ed-modal-incc-sub">
                    <span>INCC atual ({inccAtual.mes})</span>
                    <span>{inccAtual.indice?.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</span>
                  </div>
                )}
                {fatorIncc && (
                  <div className="ed-modal-incc-row ed-modal-incc-sub">
                    <span>Fator de correção</span>
                    <span>{fatorIncc.toFixed(6)}</span>
                  </div>
                )}
                {variacaoIncc && (
                  <div className="ed-modal-incc-row ed-modal-incc-sub">
                    <span>Variação INCC no período</span>
                    <span className={Number(variacaoIncc) >= 0 ? "ed-pos" : "ed-neg"}>
                      {Number(variacaoIncc) >= 0 ? "+" : ""}{variacaoIncc}%
                    </span>
                  </div>
                )}
                {totalCorrigido != null && (
                  <div className="ed-modal-incc-row ed-modal-incc-destaque">
                    <span>Total corrigido pelo INCC</span>
                    <strong>{formatarMoeda(totalCorrigido)}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {erro && <p className="ed-modal-erro">{erro}</p>}
        </div>

        {/* Footer */}
        <div className="ed-modal-footer">
          <button className="ed-modal-btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="ed-modal-btn-save" onClick={handleSave} disabled={salvando}>
            <FaSave /> {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EntityDetails principal ────────────────────────────────────────────────
export default function EntityDetails({
  entityType,
  entity: entityProp,
  onBack,
  onEdit,
  children,
  canEdit = false,
}) {
  const isProject = entityType === "project";
  const [entity, setEntity] = useState(entityProp);
  const [showModal, setShowModal]         = useState(false);
  const [engenheiro, setEngenheiro]       = useState(null);
  const [stats, setStats]                 = useState({ tarefasTotal: 0, tarefasResolvidas: 0, atas: 0, listagens: 0, diarios: 0 });
  const [loadingStats, setLoadingStats]   = useState(true);
  const [inccHistorico, setInccHistorico] = useState([]);

  // ✅ FIX: sincroniza quando troca de projeto na sidebar
  useEffect(() => {
    setEntity(entityProp);
    setShowModal(false);
    setEngenheiro(null);
    setStats({ tarefasTotal: 0, tarefasResolvidas: 0, atas: 0, listagens: 0, diarios: 0 });
    setLoadingStats(true);
  }, [entityProp?.id]);

  const name = entity.name || (isProject ? "Projeto" : "Setor");

  const dataInicio      = isProject ? entity.data_inicio      : null;
  const dataFinalizacao = isProject ? entity.data_finalizacao : null;
  const pavimentos      = isProject ? entity.pavimentos || [] : [];
  const eap             = isProject ? entity.eap        || [] : [];
  const membros = isProject
    ? Array.isArray(entity.membrosSelecionados)
      ? entity.membrosSelecionados
      : Array.isArray(entity.membros)
      ? entity.membros
      : []
    : [];

  const orcamentoBase      = entity.orcamento_base      ?? null;
  const orcamentoCorrigido = entity.orcamento_corrigido ?? null;
  const variacaoOrcamento  =
    orcamentoBase && orcamentoCorrigido && orcamentoBase > 0
      ? (((orcamentoCorrigido - orcamentoBase) / orcamentoBase) * 100).toFixed(2)
      : null;

  // Carrega histórico INCC
  useEffect(() => {
    fetch(`${INCC_API_URL}/incc`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setInccHistorico(json.data.historico); })
      .catch(() => {});
  }, []);

  // Carrega engenheiro
  useEffect(() => {
    if (!isProject) return;
    const id = entity.engenheiro_id;
    if (!id) { setEngenheiro(null); return; }
    supabase.from("profiles").select("id, nickname, avatar_url").eq("id", id).single()
      .then(({ data, error }) => { if (!error) setEngenheiro(data); })
      .catch(() => setEngenheiro(null));
  }, [isProject, entity.engenheiro_id]);

  // Carrega stats via pilhas → notas
  useEffect(() => {
    if (!isProject || !entity.id) { setLoadingStats(false); return; }
    const pid = entity.id;
    setLoadingStats(true);
    const fetchStats = async () => {
      try {
        const { data: pilhas } = await supabase.from("pilhas").select("id").eq("project_id", pid);
        if (!pilhas?.length) { setLoadingStats(false); return; }
        const pilhaIds = pilhas.map((p) => p.id);
        const { data: notas } = await supabase.from("notas").select("id, tipo, concluida").in("pilha_id", pilhaIds);
        if (!notas) { setLoadingStats(false); return; }
        const tarefas = notas.filter((n) => n.tipo === "Tarefas");
        setStats({
          tarefasTotal:      tarefas.length,
          tarefasResolvidas: tarefas.filter((n) => n.concluida).length,
          atas:      notas.filter((n) => n.tipo === "Atas").length,
          listagens: notas.filter((n) => n.tipo === "Lista").length,
          diarios:   notas.filter((n) => n.tipo === "Diário de Obra").length,
        });
      } catch (err) { console.error(err); }
      finally { setLoadingStats(false); }
    };
    fetchStats();
  }, [isProject, entity.id]);

  const progresso = stats.tarefasTotal > 0
    ? Math.round((stats.tarefasResolvidas / stats.tarefasTotal) * 100) : 0;

  const handleSaved = (updated) => {
    setEntity(updated);
    if (onEdit) onEdit(updated);
  };

  return (
    <>
      <div className="ed-card">

        {/* ══ CABEÇALHO ══ */}
        <div className="ed-header">
          <button className="ed-back" onClick={onBack} title="Voltar">
            <FaArrowLeft />
          </button>
          <div
            className="ed-avatar"
            style={{ backgroundColor: entity.photo_url ? undefined : getConsistentColor(entity.id) }}
          >
            {entity.photo_url
              ? <img src={entity.photo_url} alt={name} />
              : name.charAt(0).toUpperCase() || "?"
            }
          </div>
          <div className="ed-header-text">
            <h2 className="ed-name">{name}</h2>
            {isProject && (
              <div className="ed-dates-row">
                <span className="ed-date-chip">
                  <span className="ed-date-chip-label">Início</span>
                  {formatarData(dataInicio)}
                </span>
                <span className="ed-date-sep">→</span>
                <span className="ed-date-chip">
                  <span className="ed-date-chip-label">Término</span>
                  {formatarData(dataFinalizacao)}
                </span>
              </div>
            )}
          </div>

          {/* Botão Editar no header — sempre visível para projetos */}
          {isProject && (
            <button className="ed-header-edit-btn" onClick={() => setShowModal(true)} title="Editar projeto">
              <FaEdit />
            </button>
          )}
        </div>

        {/* ══ CORPO ══ */}
        <div className="ed-body">
          {isProject && (
            <>
              {/* Engenheiro */}
              {engenheiro && (
                <div className="ed-block">
                  <p className="ed-block-title">Engenheiro Responsável</p>
                  <div className="ed-engineer">
                    <div className="ed-person-avatar" style={{ borderColor: "#28a745" }}>
                      {engenheiro.avatar_url
                        ? <img src={engenheiro.avatar_url} alt={engenheiro.nickname} />
                        : engenheiro.nickname?.charAt(0).toUpperCase() || "?"
                      }
                    </div>
                    <span className="ed-person-name">{engenheiro.nickname}</span>
                  </div>
                </div>
              )}

              {/* Membros */}
              {membros.length > 0 && (
                <div className="ed-block">
                  <p className="ed-block-title">Membros</p>
                  <div className="ed-membros">
                    {membros.map((m) => {
                      if (!m?.id) return null;
                      return (
                        <div key={m.id} className="ed-membro">
                          <div className="ed-person-avatar" style={{ borderColor: "#020a52" }}>
                            {m.avatar_url
                              ? <img src={m.avatar_url} alt={m.nickname} />
                              : m.nickname?.charAt(0).toUpperCase() || "?"
                            }
                          </div>
                          <span className="ed-membro-name">{m.nickname}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Progresso */}
              <div className="ed-block">
                <div className="ed-block-title-row">
                  <p className="ed-block-title">Progresso das Tarefas</p>
                  <span className="ed-pct">{loadingStats ? "..." : `${progresso}%`}</span>
                </div>
                <div className="ed-progress-track">
                  <div className="ed-progress-fill" style={{ width: `${progresso}%` }} />
                </div>
                <div className="ed-progress-sub">
                  <span>{stats.tarefasResolvidas} concluídas</span>
                  <span>{stats.tarefasTotal - stats.tarefasResolvidas} pendentes</span>
                  <span>{stats.tarefasTotal} total</span>
                </div>
              </div>

              {/* Resumo */}
              <div className="ed-block">
                <p className="ed-block-title">Resumo de Atividades</p>
                {loadingStats ? <p className="ed-loading">Carregando...</p> : (
                  <div className="ed-stats">
                    <div className="ed-stat">
                      <span className="ed-stat-num">{stats.tarefasResolvidas}<span className="ed-stat-den">/{stats.tarefasTotal}</span></span>
                      <span className="ed-stat-lbl">Tarefas</span>
                    </div>
                    <div className="ed-stat">
                      <span className="ed-stat-num">{stats.atas}</span>
                      <span className="ed-stat-lbl">Atas</span>
                    </div>
                    <div className="ed-stat">
                      <span className="ed-stat-num">{stats.listagens}</span>
                      <span className="ed-stat-lbl">Listagens</span>
                    </div>
                    <div className="ed-stat">
                      <span className="ed-stat-num">{stats.diarios}</span>
                      <span className="ed-stat-lbl">Diários de Obra</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Orçamento — exibição dos valores salvos */}
              {(orcamentoBase || orcamentoCorrigido) && (
                <div className="ed-block">
                  <p className="ed-block-title">Orçamento da Obra</p>
                  <div className="ed-budget">
                    <div className="ed-budget-col">
                      <span className="ed-budget-lbl">Base (soma EAPs)</span>
                      <span className="ed-budget-val">{formatarMoeda(orcamentoBase)}</span>
                    </div>
                    {variacaoOrcamento != null && (
                      <span className={`ed-variacao ${Number(variacaoOrcamento) >= 0 ? "ed-variacao--pos" : "ed-variacao--neg"}`}>
                        {Number(variacaoOrcamento) >= 0 ? "▲" : "▼"} {Math.abs(variacaoOrcamento)}%
                      </span>
                    )}
                    <div className="ed-budget-col ed-budget-col--right">
                      <span className="ed-budget-lbl">Corrigido (INCC)</span>
                      <span className="ed-budget-val ed-budget-val--dest">{formatarMoeda(orcamentoCorrigido)}</span>
                    </div>
                  </div>
                  {entity.indice_incc_inicio && entity.indice_incc_atual && (
                    <p className="ed-budget-hint">
                      INCC de referência: {entity.indice_incc_inicio?.toLocaleString("pt-BR", { minimumFractionDigits: 3 })} →{" "}
                      {entity.indice_incc_atual?.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}
                    </p>
                  )}
                </div>
              )}

              {/* Pavimentos + EAP — visual original */}
              {(pavimentos.length > 0 || eap.length > 0) && (
                <div className="ed-block">
                  <div className="project-sections">
                    {pavimentos.length > 0 && (
                      <div className="project-section">
                        <h3>Pavimentos</h3>
                        <ul>
                          {pavimentos.map((p, i) => (
                            <li key={p?.id ?? i}>{extrairTexto(p)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {eap.length > 0 && (
                      <div className="project-section">
                        <h3>EAP</h3>
                        <ul>
                          {eap.map((e, i) => (
                            <li key={e?.id ?? i} className="ed-eap-display-li">
                              <span>{extrairTexto(e)}</span>
                              {e?.orcamento_base != null && (
                                <span className="ed-eap-display-val">
                                  {formatarMoeda(e.orcamento_base)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {children && <div className="ed-children">{children}</div>}
        </div>
      </div>

      {/* Modal de edição */}
      {showModal && (
        <ModalEdicao
          entity={entity}
          eap={eap}
          onClose={() => setShowModal(false)}
          onSave={handleSaved}
          inccHistorico={inccHistorico}
          containerId={entity.container_id}
        />
      )}
    </>
  );
}