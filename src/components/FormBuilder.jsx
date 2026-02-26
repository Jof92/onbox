// src/components/FormBuilder.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import { FaTimes, FaEdit, FaGripVertical } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./FormBuilder.css";

// ─────────────────────────────────────────────────────────────────────────────
// Paleta de componentes
// ─────────────────────────────────────────────────────────────────────────────
const COMPONENTS = [
  { type: "input",    label: "Input de Texto", icon: "⌨️", defaultProps: { placeholder: "Digite aqui...", label: "Campo de texto" } },
  { type: "textarea", label: "Área de Texto",  icon: "📝", defaultProps: { placeholder: "Escreva aqui...", label: "Observações" } },
  { type: "name",     label: "Campo Nome",     icon: "👤", defaultProps: { label: "Nome" } },
  { type: "checkbox", label: "Checkbox",       icon: "☑️", defaultProps: { label: "Opção" } },
  { type: "select",   label: "Select / Lista", icon: "📋", defaultProps: { label: "Selecione", options: ["Opção 1", "Opção 2"] } },
  { type: "image",    label: "Imagem",         icon: "🖼️", defaultProps: { caption: "", url: "" } },
  { type: "title",    label: "Título",         icon: "🔤", defaultProps: { text: "Novo Título" } },
  { type: "subtitle", label: "Subtítulo",      icon: "🔡", defaultProps: { text: "Subtítulo" } },
  { type: "divider",  label: "Divisória",      icon: "➖", defaultProps: { label: "" } },
];

let _uid = 1;
const genId = () => `fid_${_uid++}`;

