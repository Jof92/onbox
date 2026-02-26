// src/components/FormBuilder.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import { FaTimes, FaEdit, FaGripVertical, FaAlignLeft, FaAlignCenter, FaAlignRight } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./FormBuilder.css";

// ─────────────────────────────────────────────────────────────────────────────
// Componentes — "submit" é o botão Salvar arrastável pelo usuário
// ─────────────────────────────────────────────────────────────────────────────
const COMPONENTS = [
  { type:"input",    label:"Input de Texto",   icon:"⌨️", defaultProps:{ placeholder:"Digite aqui...", label:"Campo de texto", align:"left", fontSize:"13", color:"#1e293b" } },
  { type:"textarea", label:"Área de Texto",    icon:"📝", defaultProps:{ placeholder:"Escreva aqui...", label:"Observações",  align:"left", fontSize:"13", color:"#1e293b" } },
  { type:"name",     label:"Campo Nome",       icon:"👤", defaultProps:{ label:"Nome",                                        align:"left", fontSize:"13", color:"#1e293b" } },
  { type:"checkbox", label:"Checkbox",         icon:"☑️", defaultProps:{ label:"Opção",                                      align:"left", fontSize:"13", color:"#475569" } },
  { type:"select",   label:"Select / Lista",   icon:"📋", defaultProps:{ label:"Selecione", options:["Opção 1","Opção 2"],    align:"left", fontSize:"13", color:"#1e293b" } },
  { type:"image",    label:"Imagem",           icon:"🖼️", defaultProps:{ url:"",                                             align:"left" } },
  { type:"title",    label:"Título",           icon:"🔤", defaultProps:{ text:"Novo Título",                                 align:"left", fontSize:"24", color:"#2d3a8c" } },
  { type:"subtitle", label:"Subtítulo",        icon:"🔡", defaultProps:{ text:"Subtítulo",                                   align:"left", fontSize:"15", color:"#64748b" } },
  { type:"divider",  label:"Divisória",        icon:"➖", defaultProps:{                                                       align:"left" } },
  { type:"label",    label:"Rótulo",           icon:"🏷️", defaultProps:{ text:"Rótulo", bold:false,                         align:"left", fontSize:"13", color:"#374151" } },
  { type:"submit",   label:"Botão Salvar",     icon:"💾", defaultProps:{ label:"Salvar Respostas",                           align:"left" } },
];

let _uid = 1;
const genId = () => `fid_${_uid++}`;
function snapCols(pct){ return Math.max(1,Math.min(12,Math.round((pct/100)*12))); }
function colsPct(cols){ return Math.round((cols/12)*10000)/100; }
const ROW_MIN_HEIGHT = 40;
const ROW_HEIGHT_STEP = 10;
const TOOLTIP_TYPES = ["title","subtitle","label"];

