// src/components/BuscaInsumo.jsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./BuscaInsumo.css"; // vamos criar um CSS simples

export default function BuscaInsumoModal({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResultados([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResultados([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        let busca;
        let termo = query.trim();

        if (termo.startsWith("%")) {
          // Busca parcial (LIKE %termo%)
          const likeTerm = termo.slice(1).replace(/%/g, ""); // remove % adicional
          const { data, error } = await supabase
            .from("itens")
            .select("codigo, descricao, unidade")
            .ilike("descricao", `%${likeTerm}%`)
            .limit(50);
          if (error) throw error;
          busca = data || [];
        } else {
          // Busca por início (ILIKE termo%)
          const { data, error } = await supabase
            .from("itens")
            .select("codigo, descricao, unidade")
            .ilike("descricao", `${termo}%`)
            .limit(50);
          if (error) throw error;
          busca = data || [];
        }

        setResultados(busca);
      } catch (err) {
        console.error("Erro na busca de insumos:", err);
        setResultados([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleSelect = (item) => {
    onSelect(item.codigo);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="busca-insumo-overlay" onClick={onClose}>
      <div className="busca-insumo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="busca-insumo-header">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o nome do insumo (ou %nome para busca parcial)"
            className="busca-insumo-input"
          />
        </div>
        <div className="busca-insumo-results">
          {loading ? (
            <div className="busca-insumo-loading">Buscando...</div>
          ) : resultados.length === 0 && query ? (
            <div className="busca-insumo-empty">Nenhum insumo encontrado.</div>
          ) : (
            resultados.map((item, idx) => (
              <div
                key={idx}
                className="busca-insumo-item"
                onDoubleClick={() => handleSelect(item)}
                onClick={() => handleSelect(item)} // opcional: clique simples também
              >
                <strong>{item.codigo}</strong> - {item.descricao} - <em>{item.unidade || "–"}</em>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}