function snapCols(pct) {
  return Math.max(1, Math.min(12, Math.round((pct / 100) * 12)));
}
function colsPct(cols) {
  return Math.round((cols / 12) * 10000) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineText  –  duplo clique para editar
// ─────────────────────────────────────────────────────────────────────────────
function InlineText({ value, onChange, Tag = "span", className = "", inputCls = "", hint = "Clique duplo para editar", readOnly = false }) {
  const [on,    setOn]    = useState(false);
  const [draft, setDraft] = useState(value);

  if (readOnly) return <Tag className={className}>{value}</Tag>;

  const start  = e => { e.stopPropagation(); setDraft(value); setOn(true); };
  const commit = ()  => { setOn(false); if ((draft||"").trim() !== value) onChange((draft||"").trim() || value); };
  const keys   = e  => {
    if (e.key === "Enter")  { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setOn(false); setDraft(value); }
    e.stopPropagation();
  };

  if (on) return (
    <input autoFocus
      className={`fb-inline-input ${inputCls}`}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={keys}
      onClick={e => e.stopPropagation()} />
  );
  return (
    <Tag className={`fb-inline-editable ${className}`} onDoubleClick={start} title={hint}>
      {value || <em style={{ opacity: .4 }}>vazio</em>}
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ImageField
// ─────────────────────────────────────────────────────────────────────────────
function ImageField({ item, onPropChange, readOnly }) {
  const ref = useRef();
  const pick = () => !readOnly && ref.current?.click();

  const onFile = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => onPropChange(item.id, "url", ev.target.result);
    reader.readAsDataURL(f);
  };

  return (
    <div>
      <input type="file" accept="image/*" ref={ref} style={{ display: "none" }} onChange={onFile} />
      <div className={`fb-img-box${readOnly ? "" : " fb-img-box--edit"}`} onClick={pick}>
        {item.props.url
          ? <img src={item.props.url} alt="" className="fb-img-preview" />
          : <div className="fb-img-placeholder">
              <span style={{ fontSize: 32 }}>🖼️</span>
              {!readOnly && <span className="fb-img-hint">Clique para adicionar imagem</span>}
            </div>
        }
      </div>
      {readOnly
        ? item.props.caption && <p className="fb-img-caption">{item.props.caption}</p>
        : <InlineText value={item.props.caption || "Legenda..."} onChange={v => onPropChange(item.id, "caption", v)}
            className="fb-img-caption fb-img-caption--edit"
            inputCls="label"
            hint="Clique duplo para editar legenda" />
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldContent  –  renderiza o conteúdo de cada tipo de campo
// ─────────────────────────────────────────────────────────────────────────────
function FieldContent({ item, onPropChange, readOnly }) {
  const ch = key => val => onPropChange(item.id, key, val);

  switch (item.type) {
    case "title":
      return <InlineText value={item.props.text} onChange={ch("text")}
        Tag="div" className="fb-ft-title" inputCls="title"
        hint="Clique duplo para editar" readOnly={readOnly} />;

    case "subtitle":
      return <InlineText value={item.props.text} onChange={ch("text")}
        Tag="div" className="fb-ft-subtitle" inputCls="subtitle"
        hint="Clique duplo para editar" readOnly={readOnly} />;

    case "divider":
      return (
        <div className="fb-ft-divider">
          <InlineText value={item.props.label || "Seção"} onChange={ch("label")}
            className="fb-ft-divider-label" inputCls="divider-label"
            hint="Clique duplo para editar" readOnly={readOnly} />
          <div className="fb-ft-divider-line" />
        </div>
      );

    case "name":
      return (
        <div className="fb-ft-name">
          <InlineText value={item.props.label} onChange={ch("label")}
            className="fb-ft-name-label" inputCls="label" Tag="span"
            hint="Clique duplo para editar rótulo" readOnly={readOnly} />
          <input className="fb-ft-name-input" placeholder="Nome completo..." disabled={readOnly} readOnly={readOnly} />
        </div>
      );

    case "input":
      return (
        <div>
          <InlineText value={item.props.label} onChange={ch("label")}
            Tag="label" className="fb-ft-label" inputCls="label"
            hint="Clique duplo para editar rótulo" readOnly={readOnly} />
          <input disabled placeholder={item.props.placeholder} className="fb-ft-input" />
        </div>
      );

    case "textarea":
      return (
        <div>
          <InlineText value={item.props.label} onChange={ch("label")}
            Tag="label" className="fb-ft-label" inputCls="label"
            hint="Clique duplo para editar rótulo" readOnly={readOnly} />
          <textarea disabled placeholder={item.props.placeholder} rows={2} className="fb-ft-textarea" />
        </div>
      );

    case "checkbox":
      return (
        <div className="fb-ft-checkbox">
          <input type="checkbox" disabled style={{ width: 14, height: 14, flexShrink: 0 }} />
          <InlineText value={item.props.label} onChange={ch("label")}
            className="fb-ft-checkbox-label" inputCls="checkbox-label"
            hint="Clique duplo para editar rótulo" readOnly={readOnly} />
        </div>
      );

    case "select":
      return (
        <div>
          <InlineText value={item.props.label} onChange={ch("label")}
            Tag="label" className="fb-ft-label" inputCls="label"
            hint="Clique duplo para editar rótulo" readOnly={readOnly} />
          <select disabled className="fb-ft-select">
            {(item.props.options || []).map((o, i) => <option key={i}>{o}</option>)}
          </select>
        </div>
      );

    case "image":
      return <ImageField item={item} onPropChange={onPropChange} readOnly={readOnly} />;

    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldCard  –  wrapper com alça de drag, resize e botões (modo edição)
// ─────────────────────────────────────────────────────────────────────────────
function FieldCard({ item, rowId, onDelete, onEdit, onResizeEnd, onPropChange, onFieldDragStart, dragOverId, onDragOver, onDrop }) {
  const cardRef      = useRef(null);
  const resizing     = useRef(false);
  const startX       = useRef(0);
  const startW       = useRef(0);
  const rowW         = useRef(0);
  const [tip, setTip] = useState(null);

  const cols = item.props.cols || 12;

  // ── resize handle mouse down ──────────────────────────────────────────
  const onResizeDown = useCallback(e => {
    e.preventDefault(); e.stopPropagation();
    resizing.current = true;
    startX.current   = e.clientX;
    startW.current   = cardRef.current.offsetWidth;
    rowW.current     = cardRef.current.parentElement.offsetWidth;

    const onMove = ev => {
      if (!resizing.current) return;
      const newW    = Math.max(44, startW.current + ev.clientX - startX.current);
      const newCols = snapCols((newW / rowW.current) * 100);
      cardRef.current.style.width = `calc(${colsPct(newCols)}% - 8px)`;
      setTip(`${newCols}/12`);
    };
    const onUp = ev => {
      resizing.current = false;
      const newW    = Math.max(44, startW.current + ev.clientX - startX.current);
      const newCols = snapCols((newW / rowW.current) * 100);
      onResizeEnd(rowId, item.id, newCols);
      setTip(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [item.id, rowId, onResizeEnd]);

  const isDragOver = dragOverId === item.id;

  return (
    <div
      ref={cardRef}
      className={`fb-field-card${isDragOver ? " fb-field-card--over" : ""}`}
      style={{ width: `calc(${colsPct(cols)}% - 8px)` }}
      onDragOver={e => { e.preventDefault(); onDragOver(item.id); }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(rowId, item.id); }}
    >
      {/* ── drag handle ── */}
      <div className="fb-field-grip"
        draggable
        onDragStart={e => { e.stopPropagation(); onFieldDragStart(e, rowId, item.id); }}
        title="Arrastar para reordenar"
      >
        <FaGripVertical />
      </div>

      {/* ── col badge ── */}
      <div className="fb-field-badge">{cols}/12</div>

      {/* ── content ── */}
      <FieldContent item={item} onPropChange={onPropChange} readOnly={false} />

      {/* ── action buttons ── */}
      <div className="fb-field-actions">
        <button className="fb-act edit"   onClick={() => onEdit(item, rowId)} title="Mais opções">✏️</button>
        <button className="fb-act delete" onClick={() => onDelete(rowId, item.id)} title="Remover">✕</button>
      </div>

      {/* ── resize handle ── */}
      <div className="fb-resize-handle" onMouseDown={onResizeDown} title="Arrastar para redimensionar">↔</div>

      {tip && <div className="fb-resize-tip">{tip}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row  –  linha do formulário (modo edição)
// ─────────────────────────────────────────────────────────────────────────────
function FormRow({
  row, rowIndex, totalRows,
  onDeleteRow, onMoveUp, onMoveDown,
  onEditItem, onDeleteItem, onResizeEnd, onPropChange,
  // field drag
  onFieldDragStart, dragOverId, onDragOver, onDropField,
  // sidebar drop
  onSidebarDrop,
}) {
  const [sidebarOver, setSidebarOver] = useState(false);

  function onDragOverRow(e) {
    e.preventDefault();
    if ([...e.dataTransfer.types].includes("application/x-sidebar")) setSidebarOver(true);
  }
  function onDragLeaveRow(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setSidebarOver(false);
  }
  function onDropRow(e) {
    e.preventDefault();
    setSidebarOver(false);
    if ([...e.dataTransfer.types].includes("application/x-sidebar")) {
      onSidebarDrop(e, row.id);
    }
  }

  return (
    <div
      className={`fb-row${sidebarOver ? " fb-row--over" : ""}`}
      onDragOver={onDragOverRow}
      onDragLeave={onDragLeaveRow}
      onDrop={onDropRow}
    >
      <div className="fb-row-badge">LINHA {rowIndex + 1}</div>

      <div className="fb-row-items">
        {row.items.length === 0
          ? <div className="fb-row-empty">↙ Arraste um componente aqui ou clique na barra lateral</div>
          : row.items.map(item => (
              <FieldCard
                key={item.id}
                item={item}
                rowId={row.id}
                onDelete={onDeleteItem}
                onEdit={onEditItem}
                onResizeEnd={onResizeEnd}
                onPropChange={onPropChange}
                onFieldDragStart={onFieldDragStart}
                dragOverId={dragOverId}
                onDragOver={onDragOver}
                onDrop={onDropField}
              />
            ))
        }
      </div>

      <div className="fb-row-footer">
        <div className="fb-row-move">
          <button disabled={rowIndex === 0}               onClick={() => onMoveUp(rowIndex)}   title="Mover para cima"  className="fb-row-move-btn">▲</button>
          <button disabled={rowIndex === totalRows - 1}   onClick={() => onMoveDown(rowIndex)} title="Mover para baixo" className="fb-row-move-btn">▼</button>
        </div>
        <button className="fb-btn-remove-row" onClick={() => onDeleteRow(row.id)}>🗑 remover linha</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewRow  –  linha em modo visualização (sem controles)
// ─────────────────────────────────────────────────────────────────────────────
function ViewRow({ row }) {
  return (
    <div className="fb-view-row">
      {row.items.map(item => {
        const cols = item.props.cols || 12;
        return (
          <div key={item.id} className="fb-view-field" style={{ width: `calc(${colsPct(cols)}% - 8px)` }}>
            <FieldContent item={item} onPropChange={() => {}} readOnly={true} />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Save-button states
// ─────────────────────────────────────────────────────────────────────────────
const SAVE_ST = {
  idle:   ["✓ Publicar Formulário", ""],
  saving: ["⏳ Salvando...",         "saving"],
  saved:  ["✓ Publicado!",          "saved"],
  error:  ["✗ Erro ao salvar",      "error"],
};

// ─────────────────────────────────────────────────────────────────────────────
// FormBuilder  –  componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function FormBuilder({ notaId, notaNome, onClose, usuarioId, projetoAtual }) {
  const [rows,         setRows]         = useState([{ id: genId(), items: [] }]);
  const [formTitle,    setFormTitle]    = useState(notaNome || "Formulário");
  const [editingTitle, setEditingTitle] = useState(false);

  // Edição de campo via modal (placeholder/opções)
  const [editingItem,  setEditingItem]  = useState(null);
  const [editRowId,    setEditRowId]    = useState(null);

  // Drag de campo entre colunas
  const draggingMeta = useRef(null); // { fromRowId, itemId }
  const [dragOverId,  setDragOverId]   = useState(null);

  // Drag da sidebar
  const [sidebarComp, setSidebarComp] = useState(null);

  // Save state
  const [saveState,  setSaveState]  = useState("idle");
  const saveTimer = useRef(null);

  // View / Edit mode
  const [viewMode,    setViewMode]   = useState(false);
  const [ownerId,     setOwnerId]    = useState(null);
  const isOwner = !ownerId || ownerId === usuarioId;

  // ── carregar estrutura salva ────────────────────────────────────────────
  useEffect(() => {
    if (!notaId) return;
    supabase
      .from("notas")
      .select("conteudo, responsavel")
      .eq("id", notaId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        if (data.responsavel) setOwnerId(data.responsavel);
        if (!data.conteudo)   return;
        try {
          const p = typeof data.conteudo === "string" ? JSON.parse(data.conteudo) : data.conteudo;
          if (p?.rows?.length) { setRows(p.rows); setViewMode(true); }
          if (p?.title)          setFormTitle(p.title);
        } catch { /* ignore */ }
      });
  }, [notaId]);

  // ── row helpers ──────────────────────────────────────────────────────────
  const addRow    = ()      => setRows(r => [...r, { id: genId(), items: [] }]);
  const deleteRow = rowId   => setRows(r => r.filter(row => row.id !== rowId));
  const moveRowUp = idx     => setRows(prev => {
    if (idx === 0) return prev;
    const a = [...prev]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a;
  });
  const moveRowDown = idx   => setRows(prev => {
    if (idx >= prev.length - 1) return prev;
    const a = [...prev]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a;
  });

  // ── item helpers ─────────────────────────────────────────────────────────
  const addItem = (rowId, comp) =>
    setRows(r => r.map(row => row.id !== rowId ? row : {
      ...row, items: [...row.items, { id: genId(), type: comp.type, props: { ...comp.defaultProps, cols: 12 } }],
    }));

  const deleteItem = (rowId, itemId) =>
    setRows(r => r.map(row => row.id !== rowId ? row : {
      ...row, items: row.items.filter(i => i.id !== itemId),
    }));

  const propChange = (itemId, key, value) =>
    setRows(r => r.map(row => ({
      ...row,
      items: row.items.map(i => i.id !== itemId ? i : { ...i, props: { ...i.props, [key]: value } }),
    })));

  const editItem = (item, rowId) => {
    setEditingItem(JSON.parse(JSON.stringify(item)));
    setEditRowId(rowId);
  };
  const saveEdit = () => {
    setRows(r => r.map(row => row.id !== editRowId ? row : {
      ...row, items: row.items.map(i => i.id === editingItem.id ? editingItem : i),
    }));
    setEditingItem(null); setEditRowId(null);
  };

  const resizeEnd = useCallback((rowId, itemId, newCols) =>
    setRows(r => r.map(row => row.id !== rowId ? row : {
      ...row,
      items: row.items.map(i => i.id !== itemId ? i : { ...i, props: { ...i.props, cols: newCols } }),
    })), []);

  // ── field drag handlers ───────────────────────────────────────────────────
  const onFieldDragStart = (e, fromRowId, itemId) => {
    draggingMeta.current = { fromRowId, itemId };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-field", itemId);
  };
  const onDragOverField = id => setDragOverId(id);

  const onDropField = (toRowId, toItemId) => {
    setDragOverId(null);
    const meta = draggingMeta.current;
    if (!meta || meta.itemId === toItemId) return;

    setRows(prev => {
      const next = prev.map(r => ({ ...r, items: [...r.items] }));
      let moving = null;
      for (const r of next) {
        const idx = r.items.findIndex(i => i.id === meta.itemId);
        if (idx !== -1) { [moving] = r.items.splice(idx, 1); break; }
      }
      if (!moving) return prev;
      for (const r of next) {
        if (r.id !== toRowId) continue;
        const toIdx = r.items.findIndex(i => i.id === toItemId);
        toIdx === -1 ? r.items.push(moving) : r.items.splice(toIdx, 0, moving);
        break;
      }
      return next;
    });
    draggingMeta.current = null;
  };

  // ── sidebar drop ──────────────────────────────────────────────────────────
  const onSidebarDrop = (e, rowId) => {
    if (sidebarComp) { addItem(rowId, sidebarComp); setSidebarComp(null); }
  };

  // ── publicar ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!notaId) { alert("ID da nota não encontrado."); return; }
    setSaveState("saving");
    const { error } = await supabase
      .from("notas")
      .update({ conteudo: JSON.stringify({ title: formTitle, rows }) })
      .eq("id", notaId);
    if (error) {
      setSaveState("error");
    } else {
      setSaveState("saved");
      setViewMode(true);
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState("idle"), 3000);
  };

  const totalFields = rows.reduce((s, r) => s + r.items.length, 0);
  const [saveLabel, saveCls] = SAVE_ST[saveState];

  // ═══════════════════════════════════════════════════════════════════════════
  // ╔══════════════════════════════════════╗
  // ║  VIEW MODE (formulário publicado)    ║
  // ╚══════════════════════════════════════╝
  // ═══════════════════════════════════════════════════════════════════════════
  if (viewMode) {
    return (
      <div className="fb-page">
        {/* Header view */}
        <div className="fb-header fb-header--view">
          <h1 className="fb-header-title" style={{ cursor: "default" }}>📐 {formTitle}</h1>
          <div className="fb-header-actions">
            {isOwner && (
              <button className="fb-btn-edit-mode" onClick={() => setViewMode(false)}>
                <FaEdit style={{ marginRight: 5 }} />Editar Formulário
              </button>
            )}
            {onClose && (
              <button className="fb-btn-close" onClick={onClose} title="Fechar"><FaTimes /></button>
            )}
          </div>
        </div>

        {/* Body view — sem sidebar */}
        <div className="fb-body fb-body--view">
          <div className="fb-view-canvas">
            {rows.map(row => row.items.length > 0 && <ViewRow key={row.id} row={row} />)}
            {rows.every(r => r.items.length === 0) && (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: "40px 0", fontSize: 14 }}>
                Formulário sem campos.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ╔══════════════════════════════════════╗
  // ║  EDIT MODE (builder)                 ║
  // ╚══════════════════════════════════════╝
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="fb-page" onDragEnd={() => { setDragOverId(null); draggingMeta.current = null; }}>

      {/* Header edit */}
      <div className="fb-header">
        {editingTitle
          ? <input autoFocus className="fb-header-title-input" value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={e => (e.key === "Enter" || e.key === "Escape") && setEditingTitle(false)} />
          : <h1 className="fb-header-title" onDoubleClick={() => setEditingTitle(true)}>
              📐 {formTitle} <span className="fb-edit-hint">✏️</span>
            </h1>
        }
        <div className="fb-header-actions">
          <span className="fb-badge">{totalFields} campo{totalFields !== 1 ? "s" : ""} · {rows.length} linha{rows.length !== 1 ? "s" : ""}</span>
          <button className="fb-btn-clear" onClick={() => setRows([{ id: genId(), items: [] }])}>Limpar</button>
          {onClose && <button className="fb-btn-close" onClick={onClose} title="Fechar"><FaTimes /></button>}
        </div>
      </div>

      {/* Body */}
      <div className="fb-body">

        {/* Canvas */}
        <div className="fb-canvas">
          {rows.map((row, ri) => (
            <FormRow
              key={row.id}
              row={row}
              rowIndex={ri}
              totalRows={rows.length}
              onDeleteRow={deleteRow}
              onMoveUp={moveRowUp}
              onMoveDown={moveRowDown}
              onEditItem={editItem}
              onDeleteItem={deleteItem}
              onResizeEnd={resizeEnd}
              onPropChange={propChange}
              onFieldDragStart={onFieldDragStart}
              dragOverId={dragOverId}
              onDragOver={onDragOverField}
              onDropField={onDropField}
              onSidebarDrop={onSidebarDrop}
            />
          ))}
          <button className="fb-btn-add-row" onClick={addRow}>+ Nova Linha</button>
        </div>

        {/* Sidebar */}
        <div className="fb-sidebar">
          <p className="fb-sidebar-title">Componentes</p>
          <p className="fb-sidebar-hint">Arraste para uma linha ou clique para adicionar na última</p>

          {COMPONENTS.map(comp => (
            <div key={comp.type} className="fb-comp-item"
              draggable
              onDragStart={e => { setSidebarComp(comp); e.dataTransfer.setData("application/x-sidebar", comp.type); }}
              onDragEnd={() => setSidebarComp(null)}
              onClick={() => addItem(rows[rows.length - 1].id, comp)}
            >
              <span className="fb-comp-icon">{comp.icon}</span>{comp.label}
            </div>
          ))}

          <div className="fb-sidebar-footer">
            <p className="fb-sidebar-footer-hint">
              💡 <strong>Clique duplo</strong> no rótulo para editar.<br />
              <FaGripVertical style={{ verticalAlign: "middle" }} /> Arraste campos para reordenar.<br />
              ↔ Arraste a borda direita para redimensionar.<br />
              ▲▼ Mover linha para cima/baixo.
            </p>
            <button
              className={`fb-btn-save${saveCls ? ` fb-btn-save--${saveCls}` : ""}`}
              onClick={handleSave}
              disabled={saveState === "saving"}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Modal editar campo */}
      {editingItem && (
        <div className="fb-modal-bd" onClick={() => { setEditingItem(null); setEditRowId(null); }}>
          <div className="fb-modal" onClick={e => e.stopPropagation()}>
            <h3>✏️ Editar — {editingItem.type}</h3>

            {editingItem.props.placeholder !== undefined && (
              <div className="fb-modal-field">
                <label className="fb-modal-lbl">Placeholder</label>
                <input className="fb-modal-inp"
                  value={editingItem.props.placeholder || ""}
                  onChange={e => setEditingItem({ ...editingItem, props: { ...editingItem.props, placeholder: e.target.value } })} />
              </div>
            )}

            {editingItem.type === "select" && (
              <div className="fb-modal-field">
                <label className="fb-modal-lbl">Opções (uma por linha)</label>
                <textarea className="fb-modal-ta" rows={5}
                  value={(editingItem.props.options || []).join("\n")}
                  onChange={e => setEditingItem({ ...editingItem, props: { ...editingItem.props, options: e.target.value.split("\n") } })} />
              </div>
            )}

            {!["select"].includes(editingItem.type) && editingItem.props.placeholder === undefined && (
              <p style={{ color: "#94a3b8", fontSize: 12 }}>
                💡 Dê duplo clique direto no rótulo para editar inline.
              </p>
            )}

            <div className="fb-modal-foot">
              <button className="fb-btn-cancel"  onClick={() => { setEditingItem(null); setEditRowId(null); }}>Cancelar</button>
              <button className="fb-btn-confirm" onClick={saveEdit}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}