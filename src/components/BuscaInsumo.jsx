// src/components/BuscaInsumo.jsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./BuscaInsumo.css";

export default function BuscaInsumoModal({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResultados([]);
      setSelectedIndex(-1);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResultados([]);
      setSelectedIndex(-1);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        let busca;
        const termo = query.trim();

        if (termo.startsWith("%")) {
          const likeTerm = termo.slice(1).replace(/%/g, "");
          const { data, error } = await supabase
            .from("itens")
            .select("codigo, descricao, unidade")
            .ilike("descricao", `%${likeTerm}%`)
            .limit(50);
          if (error) throw error;
          busca = data || [];
        } else {
          const { data, error } = await supabase
            .from("itens")
            .select("codigo, descricao, unidade")
            .ilike("descricao", `${termo}%`)
            .limit(50);
          if (error) throw error;
          busca = data || [];
        }

        setResultados(busca);
        setSelectedIndex(busca.length > 0 ? 0 : -1);
      } catch (err) {
        console.error("Erro na busca de insumos:", err);
        setResultados([]);
        setSelectedIndex(-1);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    if (resultados.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0) {
        handleSelect(resultados[selectedIndex]);
      }
    }
  };

  const handleSelect = (item) => {
    onSelect(item.codigo);
    onClose();
  };

  const handleMouseMove = (index) => {
    setSelectedIndex(index);
  };

  if (!isOpen) return null;

  return (
    <div className="busca-insumo-overlay" onClick={onClose}>
      <div
        className="busca-insumo-modal"
        onClick={(e) => e.stopPropagation()}
        // ❌ REMOVIDO onKeyDown aqui
      >
        <div className="busca-insumo-header">
          <h3 className="busca-insumo-title">Buscar insumos</h3>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown} // ✅ Apenas aqui
            placeholder="Digite o nome do insumo (ou %nome para busca parcial)"
            className="busca-insumo-input"
          />
        </div>
        <div className="busca-insumo-results">
          {loading ? (
            <div className="busca-insumo-loading">Buscando...</div>
          ) : resultados.length === 0 && query.trim() ? (
            <div className="busca-insumo-empty">Nenhum insumo encontrado.</div>
          ) : (
            resultados.map((item, index) => (
              <div
                key={item.codigo}
                className={`busca-insumo-item ${
                  index === selectedIndex ? "selected" : ""
                }`}
                onClick={() => handleSelect(item)}
                onMouseMove={() => handleMouseMove(index)}
              >
                <div className="busca-insumo-item-codigo">{item.codigo}</div>
                <div className="busca-insumo-item-descricao">{item.descricao}</div>
                <div className="busca-insumo-item-unidade">{item.unidade || "–"}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}