// src/components/EntityDetails.jsx
import React, { useState, useEffect, useRef } from "react";
import { FaArrowLeft, FaTimes, FaSave, FaEdit, FaGripVertical } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import dataTransferImage from "../assets/data-transfer.png";
import "./EntityDetails.css";

const INCC_API_URL = "https://incc-api.onrender.com";

/* ─── helpers ────────────────────────────────────────────────────────────── */
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
const parseMesAno = (mesAno) => {
  if (!mesAno) return null;
  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const [mes, ano] = mesAno.split("/");
  const idx = MESES.findIndex((m) => m.toLowerCase() === mes.toLowerCase());
  if (idx === -1 || !ano) return null;
  return new Date(parseInt(ano), idx, 1);
};
const encontrarIndiceParaData = (historico, data) => {
  if (!historico?.length || !data) return null;
  const target = new Date(data);
  let melhor = null, menorDiff = Infinity;
  for (const row of historico) {
    const d = parseMesAno(row.mes);
    if (!d) continue;
    const diff = Math.abs(d - target);
    if (diff < menorDiff) { menorDiff = diff; melhor = row; }
  }
  return melhor;
};

/* ─── busca membros do projeto (2 queries, sem join) ────────────────────── */
async function fetchMembrosDoProject(projectId) {
  if (!projectId) return [];
  // 1. busca os user_ids
  const { data: rows, error } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  if (error || !rows?.length) {
    if (error) console.error("[fetchMembros] project_members:", error);
    return [];
  }
  const ids = rows.map((r) => r.user_id).filter(Boolean);
  if (!ids.length) return [];
  // 2. busca os perfis em separado
  const { data: perfis, error: errP } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", ids);
  if (errP) { console.error("[fetchMembros] profiles:", errP); return []; }
  return perfis || [];
}

/* ─── salva membros (delete + insert) ───────────────────────────────────── */
async function saveMembros(projectId, membros, addedBy) {
  if (!projectId) return;

  console.log("[saveMembros] projectId:", projectId);
  console.log("[saveMembros] membros a salvar:", membros.map((m) => ({ id: m.id, nickname: m.nickname })));
  console.log("[saveMembros] addedBy:", addedBy);

  // DELETE
  const { error: delErr, count: delCount } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId);

  if (delErr) {
    console.error("[saveMembros] ERRO no DELETE:", delErr);
    throw new Error(`Erro ao remover membros antigos: ${delErr.message}`);
  }
  console.log("[saveMembros] DELETE ok, linhas removidas:", delCount);

  if (!membros.length) {
    console.log("[saveMembros] nenhum membro para inserir, fim.");
    return;
  }

  const inserts = membros.map((m) => ({
    project_id: projectId,
    user_id:    m.id,
    added_by:   addedBy || m.id,
  }));
  console.log("[saveMembros] INSERT payload:", inserts);

  const { data: insData, error: insErr } = await supabase
    .from("project_members")
    .insert(inserts)
    .select();

  if (insErr) {
    console.error("[saveMembros] ERRO no INSERT:", insErr);
    throw new Error(`Erro ao salvar membros: ${insErr.message}`);
  }
  console.log("[saveMembros] INSERT ok, linhas inseridas:", insData);
}

/* ─── Avatar com iniciais legíveis ──────────────────────────────────────── */
function hashColor(str) {
  if (!str) return { bg: "#4a6fa5", fg: "#ffffff" };
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  // lightness 38-48% → sempre escuro o suficiente para texto branco
  const sat = 50 + (Math.abs(h >> 4) % 20);
  const lig = 38 + (Math.abs(h >> 8) % 10);
  return { bg: `hsl(${hue},${sat}%,${lig}%)`, fg: "#ffffff" };
}

function ProjectAvatar({ name, photoUrl, size = 62 }) {
  const [err, setErr] = useState(false);
  const initials = (name || "?")
    .trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const { bg, fg } = hashColor(name);
  const fs = size <= 40 ? Math.round(size * 0.38) : Math.round(size * 0.34);

  const style = {
    width: size, height: size, minWidth: size, minHeight: size,
    borderRadius: "50%", border: "2.5px solid #bf9010",
    overflow: "hidden", flexShrink: 0, display: "flex",
    alignItems: "center", justifyContent: "center",
  };

  if (photoUrl && !err) {
    return (
      <div style={style}>
        <img
          src={photoUrl} alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setErr(true)}
        />
      </div>
    );
  }

  return (
    <div style={{ ...style, backgroundColor: bg, color: fg,
      fontSize: fs, fontWeight: 800, letterSpacing: "0px",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      userSelect: "none",
    }}>
      {initials}
    </div>
  );
}

