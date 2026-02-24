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

  // Pavimentos e EAP editáveis
  const [pavimentosEdit, setPavimentosEdit] = useState(
    (entity.pavimentos || []).map((p) => ({
      id: p?.id ?? null,
      nome: typeof p === "string" ? p : (p?.name ?? p?.nome ?? ""),
      _tempId: Math.random(),
    }))
  );
  const [eapEdit, setEapEdit] = useState(
    (entity.eap || []).map((e) => ({
      id: e?.id ?? null,
      nome: typeof e === "string" ? e : (e?.name ?? e?.nome ?? ""),
      orcamento_base: e?.orcamento_base ?? null,
      _tempId: Math.random(),
    }))
  );
  const [novoPavimento, setNovoPavimento] = useState("");
  const [novoEap, setNovoEap]             = useState("");

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

  const totalEap = eapEdit.reduce((acc, e) => {
    const key = e.id ?? e._tempId;
    const raw = eapValores[key] ?? (e.orcamento_base != null ? String(e.orcamento_base) : "");
    const n = parseFloat(String(raw).replace(/\./g, "").replace(",", "."));
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
      // 1. Atualiza datas, engenheiro e membros no projeto
      const updateProject = {
        data_inicio:      form.data_inicio      || null,
        data_finalizacao: form.data_finalizacao || null,
        engenheiro_id:    form.engenheiro_id    || null,
        indice_incc_inicio:  inccInicio?.indice  ?? null,
        indice_incc_atual:   inccAtual?.indice   ?? null,
        orcamento_corrigido: totalCorrigido       ?? null,
      };
      const { error: errProj } = await supabase
        .from("projects")
        .update(updateProject)
        .eq("id", entity.id);
      if (errProj) throw errProj;

      // 2. Sincroniza Pavimentos
      // Deleta os removidos (ids que existiam e não estão mais na lista)
      const idsOrigPav = (entity.pavimentos || []).map((p) => p?.id).filter(Boolean);
      const idsAtualPav = pavimentosEdit.map((p) => p.id).filter(Boolean);
      const idsRemovidosPav = idsOrigPav.filter((id) => !idsAtualPav.includes(id));
      if (idsRemovidosPav.length > 0) {
        await supabase.from("pavimentos").delete().in("id", idsRemovidosPav);
      }
      // Atualiza existentes e insere novos
      for (let i = 0; i < pavimentosEdit.length; i++) {
        const p = pavimentosEdit[i];
        if (p.id) {
          await supabase.from("pavimentos").update({ name: p.nome, ordem: i }).eq("id", p.id);
        } else {
          await supabase.from("pavimentos").insert({ name: p.nome, project_id: entity.id, ordem: i });
        }
      }

      // 3. Sincroniza EAP
      const idsOrigEap = (entity.eap || []).map((e) => e?.id).filter(Boolean);
      const idsAtualEap = eapEdit.map((e) => e.id).filter(Boolean);
      const idsRemovidosEap = idsOrigEap.filter((id) => !idsAtualEap.includes(id));
      if (idsRemovidosEap.length > 0) {
        await supabase.from("eap").delete().in("id", idsRemovidosEap);
      }
      for (let i = 0; i < eapEdit.length; i++) {
        const e = eapEdit[i];
        const raw = eapValores[e.id ?? e._tempId] ?? "";
        const val = parseFloat(String(raw).replace(/\./g, "").replace(",", "."));
        const orcBase = isNaN(val) ? (e.orcamento_base ?? null) : val;
        if (e.id) {
          await supabase.from("eap").update({ name: e.nome, ordem: i, orcamento_base: orcBase }).eq("id", e.id);
        } else {
          await supabase.from("eap").insert({ name: e.nome, project_id: entity.id, ordem: i, orcamento_base: orcBase });
        }
      }

      onSave({
        ...entity,
        ...updateProject,
        membrosSelecionados,
        orcamento_corrigido: totalCorrigido,
        pavimentos: pavimentosEdit.map((p) => ({ id: p.id, name: p.nome })),
        eap: eapEdit.map((e) => ({ id: e.id, name: e.nome })),
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

          {/* ── Pavimentos ── */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Pavimentos</p>
            <div className="ed-modal-list-edit">
              {pavimentosEdit.map((p, i) => (
                <div key={p._tempId} className="ed-modal-list-item">
                  <input
                    className="ed-modal-list-input"
                    value={p.nome}
                    onChange={(ev) => setPavimentosEdit((prev) => {
                      const n = [...prev]; n[i] = { ...n[i], nome: ev.target.value }; return n;
                    })}
                    placeholder="Nome do pavimento"
                  />
                  <button
                    className="ed-modal-list-del"
                    onClick={() => setPavimentosEdit((prev) => prev.filter((_, idx) => idx !== i))}
                    title="Remover"
                  >×</button>
                </div>
              ))}
              <div className="ed-modal-list-add">
                <input
                  className="ed-modal-list-input"
                  placeholder="+ Novo pavimento"
                  value={novoPavimento}
                  onChange={(e) => setNovoPavimento(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novoPavimento.trim()) {
                      setPavimentosEdit((prev) => [...prev, { id: null, nome: novoPavimento.trim(), _tempId: Math.random() }]);
                      setNovoPavimento("");
                    }
                  }}
                />
                <button
                  className="ed-modal-list-btn"
                  onClick={() => {
                    if (!novoPavimento.trim()) return;
                    setPavimentosEdit((prev) => [...prev, { id: null, nome: novoPavimento.trim(), _tempId: Math.random() }]);
                    setNovoPavimento("");
                  }}
                >Adicionar</button>
              </div>
            </div>
          </div>

          {/* ── EAP ── */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Itens da EAP</p>
            <div className="ed-modal-list-edit">
              {eapEdit.map((e, i) => (
                <div key={e._tempId} className="ed-modal-list-item">
                  <input
                    className="ed-modal-list-input"
                    value={e.nome}
                    onChange={(ev) => setEapEdit((prev) => {
                      const n = [...prev]; n[i] = { ...n[i], nome: ev.target.value }; return n;
                    })}
                    placeholder="Nome da EAP"
                  />
                  <button
                    className="ed-modal-list-del"
                    onClick={() => setEapEdit((prev) => prev.filter((_, idx) => idx !== i))}
                    title="Remover"
                  >×</button>
                </div>
              ))}
              <div className="ed-modal-list-add">
                <input
                  className="ed-modal-list-input"
                  placeholder="+ Novo item EAP"
                  value={novoEap}
                  onChange={(e) => setNovoEap(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novoEap.trim()) {
                      setEapEdit((prev) => [...prev, { id: null, nome: novoEap.trim(), orcamento_base: null, _tempId: Math.random() }]);
                      setNovoEap("");
                    }
                  }}
                />
                <button
                  className="ed-modal-list-btn"
                  onClick={() => {
                    if (!novoEap.trim()) return;
                    setEapEdit((prev) => [...prev, { id: null, nome: novoEap.trim(), orcamento_base: null, _tempId: Math.random() }]);
                    setNovoEap("");
                  }}
                >Adicionar</button>
              </div>
            </div>
          </div>

          {/* EAP com valores de orçamento */}
          {eapEdit.length > 0 && (
            <div className="ed-modal-section">
              <p className="ed-modal-section-title">Orçamento por EAP (valores na data de início)</p>
              <div className="ed-modal-eap-list">
                {eapEdit.map((e, i) => {
                  const key = e.id ?? e._tempId;
                  return (
                    <div key={key} className="ed-modal-eap-row">
                      <span className="ed-modal-eap-nome">{e.nome}</span>
                      <div className="ed-modal-eap-input-wrap">
                        <span className="ed-modal-eap-prefix">R$</span>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={eapValores[key] ?? (e.orcamento_base != null ? String(e.orcamento_base).replace(".", ",") : "")}
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
  const [eapComValores, setEapComValores] = useState([]);

  // ✅ FIX: sincroniza quando troca de projeto na sidebar
  useEffect(() => {
    setEntity(entityProp);
    setShowModal(false);
    setEngenheiro(null);
    setEapComValores([]);
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
  // orcamentoBase exibido = soma das EAPs (se disponível) ou campo do projeto
  const variacaoOrcamento  =
    orcamentoBase && orcamentoCorrigido && orcamentoBase > 0
      ? (((orcamentoCorrigido - orcamentoBase) / orcamentoBase) * 100).toFixed(2)
      : null;

  // Carrega valores de orcamento_base das EAPs
  useEffect(() => {
    if (!isProject || !eap?.length) { setEapComValores(eap); return; }
    const ids = eap.map((e) => e?.id).filter(Boolean);
    if (!ids.length) { setEapComValores(eap); return; }
    supabase.from("eap").select("id, orcamento_base").in("id", ids)
      .then(({ data }) => {
        if (!data) { setEapComValores(eap); return; }
        const map = {};
        data.forEach((r) => { map[r.id] = r.orcamento_base; });
        setEapComValores(eap.map((e) => ({
          ...e,
          orcamento_base: map[e.id] ?? e.orcamento_base ?? null,
        })));
      })
      .catch(() => setEapComValores(eap));
  }, [isProject, entity.id]);

  // Carrega orcamento_base das EAPs do banco
  useEffect(() => {
    if (!isProject || !eap?.length) { setEapComValores(eap); return; }
    const ids = eap.map((e) => e?.id).filter(Boolean);
    if (!ids.length) { setEapComValores(eap); return; }
    supabase.from("eap").select("id, orcamento_base").in("id", ids)
      .then(({ data }) => {
        if (!data) { setEapComValores(eap); return; }
        const map = {};
        data.forEach((r) => { map[r.id] = r.orcamento_base; });
        setEapComValores(eap.map((e) => ({
          ...e,
          orcamento_base: map[e.id] ?? e.orcamento_base ?? null,
        })));
      })
      .catch(() => setEapComValores(eap));
  }, [isProject, entity.id]);

  // Soma de todos os EAPs = orçamento base real
  const orcamentoBaseCalculado = eapComValores.length > 0
    ? eapComValores.reduce((acc, e) => acc + (Number(e.orcamento_base) || 0), 0)
    : null;
  const orcamentoBaseExibir = (orcamentoBaseCalculado && orcamentoBaseCalculado > 0)
    ? orcamentoBaseCalculado
    : (entity.orcamento_base ?? null);

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

              {/* Orçamento — sempre visível para projetos */}
              <div className="ed-block">
                <p className="ed-block-title">Orçamento da Obra</p>
                <div className="ed-budget">
                  <div className="ed-budget-col">
                    <span className="ed-budget-lbl">Base (soma EAPs)</span>
                    <span className="ed-budget-val">
                      {(orcamentoBaseCalculado || orcamentoBase)
                        ? formatarMoeda(orcamentoBaseCalculado || orcamentoBase)
                        : <span className="ed-budget-vazio">Preencha os valores no lápis ✏️</span>}
                    </span>
                  </div>
                  {variacaoOrcamento != null && (
                    <span className={`ed-variacao ${Number(variacaoOrcamento) >= 0 ? "ed-variacao--pos" : "ed-variacao--neg"}`}>
                      {Number(variacaoOrcamento) >= 0 ? "▲" : "▼"} {Math.abs(variacaoOrcamento)}%
                    </span>
                  )}
                  <div className="ed-budget-col ed-budget-col--right">
                    <span className="ed-budget-lbl">Corrigido (INCC)</span>
                    <span className="ed-budget-val ed-budget-val--dest">
                      {orcamentoCorrigido ? formatarMoeda(orcamentoCorrigido) : <span className="ed-budget-vazio">—</span>}
                    </span>
                  </div>
                </div>
                {entity.indice_incc_inicio && entity.indice_incc_atual && (
                  <p className="ed-budget-hint">
                    INCC ref.: {Number(entity.indice_incc_inicio).toLocaleString("pt-BR", { minimumFractionDigits: 3 })} →{" "}
                    {Number(entity.indice_incc_atual).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}
                  </p>
                )}
              </div>

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
                    {eapComValores.length > 0 && (
                      <div className="project-section">
                        <h3>EAP</h3>
                        <ul>
                          {eapComValores.map((e, i) => (
                            <li key={e?.id ?? i} className="ed-eap-display-li">
                              <span>{extrairTexto(e)}</span>
                              {e?.orcamento_base != null && Number(e.orcamento_base) > 0 && (
                                <span className="ed-eap-display-val">
                                  {formatarMoeda(e.orcamento_base)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {orcamentoBaseCalculado > 0 && (
                          <div className="ed-eap-section-total">
                            <span>Total EAP</span>
                            <strong>{formatarMoeda(orcamentoBaseCalculado)}</strong>
                          </div>
                        )}
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