// ─────────────────────────────────────────────────────────────────────────────
// TextTooltip — aparece ao clicar no campo de texto (título/subtítulo/rótulo)
// ─────────────────────────────────────────────────────────────────────────────
function TextTooltip({ item, onPropChange, onClose }) {
  const wrapRef = useRef(null);
  const textKey = item.props.text !== undefined ? "text" : "label";
  const [draft, setDraft] = useState(item.props[textKey] || "");

  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        commit();
        onClose();
      }
    };
    // usar timeout para não fechar imediatamente ao abrir
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [draft]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== item.props[textKey]) onPropChange(item.id, textKey, v);
  };

  const ch = (key, val) => onPropChange(item.id, key, val);
  const align    = item.props.align    || "left";
  const fontSize = Number(item.props.fontSize || 13);
  const color    = item.props.color    || "#1e293b";

  return (
    <div ref={wrapRef} className="fb-text-tooltip" onMouseDown={e => e.stopPropagation()}>
      <div className="fb-tt-arrow" />

      {/* Campo de texto */}
      <input
        autoFocus
        className="fb-tt-text-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); commit(); onClose(); }
          if (e.key === "Escape") onClose();
          e.stopPropagation();
        }}
        placeholder="Texto..."
      />

      <div className="fb-tt-controls">
        {/* Alinhamento — ícones de linhas exatos */}
        <div className="fb-tt-align-group">
          {[
            { v:"left",   Icon:FaAlignLeft },
            { v:"center", Icon:FaAlignCenter },
            { v:"right",  Icon:FaAlignRight },
          ].map(({ v, Icon }) => (
            <button
              key={v}
              className={`fb-tt-align-btn${align===v?" active":""}`}
              onMouseDown={e => { e.preventDefault(); ch("align", v); }}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>

        {/* Tamanho da fonte */}
        <div className="fb-tt-size-group">
          <button className="fb-tt-sz-btn" onMouseDown={e => { e.preventDefault(); ch("fontSize", String(Math.max(9, fontSize-1))); }}>−</button>
          <span className="fb-tt-sz-val">{fontSize}</span>
          <button className="fb-tt-sz-btn" onMouseDown={e => { e.preventDefault(); ch("fontSize", String(Math.min(96, fontSize+1))); }}>+</button>
        </div>

        {/* Cor */}
        <label className="fb-tt-color-label" title="Cor do texto">
          <span className="fb-tt-color-swatch" style={{ background: color }} />
          <input type="color" className="fb-tt-color-hidden" value={color}
            onChange={e => ch("color", e.target.value)} />
        </label>

        {/* Negrito — só para rótulo */}
        {item.type === "label" && (
          <button
            className={`fb-tt-bold-btn${item.props.bold?" active":""}`}
            onMouseDown={e => { e.preventDefault(); ch("bold", !item.props.bold); }}
          >B</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ImageField — sem legenda
// ─────────────────────────────────────────────────────────────────────────────
function ImageField({ item, onPropChange, readOnly }) {
  const ref = useRef();
  const onFile = e => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => onPropChange(item.id, "url", ev.target.result);
    reader.readAsDataURL(f);
  };
  return (
    <div style={{ width:"100%" }}>
      <input type="file" accept="image/*" ref={ref} style={{ display:"none" }} onChange={onFile} />
      <div className={`fb-img-box${readOnly?"":` fb-img-box--edit`}`} onClick={() => !readOnly && ref.current?.click()}>
        {item.props.url
          ? <img src={item.props.url} alt="" className="fb-img-preview" />
          : <div className="fb-img-placeholder">
              <span style={{ fontSize:32 }}>🖼️</span>
              {!readOnly && <span className="fb-img-hint">Clique para adicionar imagem</span>}
            </div>
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldContent
// ─────────────────────────────────────────────────────────────────────────────
function FieldContent({ item, onPropChange, readOnly, formValues, onFormValueChange, onSaveData, saveDataState }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const ch  = key => val => onPropChange(item.id, key, val);
  const val = formValues?.[item.id] ?? "";
  const sv  = v => onFormValueChange?.(item.id, v);

  const align    = item.props.align    || "left";
  // IMPORTANTE: lê fontSize como número, aplica em px
  const fontSize = item.props.fontSize ? `${item.props.fontSize}px` : "13px";
  const color    = item.props.color    || undefined;
  const inputStyle   = { textAlign: align, fontSize, color };
  const wrapperStyle = { textAlign: align };

  // Wrapper que adiciona tooltip ao clicar (só no modo edição)
  const withTooltip = (content, extraStyle) => {
    if (readOnly || !TOOLTIP_TYPES.includes(item.type)) return content;
    return (
      <div
        style={{ position:"relative", cursor:"pointer", ...extraStyle }}
        onClick={e => { e.stopPropagation(); setTooltipOpen(o => !o); }}
        title="Clique para editar"
      >
        {content}
        {/* Indicador visual de clicável */}
        <span className="fb-text-click-hint">✎</span>
        {tooltipOpen && (
          <TextTooltip
            item={item}
            onPropChange={onPropChange}
            onClose={() => setTooltipOpen(false)}
          />
        )}
      </div>
    );
  };

  switch (item.type) {
    case "title":
      return withTooltip(
        <div className="fb-ft-title" style={{ fontSize, color, textAlign:align, whiteSpace:"normal", overflow:"visible", textOverflow:"unset", lineHeight:1.2 }}>
          {item.props.text || "Título"}
        </div>
      );

    case "subtitle":
      return withTooltip(
        <div className="fb-ft-subtitle" style={{ fontSize, color, textAlign:align, whiteSpace:"normal", overflow:"visible", textOverflow:"unset" }}>
          {item.props.text || "Subtítulo"}
        </div>
      );

    case "label":
      return withTooltip(
        <span style={{ fontSize, fontWeight:item.props.bold?700:400, color, display:"block", lineHeight:1.5, textAlign:align }}>
          {item.props.text || "Rótulo"}
        </span>
      );

    case "divider":
      return <div className="fb-ft-divider"><div className="fb-ft-divider-line" /></div>;

    case "name":
      return (
        <div className="fb-ft-name" style={wrapperStyle}>
          <span className="fb-ft-name-label" style={{ color }}>{item.props.label}</span>
          {readOnly
            ? <input className="fb-ft-name-input" placeholder="Nome completo..." value={val} onChange={e=>sv(e.target.value)} style={inputStyle}/>
            : <input className="fb-ft-name-input" placeholder="Nome completo..." disabled style={inputStyle}/>
          }
        </div>
      );

    case "input":
      return (
        <div style={wrapperStyle}>
          <label className="fb-ft-label" style={{ fontSize:`${Math.max(9,Number(item.props.fontSize||13)-2)}px`, color }}>{item.props.label}</label>
          {readOnly
            ? <input placeholder={item.props.placeholder} className="fb-ft-input" value={val} onChange={e=>sv(e.target.value)} style={inputStyle}/>
            : <input disabled placeholder={item.props.placeholder} className="fb-ft-input" style={inputStyle}/>
          }
        </div>
      );

    case "textarea":
      return (
        <div style={wrapperStyle}>
          <label className="fb-ft-label" style={{ fontSize:`${Math.max(9,Number(item.props.fontSize||13)-2)}px`, color }}>{item.props.label}</label>
          {readOnly
            ? <textarea placeholder={item.props.placeholder} rows={2} className="fb-ft-textarea" value={val} onChange={e=>sv(e.target.value)} style={inputStyle}/>
            : <textarea disabled placeholder={item.props.placeholder} rows={2} className="fb-ft-textarea" style={inputStyle}/>
          }
        </div>
      );

    case "checkbox":
      return (
        <div className="fb-ft-checkbox" style={wrapperStyle}>
          {readOnly
            ? <input type="checkbox" style={{ width:14,height:14,flexShrink:0 }} checked={!!val} onChange={e=>sv(e.target.checked)}/>
            : <input type="checkbox" disabled style={{ width:14,height:14,flexShrink:0 }}/>
          }
          <span className="fb-ft-checkbox-label" style={{ fontSize, color }}>{item.props.label}</span>
        </div>
      );

    case "select":
      return (
        <div style={wrapperStyle}>
          <label className="fb-ft-label" style={{ fontSize:`${Math.max(9,Number(item.props.fontSize||13)-2)}px`, color }}>{item.props.label}</label>
          {readOnly
            ? <select className="fb-ft-select" value={val} onChange={e=>sv(e.target.value)} style={inputStyle}>
                <option value="">Selecione...</option>
                {(item.props.options||[]).map((o,i)=><option key={i}>{o}</option>)}
              </select>
            : <select disabled className="fb-ft-select" style={inputStyle}>
                {(item.props.options||[]).map((o,i)=><option key={i}>{o}</option>)}
              </select>
          }
        </div>
      );

    case "image":
      return <ImageField item={item} onPropChange={onPropChange} readOnly={readOnly}/>;

    case "submit":
      if (!readOnly) {
        return (
          <div style={{ textAlign:align }}>
            <button className="fb-submit-preview" disabled>💾 {item.props.label||"Salvar Respostas"}</button>
          </div>
        );
      }
      return (
        <div style={{ textAlign:align }}>
          <button
            className="fb-submit-btn"
            onClick={onSaveData}
            disabled={saveDataState==="saving"}
            style={saveDataState==="saved"?{background:"#10b981"}:saveDataState==="error"?{background:"#ef4444"}:{}}
          >
            💾 {saveDataState==="saving"?"Salvando...":saveDataState==="saved"?"Salvo!":saveDataState==="error"?"Erro":item.props.label||"Salvar Respostas"}
          </button>
        </div>
      );

    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DragGrid
// ─────────────────────────────────────────────────────────────────────────────
function DragGrid({ visible }) {
  if (!visible) return null;
  return (
    <div className="fb-drag-grid" aria-hidden="true">
      {Array.from({length:12}).map((_,i)=>(
        <div key={i} className="fb-drag-grid-col"><span className="fb-drag-grid-num">{i+1}</span></div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldCard
// ─────────────────────────────────────────────────────────────────────────────
function FieldCard({ item, rowId, onDelete, onEdit, onResizeEnd, onHeightResizeEnd, onPropChange, onFieldDragStart, dragOverId, onDragOver, onDrop, onDragStart, onDragEnd }) {
  const cardRef   = useRef(null);
  const resizingH = useRef(false);
  const resizingV = useRef(false);
  const startX    = useRef(0);
  const startY    = useRef(0);
  const startW    = useRef(0);
  const startHt   = useRef(0);
  const rowW      = useRef(0);
  const [tipH, setTipH] = useState(null);
  const [tipV, setTipV] = useState(null);

  const cols   = item.props.cols   || 12;
  const height = item.props.height || null;
  const align  = item.props.align  || "left";

  const onResizeHDown = useCallback(e => {
    e.preventDefault(); e.stopPropagation();
    resizingH.current = true;
    startX.current = e.clientX;
    startW.current = cardRef.current.offsetWidth;
    rowW.current   = cardRef.current.parentElement.offsetWidth;
    const onMove = ev => {
      if (!resizingH.current) return;
      const w = Math.max(44, startW.current + ev.clientX - startX.current);
      const c = snapCols((w / rowW.current) * 100);
      cardRef.current.style.width = `calc(${colsPct(c)}% - 8px)`;
      setTipH(`${c}/12`);
    };
    const onUp = ev => {
      resizingH.current = false;
      const w = Math.max(44, startW.current + ev.clientX - startX.current);
      onResizeEnd(rowId, item.id, snapCols((w/rowW.current)*100));
      setTipH(null);
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
    };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
  },[item.id,rowId,onResizeEnd]);

  const onResizeVDown = useCallback(e => {
    e.preventDefault(); e.stopPropagation();
    resizingV.current = true;
    startY.current  = e.clientY;
    startHt.current = cardRef.current.offsetHeight;
    const onMove = ev => {
      if (!resizingV.current) return;
      const h = Math.max(ROW_MIN_HEIGHT, startHt.current + ev.clientY - startY.current);
      const s = Math.round(h/ROW_HEIGHT_STEP)*ROW_HEIGHT_STEP;
      cardRef.current.style.minHeight = `${s}px`;
      setTipV(`${s}px`);
    };
    const onUp = ev => {
      resizingV.current = false;
      const h = Math.max(ROW_MIN_HEIGHT, startHt.current + ev.clientY - startY.current);
      onHeightResizeEnd(rowId, item.id, Math.round(h/ROW_HEIGHT_STEP)*ROW_HEIGHT_STEP);
      setTipV(null);
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
    };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
  },[item.id,rowId,onHeightResizeEnd]);

  const isDragOver = dragOverId === item.id;
  const alignOffset = (() => {
    if (cols===12) return {};
    const pct = colsPct(cols);
    if (align==="center") return { marginLeft:`calc((100% - ${pct}% + 8px) / 2)` };
    if (align==="right")  return { marginLeft:`calc(100% - ${pct}%)` };
    return {};
  })();

  // tipos com tooltip não precisam do botão lápis
  const hasTooltip = TOOLTIP_TYPES.includes(item.type);

  return (
    <div
      ref={cardRef}
      className={`fb-field-card${isDragOver?" fb-field-card--over":""}`}
      style={{ width:`calc(${colsPct(cols)}% - 8px)`, minHeight:height?`${height}px`:undefined, ...alignOffset }}
      onDragOver={e=>{ e.preventDefault(); onDragOver(item.id); }}
      onDrop={e=>{ e.preventDefault(); e.stopPropagation(); onDrop(rowId,item.id); }}
    >
      <div className="fb-field-grip" draggable
        onDragStart={e=>{ e.stopPropagation(); onFieldDragStart(e,rowId,item.id); onDragStart?.(); }}
        onDragEnd={()=>onDragEnd?.()}
        title="Arrastar">
        <FaGripVertical/>
      </div>

      <div className="fb-field-badge">{cols}/12</div>

      <FieldContent item={item} onPropChange={onPropChange} readOnly={false}/>

      <div className="fb-field-actions">
        {!hasTooltip && (
          <button className="fb-act edit" onClick={()=>onEdit(item,rowId)} title="Opções">✏️</button>
        )}
        <button className="fb-act delete" onClick={()=>onDelete(rowId,item.id)} title="Remover">✕</button>
      </div>

      <div className="fb-resize-handle fb-resize-handle--h" onMouseDown={onResizeHDown}>↔</div>
      <div className="fb-resize-handle fb-resize-handle--v" onMouseDown={onResizeVDown}>↕</div>
      <div className="fb-resize-handle fb-resize-handle--corner"
        onMouseDown={e=>{ onResizeHDown(e); onResizeVDown(e); }}>⤡</div>

      {tipH && <div className="fb-resize-tip fb-resize-tip--h">{tipH}</div>}
      {tipV && <div className="fb-resize-tip fb-resize-tip--v">{tipV}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FormRow
// ─────────────────────────────────────────────────────────────────────────────
function FormRow({ row, rowIndex, totalRows, onDeleteRow, onMoveUp, onMoveDown, onEditItem, onDeleteItem, onResizeEnd, onHeightResizeEnd, onPropChange, onFieldDragStart, dragOverId, onDragOver, onDropField, onSidebarDrop, showGrid, onDragStart, onDragEnd }) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`fb-row${over?" fb-row--over":""}`}
      onDragOver={e=>{ e.preventDefault(); if([...e.dataTransfer.types].includes("application/x-sidebar")) setOver(true); }}
      onDragLeave={e=>{ if(!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={e=>{ e.preventDefault(); setOver(false); if([...e.dataTransfer.types].includes("application/x-sidebar")) onSidebarDrop(e,row.id); }}
    >
      <div className="fb-row-badge">LINHA {rowIndex+1}</div>
      <DragGrid visible={showGrid}/>
      <div className="fb-row-items">
        {row.items.length===0
          ? <div className="fb-row-empty">↙ Arraste um componente aqui</div>
          : row.items.map(item=>(
              <FieldCard key={item.id} item={item} rowId={row.id}
                onDelete={onDeleteItem} onEdit={onEditItem}
                onResizeEnd={onResizeEnd} onHeightResizeEnd={onHeightResizeEnd}
                onPropChange={onPropChange} onFieldDragStart={onFieldDragStart}
                dragOverId={dragOverId} onDragOver={onDragOver} onDrop={onDropField}
                onDragStart={onDragStart} onDragEnd={onDragEnd}/>
            ))
        }
      </div>
      <div className="fb-row-footer">
        <div className="fb-row-move">
          <button disabled={rowIndex===0}              onClick={()=>onMoveUp(rowIndex)}   className="fb-row-move-btn">▲</button>
          <button disabled={rowIndex===totalRows-1}    onClick={()=>onMoveDown(rowIndex)} className="fb-row-move-btn">▼</button>
        </div>
        <button className="fb-btn-remove-row" onClick={()=>onDeleteRow(row.id)}>🗑 remover linha</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewRow
// ─────────────────────────────────────────────────────────────────────────────
function ViewRow({ row, formValues, onFormValueChange, onSaveData, saveDataState }) {
  return (
    <div className="fb-view-row">
      {row.items.map(item=>{
        const cols  = item.props.cols  || 12;
        const align = item.props.align || "left";
        const alignOffset = (()=>{
          if(cols===12) return {};
          const pct = colsPct(cols);
          if(align==="center") return { marginLeft:`calc((100% - ${pct}% + 8px) / 2)` };
          if(align==="right")  return { marginLeft:`calc(100% - ${pct}%)` };
          return {};
        })();
        return (
          <div key={item.id} className="fb-view-field"
            style={{ width:`calc(${colsPct(cols)}% - 8px)`, ...alignOffset }}>
            <FieldContent item={item} onPropChange={()=>{}} readOnly={true}
              formValues={formValues} onFormValueChange={onFormValueChange}
              onSaveData={onSaveData} saveDataState={saveDataState}/>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Save states
// ─────────────────────────────────────────────────────────────────────────────
const SAVE_ST = {
  idle:  ["✓ Publicar Formulário",""],
  saving:["⏳ Salvando...","saving"],
  saved: ["✓ Publicado!","saved"],
  error: ["✗ Erro ao salvar","error"],
};

// ─────────────────────────────────────────────────────────────────────────────
// FormBuilder principal
// ─────────────────────────────────────────────────────────────────────────────
export default function FormBuilder({ notaId, notaNome, onClose, usuarioId, projetoAtual }) {
  const [rows,         setRows]         = useState([{ id:genId(), items:[] }]);
  const [formTitle,    setFormTitle]    = useState(notaNome||"Formulário");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingItem,  setEditingItem]  = useState(null);
  const [editRowId,    setEditRowId]    = useState(null);

  const draggingMeta = useRef(null);
  const [dragOverId, setDragOverId]  = useState(null);
  const [isDragging, setIsDragging]  = useState(false);
  const [sidebarComp,setSidebarComp] = useState(null);
  const [sidebarDrag,setSidebarDrag] = useState(false);

  const [saveState,  setSaveState]  = useState("idle");
  const [saveDataSt, setSaveDataSt] = useState("idle");
  const saveTimer     = useRef(null);
  const saveDataTimer = useRef(null);

  const [viewMode, setViewMode] = useState(false);
  const [ownerId,  setOwnerId]  = useState(null);
  const isOwner = !ownerId || ownerId === usuarioId;
  const [formValues, setFormValues] = useState({});
  const showGrid = isDragging || sidebarDrag;

  useEffect(()=>{
    if(!notaId) return;
    supabase.from("notas").select("conteudo,responsavel").eq("id",notaId).single()
      .then(({data,error})=>{
        if(error||!data) return;
        if(data.responsavel) setOwnerId(data.responsavel);
        if(!data.conteudo) return;
        try {
          const p = typeof data.conteudo==="string"?JSON.parse(data.conteudo):data.conteudo;
          if(p?.rows?.length){ setRows(p.rows); setViewMode(true); }
          if(p?.title) setFormTitle(p.title);
          if(p?.formValues) setFormValues(p.formValues);
        } catch {}
      });
  },[notaId]);

  const addRow      = ()   => setRows(r=>[...r,{id:genId(),items:[]}]);
  const deleteRow   = id   => setRows(r=>r.filter(row=>row.id!==id));
  const moveRowUp   = idx  => setRows(p=>{ if(!idx) return p; const a=[...p]; [a[idx-1],a[idx]]=[a[idx],a[idx-1]]; return a; });
  const moveRowDown = idx  => setRows(p=>{ if(idx>=p.length-1) return p; const a=[...p]; [a[idx],a[idx+1]]=[a[idx+1],a[idx]]; return a; });

  const addItem = (rowId,comp) =>
    setRows(r=>r.map(row=>row.id!==rowId?row:{
      ...row, items:[...row.items,{id:genId(),type:comp.type,props:{...comp.defaultProps,cols:12}}]
    }));
  const deleteItem = (rowId,itemId) =>
    setRows(r=>r.map(row=>row.id!==rowId?row:{...row,items:row.items.filter(i=>i.id!==itemId)}));

  const propChange = (itemId,key,value) =>
    setRows(r=>r.map(row=>({
      ...row,
      items:row.items.map(i=>i.id!==itemId?i:{...i,props:{...i.props,[key]:value}})
    })));

  const editItem = (item,rowId)=>{ setEditingItem(JSON.parse(JSON.stringify(item))); setEditRowId(rowId); };
  const saveEdit = ()=>{
    setRows(r=>r.map(row=>row.id!==editRowId?row:{
      ...row,items:row.items.map(i=>i.id===editingItem.id?editingItem:i)
    }));
    setEditingItem(null); setEditRowId(null);
  };

  const resizeEnd = useCallback((rowId,itemId,newCols)=>
    setRows(r=>r.map(row=>row.id!==rowId?row:{
      ...row,items:row.items.map(i=>i.id!==itemId?i:{...i,props:{...i.props,cols:newCols}})
    })),[]);

  const heightResizeEnd = useCallback((rowId,itemId,newH)=>
    setRows(r=>r.map(row=>row.id!==rowId?row:{
      ...row,items:row.items.map(i=>i.id!==itemId?i:{...i,props:{...i.props,height:newH}})
    })),[]);

  const onFieldDragStart=(e,fromRowId,itemId)=>{
    draggingMeta.current={fromRowId,itemId};
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("application/x-field",itemId);
    setIsDragging(true);
  };
  const onDragOverField = id => setDragOverId(id);
  const onDropField=(toRowId,toItemId)=>{
    setDragOverId(null); setIsDragging(false);
    const meta=draggingMeta.current;
    if(!meta||meta.itemId===toItemId) return;
    setRows(prev=>{
      const next=prev.map(r=>({...r,items:[...r.items]}));
      let moving=null;
      for(const r of next){
        const idx=r.items.findIndex(i=>i.id===meta.itemId);
        if(idx!==-1){ [moving]=r.items.splice(idx,1); break; }
      }
      if(!moving) return prev;
      for(const r of next){
        if(r.id!==toRowId) continue;
        const toIdx=r.items.findIndex(i=>i.id===toItemId);
        toIdx===-1?r.items.push(moving):r.items.splice(toIdx,0,moving);
        break;
      }
      return next;
    });
    draggingMeta.current=null;
  };
  const onSidebarDrop=(e,rowId)=>{
    if(sidebarComp){ addItem(rowId,sidebarComp); setSidebarComp(null); }
  };
  const handleFormValueChange=(itemId,value)=>
    setFormValues(prev=>({...prev,[itemId]:value}));

  const handleSave=async()=>{
    if(!notaId){ alert("ID da nota não encontrado."); return; }
    setSaveState("saving");
    const {error}=await supabase.from("notas")
      .update({conteudo:JSON.stringify({title:formTitle,rows})})
      .eq("id",notaId);
    setSaveState(error?"error":"saved");
    if(!error) setViewMode(true);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>setSaveState("idle"),3000);
  };

  const handleSaveData=async()=>{
    if(!notaId){ alert("ID da nota não encontrado."); return; }
    setSaveDataSt("saving");
    try {
      const {data:cur}=await supabase.from("notas").select("conteudo").eq("id",notaId).single();
      const base=cur?.conteudo?(typeof cur.conteudo==="string"?JSON.parse(cur.conteudo):cur.conteudo):{};
      const {error}=await supabase.from("notas")
        .update({conteudo:JSON.stringify({...base,formValues,savedAt:new Date().toISOString()})})
        .eq("id",notaId);
      setSaveDataSt(error?"error":"saved");
    } catch { setSaveDataSt("error"); }
    clearTimeout(saveDataTimer.current);
    saveDataTimer.current=setTimeout(()=>setSaveDataSt("idle"),3000);
  };

  const totalFields=rows.reduce((s,r)=>s+r.items.length,0);
  const [saveLabel,saveCls]=SAVE_ST[saveState];

  // ═══ VIEW MODE ═══════════════════════════════════════════════════════════
  if(viewMode){
    return(
      <div className="fb-page">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{projetoAtual?.name||"Sem projeto"}</span>
            <div className="sub-info"><span className="nota-name">{formTitle}</span></div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {isOwner&&(
              <button className="fb-btn-edit-discrete" onClick={()=>setViewMode(false)}>
                <FaEdit size={11}/> Editar
              </button>
            )}
            {onClose&&<button className="listagem-close-btn" onClick={onClose}><FaTimes/></button>}
          </div>
        </div>

        <div className="fb-body fb-body--view">
          <div className="fb-view-canvas">
            {rows.map(row=>row.items.length>0&&(
              <ViewRow key={row.id} row={row}
                formValues={formValues}
                onFormValueChange={handleFormValueChange}
                onSaveData={handleSaveData}
                saveDataState={saveDataSt}/>
            ))}
            {rows.every(r=>r.items.length===0)&&(
              <p style={{color:"#94a3b8",textAlign:"center",padding:"40px 0",fontSize:14}}>
                Formulário sem campos.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══ EDIT MODE ═══════════════════════════════════════════════════════════
  return(
    <div className="fb-page"
      onDragEnd={()=>{ setDragOverId(null); setIsDragging(false); draggingMeta.current=null; }}>

      <div className="listagem-header-container">
        <div className="listagem-header-titles">
          <span className="project-name">{projetoAtual?.name||"Sem projeto"}</span>
          <div className="sub-info">
            {editingTitle
              ?<input autoFocus className="fb-nota-name-input" value={formTitle}
                  onChange={e=>setFormTitle(e.target.value)}
                  onBlur={()=>setEditingTitle(false)}
                  onKeyDown={e=>(e.key==="Enter"||e.key==="Escape")&&setEditingTitle(false)}/>
              :<span className="nota-name fb-nota-name--editable" onDoubleClick={()=>setEditingTitle(true)} title="Clique duplo para editar">
                  {formTitle} <span className="fb-edit-hint-small">✏️</span>
                </span>
            }
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span className="fb-badge-sm">{totalFields} campo{totalFields!==1?"s":""} · {rows.length} linha{rows.length!==1?"s":""}</span>
          <button className="fb-btn-clear-sm" onClick={()=>setRows([{id:genId(),items:[]}])}>Limpar</button>
          {onClose&&<button className="listagem-close-btn" onClick={onClose}><FaTimes/></button>}
        </div>
      </div>

      <div className="fb-body">
        <div className="fb-canvas">
          {rows.map((row,ri)=>(
            <FormRow key={row.id} row={row} rowIndex={ri} totalRows={rows.length}
              onDeleteRow={deleteRow} onMoveUp={moveRowUp} onMoveDown={moveRowDown}
              onEditItem={editItem} onDeleteItem={deleteItem}
              onResizeEnd={resizeEnd} onHeightResizeEnd={heightResizeEnd}
              onPropChange={propChange} onFieldDragStart={onFieldDragStart}
              dragOverId={dragOverId} onDragOver={onDragOverField} onDropField={onDropField}
              onSidebarDrop={onSidebarDrop} showGrid={showGrid}
              onDragStart={()=>setIsDragging(true)} onDragEnd={()=>setIsDragging(false)}/>
          ))}
          <button className="fb-btn-add-row" onClick={addRow}>+ Nova Linha</button>
        </div>

        <div className="fb-sidebar">
          <p className="fb-sidebar-title">Componentes</p>
          <p className="fb-sidebar-hint">Arraste para a linha ou clique para adicionar</p>
          {COMPONENTS.map(comp=>(
            <div key={comp.type} className="fb-comp-item" draggable
              onDragStart={e=>{ setSidebarComp(comp); setSidebarDrag(true); e.dataTransfer.setData("application/x-sidebar",comp.type); }}
              onDragEnd={()=>{ setSidebarComp(null); setSidebarDrag(false); }}
              onClick={()=>addItem(rows[rows.length-1].id,comp)}>
              <span className="fb-comp-icon">{comp.icon}</span>{comp.label}
            </div>
          ))}
          <div className="fb-sidebar-footer">
            <p className="fb-sidebar-footer-hint">
              💡 Clique em <strong>Título/Subtítulo/Rótulo</strong> para editar inline.<br/>
              ✏️ Lápis para outros campos.<br/>
              💾 Arraste "Botão Salvar" para o formulário.<br/>
              ↔ Borda direita — largura &nbsp;↕ inferior — altura.
            </p>
            <button
              className={`fb-btn-save${saveCls?` fb-btn-save--${saveCls}`:""}`}
              onClick={handleSave} disabled={saveState==="saving"}>
              {saveLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Modal — campos sem tooltip inline */}
      {editingItem&&(
        <div className="fb-modal-bd" onClick={()=>{ setEditingItem(null); setEditRowId(null); }}>
          <div className="fb-modal" onClick={e=>e.stopPropagation()}>
            <h3>✏️ Editar — {editingItem.type}</h3>

            {editingItem.props.placeholder!==undefined&&(
              <div className="fb-modal-field">
                <label className="fb-modal-lbl">Placeholder</label>
                <input className="fb-modal-inp" value={editingItem.props.placeholder||""}
                  onChange={e=>setEditingItem({...editingItem,props:{...editingItem.props,placeholder:e.target.value}})}/>
              </div>
            )}

            {editingItem.type==="select"&&(
              <div className="fb-modal-field">
                <label className="fb-modal-lbl">Opções (uma por linha)</label>
                <textarea className="fb-modal-ta" rows={4}
                  value={(editingItem.props.options||[]).join("\n")}
                  onChange={e=>setEditingItem({...editingItem,props:{...editingItem.props,options:e.target.value.split("\n")}})}/>
              </div>
            )}

            {editingItem.type==="submit"&&(
              <div className="fb-modal-field">
                <label className="fb-modal-lbl">Texto do botão</label>
                <input className="fb-modal-inp" value={editingItem.props.label||"Salvar Respostas"}
                  onChange={e=>setEditingItem({...editingItem,props:{...editingItem.props,label:e.target.value}})}/>
              </div>
            )}

            {!["image","divider","submit"].includes(editingItem.type)&&(
              <div className="fb-modal-field">
                <label className="fb-modal-lbl">Cor do texto</label>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input type="color" style={{width:48,height:36,padding:2,border:"1.5px solid #e2e8f0",borderRadius:6}}
                    value={editingItem.props.color||"#1e293b"}
                    onChange={e=>setEditingItem({...editingItem,props:{...editingItem.props,color:e.target.value}})}/>
                  <span style={{fontSize:11,color:editingItem.props.color,fontWeight:600}}>{editingItem.props.color||"#1e293b"}</span>
                </div>
              </div>
            )}

            {!["image","divider","checkbox","submit"].includes(editingItem.type)&&(
              <div className="fb-modal-field">
                <label className="fb-modal-lbl">Tamanho da letra: {editingItem.props.fontSize||13}px</label>
                <input type="range" min="9" max="72" step="1"
                  value={editingItem.props.fontSize||"13"}
                  onChange={e=>setEditingItem({...editingItem,props:{...editingItem.props,fontSize:e.target.value}})}
                  style={{width:"100%"}}/>
              </div>
            )}

            {!["divider"].includes(editingItem.type)&&(
              <div className="fb-modal-field">
                <label className="fb-modal-lbl">Alinhamento</label>
                <div style={{display:"flex",gap:6}}>
                  {[
                    {v:"left",  Icon:FaAlignLeft,  label:"Esq."},
                    {v:"center",Icon:FaAlignCenter, label:"Centro"},
                    {v:"right", Icon:FaAlignRight,  label:"Dir."},
                  ].map(({v,Icon,label})=>(
                    <button key={v}
                      style={{
                        flex:1,padding:"7px 0",border:"1.5px solid",
                        borderColor:(editingItem.props.align||"left")===v?"#3b4fd8":"#e2e8f0",
                        borderRadius:6,cursor:"pointer",
                        background:(editingItem.props.align||"left")===v?"#eef2ff":"#f8fafc",
                        color:(editingItem.props.align||"left")===v?"#3b4fd8":"#64748b",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:4,fontSize:11,
                      }}
                      onClick={()=>setEditingItem({...editingItem,props:{...editingItem.props,align:v}})}>
                      <Icon size={13}/> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="fb-modal-foot">
              <button className="fb-btn-cancel" onClick={()=>{ setEditingItem(null); setEditRowId(null); }}>Cancelar</button>
              <button className="fb-btn-confirm" onClick={saveEdit}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}