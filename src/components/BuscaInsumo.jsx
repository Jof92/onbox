// src/components/BuscaInsumo.jsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./BuscaInsumo.css";

const DICA_KEY = "busca_insumo_dica_fechada";

function normalizar(str) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function montarPadrao(termo) {
  if (!termo) return null;
  if (termo.includes("%")) return termo.endsWith("%") ? termo : `${termo}%`;
  return `${termo}%`;
}

export default function BuscaInsumoModal({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dicaVisivel, setDicaVisivel] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  // ── Ao abrir o modal ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResultados([]);
      setSelectedIndex(-1);
      setTimeout(() => {
        inputRef.current?.focus();
        if (localStorage.getItem(DICA_KEY) !== "true") setDicaVisivel(true);
      }, 120);
    } else {
      setDicaVisivel(false);
    }
  }, [isOpen]);

  // ── Scroll automático ───────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // ── Busca com debounce ──────────────────────────────────────────────────────
  useEffect(() => {
    const termo = query.trim();
    if (!termo) { setResultados([]); setSelectedIndex(-1); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const termoNorm = normalizar(termo);
        const padraoOriginal = montarPadrao(termo);
        const padraoNorm = montarPadrao(termoNorm);

        const [{ data: d1, error: e1 }, { data: d2, error: e2 }] = await Promise.all([
          supabase.from("itens").select("codigo, descricao, unidade").ilike("descricao", padraoOriginal).limit(200),
          supabase.from("itens").select("codigo, descricao, unidade").ilike("descricao", padraoNorm).limit(200),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;

        const mapa = new Map();
        [...(d1 || []), ...(d2 || [])].forEach((i) => { if (!mapa.has(i.codigo)) mapa.set(i.codigo, i); });

        const partes = termoNorm.split("%").filter(Boolean).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const regex = partes.length > 0 ? new RegExp(partes.join(".*"), "i") : null;

        const filtrado = [...mapa.values()].filter((i) => !regex || regex.test(normalizar(i.descricao)));
        const primeiraParte = partes[0] || "";
        filtrado.sort((a, b) => {
          const aN = normalizar(a.descricao), bN = normalizar(b.descricao);
          return (aN.startsWith(primeiraParte) ? 0 : 1) - (bN.startsWith(primeiraParte) ? 0 : 1) || aN.localeCompare(bN);
        });

        const limitado = filtrado.slice(0, 80);
        setResultados(limitado);
        setSelectedIndex(limitado.length > 0 ? 0 : -1);
        itemRefs.current = new Array(limitado.length);
      } catch (err) {
        console.error("Erro na busca:", err);
        setResultados([]);
        setSelectedIndex(-1);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      if (dicaVisivel) { fecharDica(); }
      else { onClose(); }
      return;
    }
    if (resultados.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, resultados.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (selectedIndex >= 0) handleSelect(resultados[selectedIndex]); }
  };

  const handleSelect = (item) => { onSelect(item.codigo); onClose(); };

  const fecharDica = () => {
    setDicaVisivel(false);
    localStorage.setItem(DICA_KEY, "true");
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="bi-overlay" onClick={onClose}>
      <div className="bi-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Cabeçalho ── */}
        <div className="bi-header">
          <span className="bi-title">Buscar insumo</span>
          <button className="bi-close-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        {/* ── Campo de busca ── */}
        <div className="bi-search-area">
          <div className="bi-search-bar">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => { if (localStorage.getItem(DICA_KEY) !== "true") setDicaVisivel(true); }}
              onKeyDown={handleKeyDown}
              placeholder="Digite o nome ou código do insumo..."
              className="bi-input"
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button
                className="bi-icon-btn"
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                title="Limpar busca"
                tabIndex={-1}
              >✕</button>
            ) : (
              <button
                className={`bi-icon-btn bi-help-btn ${dicaVisivel ? "bi-help-btn--active" : ""}`}
                onClick={() => setDicaVisivel((v) => !v)}
                title="Como pesquisar?"
                tabIndex={-1}
              >?</button>
            )}
          </div>

          {/* ── Balão de ajuda — fica ABAIXO do input, não tampona ── */}
          {dicaVisivel && (
            <div className="bi-balloon">
              <div className="bi-balloon-arrow" />
              <div className="bi-balloon-header">
                <span className="bi-balloon-titulo">Como pesquisar</span>
                <button className="bi-balloon-close" onClick={fecharDica} aria-label="Fechar dica">✕</button>
              </div>

              <div className="bi-balloon-lista">
                <div className="bi-balloon-item">
                  <code className="bi-balloon-exemplo">tabua</code>
                  <span className="bi-balloon-desc">Busca por início da palavra — sem acento funciona: <em>tábua</em> = <em>tabua</em></span>
                </div>
                <div className="bi-balloon-item">
                  <code className="bi-balloon-exemplo">%tabua</code>
                  <span className="bi-balloon-desc">O <strong>%</strong> no início encontra a palavra em qualquer posição da descrição</span>
                </div>
                <div className="bi-balloon-item">
                  <code className="bi-balloon-exemplo">%tub%PVC%90</code>
                  <span className="bi-balloon-desc">Múltiplos <strong>%</strong> buscam vários termos em sequência → <em>Tubo PVC 90mm</em></span>
                </div>
                <div className="bi-balloon-item">
                  <code className="bi-balloon-exemplo">%paraf%zinc%6</code>
                  <span className="bi-balloon-desc">Encontra <em>Parafuso zincado 6mm</em> ou <em>Parafuso de zinco 6"</em></span>
                </div>
              </div>

              <p className="bi-balloon-rodape">
                Use <kbd>↑</kbd> <kbd>↓</kbd> para navegar e <kbd>Enter</kbd> para selecionar
              </p>
            </div>
          )}
        </div>

        {/* ── Tabela de resultados ── */}
        <div className="bi-table-wrapper" ref={listRef}>
          {loading ? (
            <div className="bi-status">Buscando...</div>
          ) : resultados.length === 0 && query.trim() ? (
            <div className="bi-status">Nenhum insumo encontrado.</div>
          ) : resultados.length === 0 ? (
            <div className="bi-status bi-status-idle">Digite para pesquisar</div>
          ) : (
            <table className="bi-table">
              <thead>
                <tr>
                  <th className="bi-th bi-th-codigo">Código</th>
                  <th className="bi-th bi-th-descricao">Descrição</th>
                  <th className="bi-th bi-th-unidade">Und.</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((item, index) => (
                  <tr
                    key={item.codigo}
                    ref={(el) => (itemRefs.current[index] = el)}
                    className={`bi-tr ${index === selectedIndex ? "bi-tr--selected" : ""}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <td className="bi-td bi-td-codigo">{item.codigo}</td>
                    <td className="bi-td bi-td-descricao">{item.descricao}</td>
                    <td className="bi-td bi-td-unidade">{item.unidade || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Rodapé ── */}
        {resultados.length > 0 && (
          <div className="bi-footer">
            {resultados.length} resultado{resultados.length !== 1 ? "s" : ""} encontrado{resultados.length !== 1 ? "s" : ""}
            {resultados.length === 80 && <span className="bi-footer-limit"> — mostrando os primeiros 80</span>}
          </div>
        )}
      </div>
    </div>
  );
}