/* ─── Drag sort hook ─────────────────────────────────────────────────────── */
function useDragSort(setItems) {
  const dragIndex = useRef(null);
  return {
    handleDragStart: (e, i) => { dragIndex.current = i; e.dataTransfer.effectAllowed = "move"; },
    handleDragOver:  (e)    => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
    handleDrop: (e, i) => {
      e.preventDefault();
      const from = dragIndex.current, to = i;
      if (from === null || from === to) return;
      setItems((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
      dragIndex.current = null;
    },
    handleDragEnd: () => { dragIndex.current = null; },
  };
}

/* ─── Popover Importar ───────────────────────────────────────────────────── */
function ImportarPopover({ containerId, currentProjectId, anchorRef, onImport, onClose }) {
  const popoverRef = useRef(null);
  const [projetos, setProjetos]           = useState([]);
  const [loadingProj, setLoadingProj]     = useState(true);
  const [projetoSel, setProjetoSel]       = useState(null);
  const [detalhes, setDetalhes]           = useState(null);
  const [loadingDet, setLoadingDet]       = useState(false);
  const [selPavimentos, setSelPavimentos] = useState([]);
  const [selEap, setSelEap]               = useState([]);
  const [step, setStep]                   = useState("projetos");
  const [pos, setPos]                     = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorRef?.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 8, left: Math.max(8, r.right + window.scrollX - 300) });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target) &&
          anchorRef?.current && !anchorRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  useEffect(() => {
    (async () => {
      setLoadingProj(true);
      try {
        let uid = containerId;
        if (!uid && currentProjectId) {
          const { data: p } = await supabase.from("projects").select("user_id").eq("id", currentProjectId).single();
          uid = p?.user_id;
        }
        if (!uid) return;
        const { data } = await supabase.from("projects").select("id, name").eq("user_id", uid).neq("id", currentProjectId).order("name");
        if (data) setProjetos(data);
      } finally { setLoadingProj(false); }
    })();
  }, [containerId, currentProjectId]);

  const selecionarProjeto = async (proj) => {
    setProjetoSel(proj); setStep("itens"); setLoadingDet(true);
    setSelPavimentos([]); setSelEap([]);
    try {
      const [{ data: pavs }, { data: eaps }] = await Promise.all([
        supabase.from("pavimentos").select("id, name, ordem").eq("project_id", proj.id).order("ordem"),
        supabase.from("eap").select("id, name, ordem, orcamento_base").eq("project_id", proj.id).order("ordem"),
      ]);
      setDetalhes({ pavimentos: pavs || [], eap: eaps || [] });
    } catch { setDetalhes({ pavimentos: [], eap: [] }); }
    finally { setLoadingDet(false); }
  };

  const togglePav = (id) => setSelPavimentos((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleEap = (id) => setSelEap((p)        => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const hasPavs = (detalhes?.pavimentos ?? []).length > 0;
  const hasEaps = (detalhes?.eap        ?? []).length > 0;
  const totalSel = selPavimentos.length + selEap.length;

  const handleImport = () => {
    const pav = (detalhes?.pavimentos ?? []).filter((p) => selPavimentos.includes(p.id)).map((p) => ({ id: null, nome: p.name, _tempId: Math.random() }));
    const eap = (detalhes?.eap        ?? []).filter((e) => selEap.includes(e.id)).map((e) => ({ id: null, nome: e.name, orcamento_base: e.orcamento_base ?? null, _tempId: Math.random() }));
    onImport({ pavimentos: pav, eap });
    onClose();
  };

  return (
    <div ref={popoverRef} className="imp-popover" style={{ top: pos.top, left: pos.left }}>
      <div className="imp-header">
        {step === "itens" && <button type="button" className="imp-nav-btn" onClick={() => { setStep("projetos"); setProjetoSel(null); setDetalhes(null); }}>‹</button>}
        <span className="imp-title">{step === "projetos" ? "Importar de outro projeto" : projetoSel?.name}</span>
        <button type="button" className="imp-nav-btn" onClick={onClose}>×</button>
      </div>
      <div className="imp-body">
        {step === "projetos" && (
          <>
            <p className="imp-hint">Escolha um projeto para copiar seus pavimentos e/ou EAP.</p>
            {loadingProj ? <div className="imp-loading">Carregando…</div>
              : projetos.length === 0 ? <div className="imp-empty">Nenhum outro projeto encontrado.</div>
              : <ul className="imp-proj-list">{projetos.map((p) => (
                  <li key={p.id} className="imp-proj-item" onClick={() => selecionarProjeto(p)}>
                    <span className="imp-proj-avatar">{p.name?.charAt(0).toUpperCase()}</span>
                    <span className="imp-proj-name">{p.name}</span>
                    <span className="imp-proj-arrow">›</span>
                  </li>
                ))}</ul>}
          </>
        )}
        {step === "itens" && (
          loadingDet ? <div className="imp-loading">Carregando…</div>
          : !hasPavs && !hasEaps ? <div className="imp-empty">Sem pavimentos ou EAP.</div>
          : <>
              {hasPavs && <div className="imp-group">
                <div className="imp-group-header">
                  <span className="imp-group-title">Pavimentos</span>
                  <div className="imp-group-actions">
                    <button type="button" className="imp-sel-btn" onClick={() => setSelPavimentos(detalhes.pavimentos.map((p) => p.id))}>Todos</button>
                    <button type="button" className="imp-sel-btn imp-sel-btn--ghost" onClick={() => setSelPavimentos([])}>Nenhum</button>
                  </div>
                </div>
                <ul className="imp-item-list">{detalhes.pavimentos.map((p) => (
                  <li key={p.id} className={`imp-item ${selPavimentos.includes(p.id) ? "imp-item--sel" : ""}`} onClick={() => togglePav(p.id)}>
                    <span className="imp-checkbox">{selPavimentos.includes(p.id) ? "✓" : ""}</span>
                    <span className="imp-item-name">{p.name}</span>
                  </li>
                ))}</ul>
              </div>}
              {hasEaps && <div className="imp-group">
                <div className="imp-group-header">
                  <span className="imp-group-title">EAP</span>
                  <div className="imp-group-actions">
                    <button type="button" className="imp-sel-btn" onClick={() => setSelEap(detalhes.eap.map((e) => e.id))}>Todos</button>
                    <button type="button" className="imp-sel-btn imp-sel-btn--ghost" onClick={() => setSelEap([])}>Nenhum</button>
                  </div>
                </div>
                <ul className="imp-item-list">{detalhes.eap.map((e) => (
                  <li key={e.id} className={`imp-item ${selEap.includes(e.id) ? "imp-item--sel" : ""}`} onClick={() => toggleEap(e.id)}>
                    <span className="imp-checkbox">{selEap.includes(e.id) ? "✓" : ""}</span>
                    <span className="imp-item-name">{e.name}</span>
                  </li>
                ))}</ul>
              </div>}
            </>
        )}
      </div>
      {step === "itens" && !loadingDet && (hasPavs || hasEaps) && (
        <div className="imp-footer">
          <span className="imp-sel-count">{totalSel === 0 ? "Nenhum selecionado" : `${totalSel} selecionado${totalSel > 1 ? "s" : ""}`}</span>
          <button type="button" className="imp-btn-import" disabled={totalSel === 0} onClick={handleImport}>Importar</button>
        </div>
      )}
    </div>
  );
}

/* ─── Modal de Edição ────────────────────────────────────────────────────── */
function ModalEdicao({ entity, eap, onClose, onSave, inccHistorico, containerId }) {
  const [form, setForm] = useState({
    data_inicio:      entity.data_inicio      ?? "",
    data_finalizacao: entity.data_finalizacao ?? "",
    engenheiro_id:    entity.engenheiro_id    ?? "",
  });
  const [membrosSelecionados, setMembrosSelecionados] = useState([]);
  const [profiles, setProfiles]     = useState([]);
  const [eapValores, setEapValores] = useState({});
  const [salvando, setSalvando]     = useState(false);
  const [erro, setErro]             = useState("");
  const [showImportPopover, setShowImportPopover] = useState(false);
  const importBtnRef = useRef(null);

  const [pavimentosEdit, setPavimentosEdit] = useState(
    (entity.pavimentos || []).map((p) => ({ id: p?.id ?? null, nome: typeof p === "string" ? p : (p?.name ?? p?.nome ?? ""), _tempId: Math.random() }))
  );
  const [eapEdit, setEapEdit] = useState(
    (entity.eap || []).map((e) => ({ id: e?.id ?? null, nome: typeof e === "string" ? e : (e?.name ?? e?.nome ?? ""), orcamento_base: e?.orcamento_base ?? null, _tempId: Math.random() }))
  );
  const [novoPavimento, setNovoPavimento] = useState("");
  const [novoEap, setNovoEap]             = useState("");
  const dragPav = useDragSort(setPavimentosEdit);
  const dragEap = useDragSort(setEapEdit);

  // ─── Avisos do projeto ────────────────────────────────────────────────────
  const DIAS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const [avisos, setAvisos]       = useState([]);
  const [novoAviso, setNovoAviso] = useState({ texto: "", dia_semana: "" });

  useEffect(() => {
    if (!entity?.id) return;
    supabase.from("project_avisos").select("*").eq("project_id", entity.id).then(({ data }) => {
      if (data) setAvisos(data);
    });
  }, [entity?.id]);

  const addAviso = () => {
    if (!novoAviso.texto.trim()) return;
    setAvisos((prev) => [...prev, {
      _tempId: Math.random(),
      project_id: entity.id,
      texto: novoAviso.texto.trim(),
      dia_semana: novoAviso.dia_semana !== "" ? parseInt(novoAviso.dia_semana) : null,
    }]);
    setNovoAviso({ texto: "", dia_semana: "" });
  };

  const removeAviso = (idx) => setAvisos((prev) => prev.filter((_, i) => i !== idx));

  /* Carrega perfis disponíveis */
  useEffect(() => {
    (async () => {
      const cid = containerId || entity?.container_id;
      if (!cid) {
        const { data } = await supabase.from("profiles").select("id, nickname, avatar_url");
        if (data) setProfiles(data);
        return;
      }
      const { data: convites } = await supabase.from("convites").select("user_id").eq("container_id", cid).eq("status", "aceito");
      if (!convites?.length) return;
      const ids = convites.map((c) => c.user_id).filter(Boolean);
      if (!ids.length) return;
      const { data: perfis } = await supabase.from("profiles").select("id, nickname, avatar_url").in("id", ids);
      if (perfis) setProfiles(perfis);
    })();
  }, [containerId, entity?.container_id]);

  /* Carrega membros já salvos → pré-marca checkboxes */
  useEffect(() => {
    if (!entity?.id) return;
    fetchMembrosDoProject(entity.id).then((membros) => {
      console.log("[ModalEdicao] membros carregados:", membros);
      setMembrosSelecionados(membros);
    });
  }, [entity?.id]);

  /* Valores de orçamento dos EAPs */
  useEffect(() => {
    if (!eap?.length) return;
    const ids = eap.map((e) => e?.id).filter(Boolean);
    if (!ids.length) return;
    supabase.from("eap").select("id, orcamento_base").in("id", ids).then(({ data }) => {
      if (!data) return;
      const vals = {};
      data.forEach((r) => { if (r.orcamento_base != null) vals[r.id] = String(r.orcamento_base).replace(".", ","); });
      setEapValores(vals);
    });
  }, [eap]);

  const totalEap = eapEdit.reduce((acc, e) => {
    const key = e.id ?? e._tempId;
    const raw = eapValores[key] ?? (e.orcamento_base != null ? String(e.orcamento_base) : "");
    const n = parseFloat(String(raw).replace(/\./g, "").replace(",", "."));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);

  const inccInicio     = encontrarIndiceParaData(inccHistorico, form.data_inicio);
  const inccAtual      = inccHistorico?.length ? inccHistorico[inccHistorico.length - 1] : null;
  const fatorIncc      = inccInicio && inccAtual ? inccAtual.indice / inccInicio.indice : null;
  const totalCorrigido = fatorIncc && totalEap > 0 ? totalEap * fatorIncc : null;
  const variacaoIncc   = fatorIncc ? ((fatorIncc - 1) * 100).toFixed(2) : null;

  const toggleMembro = (p) => setMembrosSelecionados((prev) =>
    prev.find((m) => m.id === p.id) ? prev.filter((m) => m.id !== p.id) : [...prev, p]
  );

  const handleSave = async () => {
    setSalvando(true); setErro("");
    try {
      /* 1. projeto */
      const updateProject = {
        data_inicio:         form.data_inicio      || null,
        data_finalizacao:    form.data_finalizacao || null,
        engenheiro_id:       form.engenheiro_id    || null,
        indice_incc_inicio:  inccInicio?.indice    ?? null,
        indice_incc_atual:   inccAtual?.indice     ?? null,
        orcamento_corrigido: totalCorrigido        ?? null,
      };
      const { error: errProj } = await supabase.from("projects").update(updateProject).eq("id", entity.id);
      if (errProj) throw errProj;

      /* 2. membros */
      const { data: { user } } = await supabase.auth.getUser();
      await saveMembros(entity.id, membrosSelecionados, user?.id);
      console.log("[handleSave] membros salvos:", membrosSelecionados.map((m) => m.id));

      /* 3. pavimentos */
      const idsOrigPav  = (entity.pavimentos || []).map((p) => p?.id).filter(Boolean);
      const idsAtualPav = pavimentosEdit.map((p) => p.id).filter(Boolean);
      const removPav    = idsOrigPav.filter((id) => !idsAtualPav.includes(id));
      if (removPav.length) await supabase.from("pavimentos").delete().in("id", removPav);
      for (let i = 0; i < pavimentosEdit.length; i++) {
        const p = pavimentosEdit[i];
        if (p.id) await supabase.from("pavimentos").update({ name: p.nome, ordem: i }).eq("id", p.id);
        else      await supabase.from("pavimentos").insert({ name: p.nome, project_id: entity.id, ordem: i });
      }

      /* 4. EAP */
      const idsOrigEap  = (entity.eap || []).map((e) => e?.id).filter(Boolean);
      const idsAtualEap = eapEdit.map((e) => e.id).filter(Boolean);
      const removEap    = idsOrigEap.filter((id) => !idsAtualEap.includes(id));
      if (removEap.length) await supabase.from("eap").delete().in("id", removEap);
      for (let i = 0; i < eapEdit.length; i++) {
        const e = eapEdit[i];
        const raw = eapValores[e.id ?? e._tempId] ?? "";
        const val = parseFloat(String(raw).replace(/\./g, "").replace(",", "."));
        const orcBase = isNaN(val) ? (e.orcamento_base ?? null) : val;
        if (e.id) await supabase.from("eap").update({ name: e.nome, ordem: i, orcamento_base: orcBase }).eq("id", e.id);
        else      await supabase.from("eap").insert({ name: e.nome, project_id: entity.id, ordem: i, orcamento_base: orcBase });
      }

      /* 5. Avisos */
      const { error: errDelAvisos } = await supabase
        .from("project_avisos").delete().eq("project_id", entity.id);
      if (errDelAvisos) {
        console.error("[handleSave] ERRO ao deletar avisos:", errDelAvisos);
        throw new Error(`Erro ao limpar avisos: ${errDelAvisos.message}`);
      }
      const avisosParaInserir = avisos.filter((a) => a.texto?.trim()).map((a) => ({
        project_id: entity.id,
        texto:      a.texto.trim(),
        dia_semana: a.dia_semana ?? null,
      }));
      console.log("[handleSave] avisos para inserir:", avisosParaInserir);
      if (avisosParaInserir.length) {
        const { error: errInsAvisos } = await supabase
          .from("project_avisos").insert(avisosParaInserir);
        if (errInsAvisos) {
          console.error("[handleSave] ERRO ao inserir avisos:", errInsAvisos);
          throw new Error(`Erro ao salvar avisos: ${errInsAvisos.message}`);
        }
        console.log("[handleSave] avisos salvos com sucesso:", avisosParaInserir.length);
      }

      onSave({
        ...entity, ...updateProject,
        _membrosAtualizados: membrosSelecionados,   // ← sinal para o pai recarregar
        pavimentos: pavimentosEdit.map((p) => ({ id: p.id, name: p.nome })),
        eap:        eapEdit.map((e)        => ({ id: e.id, name: e.nome })),
      });
      onClose();
    } catch (err) {
      console.error("[handleSave] erro:", err);
      setErro("Erro ao salvar. Verifique os dados e tente novamente.");
    } finally { setSalvando(false); }
  };

  return (
    <div className="ed-modal-overlay">
      <div className="ed-modal">
        <div className="ed-modal-header">
          <h3>Editar Projeto</h3>
          <button type="button" className="ed-modal-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="ed-modal-body">

          {/* Datas */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Período da Obra</p>
            <div className="ed-modal-row">
              <div className="ed-modal-field">
                <label>Data de Início</label>
                <input type="date" value={form.data_inicio} onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div className="ed-modal-field">
                <label>Data de Término</label>
                <input type="date" value={form.data_finalizacao} onChange={(e) => setForm((f) => ({ ...f, data_finalizacao: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Engenheiro */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Engenheiro Responsável</p>
            <select value={form.engenheiro_id} onChange={(e) => setForm((f) => ({ ...f, engenheiro_id: e.target.value }))} className="ed-modal-select">
              <option value="">Selecione...</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.nickname}</option>)}
            </select>
          </div>

          {/* Membros */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Membros do Projeto</p>
            <div className="ed-modal-profiles">
              {profiles.map((p) => {
                const sel = membrosSelecionados.some((m) => m.id === p.id);
                return (
                  <div key={p.id} className={`ed-modal-profile ${sel ? "ed-modal-profile--sel" : ""}`} onClick={() => toggleMembro(p)}>
                    <div className="ed-modal-profile-av">
                      {p.avatar_url ? <img src={p.avatar_url} alt={p.nickname} /> : p.nickname?.charAt(0).toUpperCase()}
                    </div>
                    <span>{p.nickname}</span>
                    {sel && <span className="ed-modal-profile-check">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Avisos do Projeto */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Avisos na Listagem</p>
            <p className="ed-modal-avisos-hint">Aparecem para todos os membros ao abrir a listagem fora do dia configurado.</p>
            <div className="ed-modal-list-edit">
              {avisos.map((a, i) => (
                <div key={a.id ?? a._tempId} className="ed-modal-aviso-item">
                  <select
                    className="ed-modal-aviso-dia"
                    value={a.dia_semana ?? ""}
                    onChange={(ev) => setAvisos((prev) => { const n=[...prev]; n[i]={...n[i], dia_semana: ev.target.value !== "" ? parseInt(ev.target.value) : null}; return n; })}
                  >
                    <option value="">Sempre</option>
                    {DIAS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                  </select>
                  <input
                    className="ed-modal-list-input"
                    value={a.texto}
                    onChange={(ev) => setAvisos((prev) => { const n=[...prev]; n[i]={...n[i], texto: ev.target.value}; return n; })}
                    placeholder="Texto do aviso..."
                  />
                  <button type="button" className="ed-modal-list-del" onClick={() => removeAviso(i)}>×</button>
                </div>
              ))}
              <div className="ed-modal-aviso-add">
                <select
                  className="ed-modal-aviso-dia"
                  value={novoAviso.dia_semana}
                  onChange={(e) => setNovoAviso((v) => ({ ...v, dia_semana: e.target.value }))}
                >
                  <option value="">Sempre</option>
                  {DIAS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                </select>
                <input
                  className="ed-modal-list-input"
                  placeholder="+ Novo aviso..."
                  value={novoAviso.texto}
                  onChange={(e) => setNovoAviso((v) => ({ ...v, texto: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAviso(); } }}
                />
                <button type="button" className="ed-modal-list-btn" onClick={addAviso}>Adicionar</button>
              </div>
            </div>
          </div>

          {/* Pavimentos */}
          <div className="ed-modal-section">
            <div className="ed-modal-section-import-header">
              <p className="ed-modal-section-title">Pavimentos</p>
              <button ref={importBtnRef} type="button" className="ed-modal-import-btn" onClick={() => setShowImportPopover((v) => !v)}>
                <img src={dataTransferImage} alt="" className="ed-modal-import-icon" /> Importar de outro projeto
              </button>
            </div>
            <div className="ed-modal-list-edit">
              {pavimentosEdit.map((p, i) => (
                <div key={p._tempId} className="ed-modal-list-item" draggable
                  onDragStart={(e) => dragPav.handleDragStart(e, i)} onDragOver={dragPav.handleDragOver}
                  onDrop={(e) => dragPav.handleDrop(e, i)} onDragEnd={dragPav.handleDragEnd}>
                  <span className="ed-drag-handle"><FaGripVertical /></span>
                  <input className="ed-modal-list-input" value={p.nome}
                    onChange={(ev) => setPavimentosEdit((prev) => { const n = [...prev]; n[i] = { ...n[i], nome: ev.target.value }; return n; })} placeholder="Nome do pavimento" />
                  <button type="button" className="ed-modal-list-del" onClick={() => setPavimentosEdit((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
                </div>
              ))}
              <div className="ed-modal-list-add">
                <input className="ed-modal-list-input" placeholder="+ Novo pavimento" value={novoPavimento}
                  onChange={(e) => setNovoPavimento(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && novoPavimento.trim()) { e.preventDefault(); setPavimentosEdit((prev) => [...prev, { id: null, nome: novoPavimento.trim(), _tempId: Math.random() }]); setNovoPavimento(""); }}} />
                <button type="button" className="ed-modal-list-btn" onClick={() => { if (!novoPavimento.trim()) return; setPavimentosEdit((prev) => [...prev, { id: null, nome: novoPavimento.trim(), _tempId: Math.random() }]); setNovoPavimento(""); }}>Adicionar</button>
              </div>
            </div>
          </div>

          {/* EAP */}
          <div className="ed-modal-section">
            <p className="ed-modal-section-title">Itens da EAP</p>
            <div className="ed-modal-list-edit">
              {eapEdit.map((e, i) => (
                <div key={e._tempId} className="ed-modal-list-item" draggable
                  onDragStart={(ev) => dragEap.handleDragStart(ev, i)} onDragOver={dragEap.handleDragOver}
                  onDrop={(ev) => dragEap.handleDrop(ev, i)} onDragEnd={dragEap.handleDragEnd}>
                  <span className="ed-drag-handle"><FaGripVertical /></span>
                  <input className="ed-modal-list-input" value={e.nome}
                    onChange={(ev) => setEapEdit((prev) => { const n = [...prev]; n[i] = { ...n[i], nome: ev.target.value }; return n; })} placeholder="Nome da EAP" />
                  <button type="button" className="ed-modal-list-del" onClick={() => setEapEdit((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
                </div>
              ))}
              <div className="ed-modal-list-add">
                <input className="ed-modal-list-input" placeholder="+ Novo item EAP" value={novoEap}
                  onChange={(e) => setNovoEap(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && novoEap.trim()) { e.preventDefault(); setEapEdit((prev) => [...prev, { id: null, nome: novoEap.trim(), orcamento_base: null, _tempId: Math.random() }]); setNovoEap(""); }}} />
                <button type="button" className="ed-modal-list-btn" onClick={() => { if (!novoEap.trim()) return; setEapEdit((prev) => [...prev, { id: null, nome: novoEap.trim(), orcamento_base: null, _tempId: Math.random() }]); setNovoEap(""); }}>Adicionar</button>
              </div>
            </div>
          </div>

          {/* Orçamento EAP */}
          {eapEdit.length > 0 && (
            <div className="ed-modal-section">
              <p className="ed-modal-section-title">Orçamento por EAP (valores na data de início)</p>
              <div className="ed-modal-eap-list">
                {eapEdit.map((e) => {
                  const key = e.id ?? e._tempId;
                  return (
                    <div key={key} className="ed-modal-eap-row">
                      <span className="ed-modal-eap-nome">{e.nome}</span>
                      <div className="ed-modal-eap-input-wrap">
                        <span className="ed-modal-eap-prefix">R$</span>
                        <input type="text" placeholder="0,00"
                          value={eapValores[key] ?? (e.orcamento_base != null ? String(e.orcamento_base).replace(".", ",") : "")}
                          onChange={(ev) => setEapValores((prev) => ({ ...prev, [key]: ev.target.value }))}
                          className="ed-modal-eap-input" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ed-modal-incc-box">
                <div className="ed-modal-incc-row"><span>Total base (soma EAPs)</span><strong>{formatarMoeda(totalEap || null)}</strong></div>
                {inccInicio  && <div className="ed-modal-incc-row ed-modal-incc-sub"><span>INCC referência ({inccInicio.mes})</span><span>{inccInicio.indice?.toLocaleString("pt-BR",{minimumFractionDigits:3})}</span></div>}
                {inccAtual   && <div className="ed-modal-incc-row ed-modal-incc-sub"><span>INCC atual ({inccAtual.mes})</span><span>{inccAtual.indice?.toLocaleString("pt-BR",{minimumFractionDigits:3})}</span></div>}
                {fatorIncc   && <div className="ed-modal-incc-row ed-modal-incc-sub"><span>Fator de correção</span><span>{fatorIncc.toFixed(6)}</span></div>}
                {variacaoIncc && <div className="ed-modal-incc-row ed-modal-incc-sub"><span>Variação INCC</span><span className={Number(variacaoIncc)>=0?"ed-pos":"ed-neg"}>{Number(variacaoIncc)>=0?"+":""}{variacaoIncc}%</span></div>}
                {totalCorrigido != null && <div className="ed-modal-incc-row ed-modal-incc-destaque"><span>Total corrigido pelo INCC</span><strong>{formatarMoeda(totalCorrigido)}</strong></div>}
              </div>
            </div>
          )}

          {erro && <p className="ed-modal-erro">{erro}</p>}
        </div>
        <div className="ed-modal-footer">
          <button type="button" className="ed-modal-btn-cancel" onClick={onClose}>Cancelar</button>
          <button type="button" className="ed-modal-btn-save" onClick={handleSave} disabled={salvando}>
            <FaSave /> {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
      {showImportPopover && (
        <ImportarPopover
          containerId={containerId || entity?.container_id} currentProjectId={entity.id}
          anchorRef={importBtnRef} onImport={(imp) => { if (imp.pavimentos.length) setPavimentosEdit((p) => [...p, ...imp.pavimentos]); if (imp.eap.length) setEapEdit((p) => [...p, ...imp.eap]); }}
          onClose={() => setShowImportPopover(false)}
        />
      )}
    </div>
  );
}

/* ─── EntityDetails principal ────────────────────────────────────────────── */
export default function EntityDetails({ entityType, entity: entityProp, onBack, onEdit, children, canEdit = false, containerId }) {
  const isProject = entityType === "project";
  const [entity, setEntity]               = useState(entityProp);
  const [showModal, setShowModal]         = useState(false);
  const [engenheiro, setEngenheiro]       = useState(null);
  const [membros, setMembros]             = useState([]);   // ← fonte de verdade
  const [stats, setStats]                 = useState({ tarefasTotal: 0, tarefasResolvidas: 0, atas: 0, listagens: 0, diarios: 0 });
  const [loadingStats, setLoadingStats]   = useState(true);
  const [inccHistorico, setInccHistorico] = useState([]);
  const [eapComValores, setEapComValores] = useState([]);

  /* reset ao trocar de entidade */
  useEffect(() => {
    setEntity(entityProp); setShowModal(false); setEngenheiro(null);
    setEapComValores([]); setMembros([]); setLoadingStats(true);
    setStats({ tarefasTotal: 0, tarefasResolvidas: 0, atas: 0, listagens: 0, diarios: 0 });
  }, [entityProp?.id]);

  /* carrega membros do banco */
  useEffect(() => {
    if (!isProject || !entity?.id) return;
    fetchMembrosDoProject(entity.id).then((m) => {
      console.log("[EntityDetails] membros:", m);
      setMembros(m);
    });
  }, [isProject, entity?.id]);

  const name            = entity.name || (isProject ? "Projeto" : "Setor");
  const dataInicio      = isProject ? entity.data_inicio      : null;
  const dataFinalizacao = isProject ? entity.data_finalizacao : null;
  const pavimentos      = isProject ? entity.pavimentos || [] : [];
  const eap             = isProject ? entity.eap        || [] : [];

  const orcamentoBase      = entity.orcamento_base      ?? null;
  const orcamentoCorrigido = entity.orcamento_corrigido ?? null;
  const variacaoOrcamento  = orcamentoBase && orcamentoCorrigido && orcamentoBase > 0
    ? (((orcamentoCorrigido - orcamentoBase) / orcamentoBase) * 100).toFixed(2) : null;

  useEffect(() => {
    if (!isProject || !eap?.length) { setEapComValores(eap); return; }
    const ids = eap.map((e) => e?.id).filter(Boolean);
    if (!ids.length) { setEapComValores(eap); return; }
    supabase.from("eap").select("id, orcamento_base").in("id", ids).then(({ data }) => {
      if (!data) { setEapComValores(eap); return; }
      const map = {};
      data.forEach((r) => { map[r.id] = r.orcamento_base; });
      setEapComValores(eap.map((e) => ({ ...e, orcamento_base: map[e.id] ?? e.orcamento_base ?? null })));
    }).catch(() => setEapComValores(eap));
  }, [isProject, entity.id]);

  const orcamentoBaseCalculado = eapComValores.length > 0
    ? eapComValores.reduce((acc, e) => acc + (Number(e.orcamento_base) || 0), 0) : null;

  useEffect(() => {
    fetch(`${INCC_API_URL}/incc`).then((r) => r.json())
      .then((json) => { if (json.success) setInccHistorico(json.data.historico); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isProject) return;
    const id = entity.engenheiro_id;
    if (!id) { setEngenheiro(null); return; }
    supabase.from("profiles").select("id, nickname, avatar_url").eq("id", id).single()
      .then(({ data, error }) => { if (!error) setEngenheiro(data); }).catch(() => {});
  }, [isProject, entity.engenheiro_id]);

  useEffect(() => {
    if (!isProject || !entity.id) { setLoadingStats(false); return; }
    setLoadingStats(true);
    (async () => {
      try {
        const { data: pilhas } = await supabase.from("pilhas").select("id").eq("project_id", entity.id);
        if (!pilhas?.length) return;
        const { data: notas } = await supabase.from("notas").select("id, tipo, concluida").in("pilha_id", pilhas.map((p) => p.id));
        if (!notas) return;
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
    })();
  }, [isProject, entity.id]);

  const progresso = stats.tarefasTotal > 0 ? Math.round((stats.tarefasResolvidas / stats.tarefasTotal) * 100) : 0;

  const handleSaved = (updated) => {
    setEntity(updated);
    // Após salvar, recarrega membros do banco (garantia máxima)
    if (updated._membrosAtualizados) {
      setMembros(updated._membrosAtualizados);
    } else {
      fetchMembrosDoProject(updated.id).then(setMembros);
    }
    if (onEdit) onEdit(updated);
  };

  return (
    <>
      <div className="ed-card">
        <div className="ed-header">
          <button type="button" className="ed-back" onClick={onBack}><FaArrowLeft /></button>
          <ProjectAvatar name={name} photoUrl={entity.photo_url} size={62} />
          <div className="ed-header-text">
            <h2 className="ed-name">{name}</h2>
            {isProject && (
              <div className="ed-dates-row">
                <span className="ed-date-chip"><span className="ed-date-chip-label">Início</span>{formatarData(dataInicio)}</span>
                <span className="ed-date-sep">→</span>
                <span className="ed-date-chip"><span className="ed-date-chip-label">Término</span>{formatarData(dataFinalizacao)}</span>
              </div>
            )}
          </div>
          {isProject && <button type="button" className="ed-header-edit-btn" onClick={() => setShowModal(true)}><FaEdit /></button>}
        </div>

        <div className="ed-body">
          {isProject && (
            <>
              {engenheiro && (
                <div className="ed-block">
                  <p className="ed-block-title">Engenheiro Responsável</p>
                  <div className="ed-engineer">
                    <div className="ed-person-avatar" style={{ borderColor: "#28a745" }}>
                      {engenheiro.avatar_url ? <img src={engenheiro.avatar_url} alt={engenheiro.nickname} /> : engenheiro.nickname?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <span className="ed-person-name">{engenheiro.nickname}</span>
                  </div>
                </div>
              )}

              {membros.length > 0 && (
                <div className="ed-block">
                  <p className="ed-block-title">Membros</p>
                  <div className="ed-membros">
                    {membros.map((m) => m?.id ? (
                      <div key={m.id} className="ed-membro">
                        <div className="ed-person-avatar" style={{ borderColor: "#020a52" }}>
                          {m.avatar_url ? <img src={m.avatar_url} alt={m.nickname} /> : m.nickname?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <span className="ed-membro-name">{m.nickname}</span>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              <div className="ed-block">
                <div className="ed-block-title-row">
                  <p className="ed-block-title">Progresso das Tarefas</p>
                  <span className="ed-pct">{loadingStats ? "..." : `${progresso}%`}</span>
                </div>
                <div className="ed-progress-track"><div className="ed-progress-fill" style={{ width: `${progresso}%` }} /></div>
                <div className="ed-progress-sub">
                  <span>{stats.tarefasResolvidas} concluídas</span>
                  <span>{stats.tarefasTotal - stats.tarefasResolvidas} pendentes</span>
                  <span>{stats.tarefasTotal} total</span>
                </div>
              </div>

              <div className="ed-block">
                <p className="ed-block-title">Resumo de Atividades</p>
                {loadingStats ? <p className="ed-loading">Carregando...</p> : (
                  <div className="ed-stats">
                    <div className="ed-stat"><span className="ed-stat-num">{stats.tarefasResolvidas}<span className="ed-stat-den">/{stats.tarefasTotal}</span></span><span className="ed-stat-lbl">Tarefas</span></div>
                    <div className="ed-stat"><span className="ed-stat-num">{stats.atas}</span><span className="ed-stat-lbl">Atas</span></div>
                    <div className="ed-stat"><span className="ed-stat-num">{stats.listagens}</span><span className="ed-stat-lbl">Listagens</span></div>
                    <div className="ed-stat"><span className="ed-stat-num">{stats.diarios}</span><span className="ed-stat-lbl">Diários de Obra</span></div>
                  </div>
                )}
              </div>

              <div className="ed-block">
                <p className="ed-block-title">Orçamento da Obra</p>
                <div className="ed-budget">
                  <div className="ed-budget-col">
                    <span className="ed-budget-lbl">Base (soma EAPs)</span>
                    <span className="ed-budget-val">{(orcamentoBaseCalculado || orcamentoBase) ? formatarMoeda(orcamentoBaseCalculado || orcamentoBase) : <span className="ed-budget-vazio">—</span>}</span>
                  </div>
                  {variacaoOrcamento != null && (
                    <span className={`ed-variacao ${Number(variacaoOrcamento) >= 0 ? "ed-variacao--pos" : "ed-variacao--neg"}`}>
                      {Number(variacaoOrcamento) >= 0 ? "▲" : "▼"} {Math.abs(variacaoOrcamento)}%
                    </span>
                  )}
                  <div className="ed-budget-col ed-budget-col--right">
                    <span className="ed-budget-lbl">Corrigido (INCC)</span>
                    <span className="ed-budget-val ed-budget-val--dest">{orcamentoCorrigido ? formatarMoeda(orcamentoCorrigido) : <span className="ed-budget-vazio">—</span>}</span>
                  </div>
                </div>
                {entity.indice_incc_inicio && entity.indice_incc_atual && (
                  <p className="ed-budget-hint">INCC ref.: {Number(entity.indice_incc_inicio).toLocaleString("pt-BR",{minimumFractionDigits:3})} → {Number(entity.indice_incc_atual).toLocaleString("pt-BR",{minimumFractionDigits:3})}</p>
                )}
              </div>

              {(pavimentos.length > 0 || eap.length > 0) && (
                <div className="ed-block">
                  <div className="project-sections">
                    {pavimentos.length > 0 && (
                      <div className="project-section">
                        <h3>Pavimentos</h3>
                        <ul>{pavimentos.map((p, i) => <li key={p?.id ?? i}>{extrairTexto(p)}</li>)}</ul>
                      </div>
                    )}
                    {eapComValores.length > 0 && (
                      <div className="project-section">
                        <h3>EAP</h3>
                        <ul>
                          {eapComValores.map((e, i) => (
                            <li key={e?.id ?? i} className="ed-eap-display-li">
                              <span>{extrairTexto(e)}</span>
                              {e?.orcamento_base != null && Number(e.orcamento_base) > 0 && <span className="ed-eap-display-val">{formatarMoeda(e.orcamento_base)}</span>}
                            </li>
                          ))}
                        </ul>
                        {orcamentoBaseCalculado > 0 && <div className="ed-eap-section-total"><span>Total EAP</span><strong>{formatarMoeda(orcamentoBaseCalculado)}</strong></div>}
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

      {showModal && (
        <ModalEdicao
          entity={entity} eap={eap}
          onClose={() => setShowModal(false)}
          onSave={handleSaved}
          inccHistorico={inccHistorico}
          containerId={containerId}
        />
      )}
    </>
  );
}