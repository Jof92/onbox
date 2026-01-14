// src/components/ListagemEspelho.jsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import "./ListagemEspelho.css";
import "./loader.css";
import { FaPaperPlane, FaPlus, FaTimes } from "react-icons/fa";
import Check from "./Check";
import Loading from "./Loading";

export default function ListagemEspelho({ projetoOrigem, notaOrigem, notaEspelhoId, onClose, onStatusUpdate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusEnvio, setStatusEnvio] = useState(null);
  const [tooltipAberto, setTooltipAberto] = useState(null);
  const tooltipRef = useRef(null);

  // Fechar tooltip ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setTooltipAberto(null);
      }
    };

    if (tooltipAberto !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [tooltipAberto]);

  // Função para formatar texto em Title Case
  const formatarTitleCase = (texto) => {
    if (!texto || typeof texto !== 'string') return texto;
    
    return texto
      .toLowerCase()
      .split(' ')
      .map(palavra => {
        if (palavra.length === 0) return palavra;
        return palavra.charAt(0).toUpperCase() + palavra.slice(1);
      })
      .join(' ');
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      if (!notaEspelhoId) {
        setRows([]);
        return;
      }

      const { data: itensSalvos, error } = await supabase
        .from("planilha_itens")
        .select("*")
        .eq("nota_id", notaEspelhoId)
        .order("ordem", { ascending: true });

      if (error) throw error;

      const mapped = (itensSalvos || []).map(item => {
        // Processar locação
        let locacaoArray = [];
        try {
          if (typeof item.locacao === 'string') {
            const parsed = JSON.parse(item.locacao);
            if (Array.isArray(parsed)) {
              locacaoArray = parsed;
            } else {
              locacaoArray = item.locacao ? [item.locacao] : [];
            }
          } else if (Array.isArray(item.locacao)) {
            locacaoArray = item.locacao;
          } else if (item.locacao != null) {
            locacaoArray = [String(item.locacao)];
          }
        } catch (e) {
          locacaoArray = item.locacao ? [String(item.locacao)] : [];
        }

        // Verificar se é item CRIAR
        const isCriar = (item.codigo || "").toLowerCase() === "criar";
        
        // Formatar descrição se necessário
        let descricaoFormatada = item.descricao || "";
        if (isCriar && descricaoFormatada) {
          // Verificar se está toda em CAIXA ALTA
          const isUpperCase = descricaoFormatada === descricaoFormatada.toUpperCase() &&
                              descricaoFormatada !== descricaoFormatada.toLowerCase();
          
          if (isUpperCase) {
            descricaoFormatada = formatarTitleCase(descricaoFormatada);
          }
        }

        return {
          id: item.id,
          item_original_id: item.item_original_id,
          selecionado: Boolean(item.selecionado),
          codigo: item.codigo || "",
          descricao: descricaoFormatada,
          unidade: item.unidade || "",
          quantidade: item.quantidade || "",
          locacao: locacaoArray,
          eap: item.eap || "",
          observacao: item.observacao || "",
          comentario: item.comentario || "",
          criado_em: item.criado_em || null,
          grupo_envio: item.grupo_envio || "antigo",
          data_envio: item.data_envio || item.criado_em,
          enviado_por: item.enviado_por || "Usuário",
          isCriar: isCriar,
          ordem: item.ordem || 0,
        };
      });

      setRows(mapped);
    } catch (err) {
      console.error("Erro ao carregar listagem espelho:", err);
      alert("Erro ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [notaEspelhoId]);

  const toggleSelecionado = async (id, novoValor) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, selecionado: novoValor } : r)));

    try {
      const { error } = await supabase
        .from("planilha_itens")
        .update({ selecionado: novoValor })
        .eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao salvar seleção:", err);
      setRows(prev => prev.map(r => (r.id === id ? { ...r, selecionado: !novoValor } : r)));
      alert("Erro ao salvar a marcação.");
    }
  };

  const handleInputChange = (id, campo, valor) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [campo]: valor } : r)));
  };

  const atualizarOriginal = async (itemOriginalId, updateData) => {
    if (!itemOriginalId) return;
    try {
      const { error } = await supabase
        .from("planilha_itens")
        .update(updateData)
        .eq("id", itemOriginalId);
      if (error) {
        console.error("Erro ao atualizar item original:", error);
      }
    } catch (err) {
      console.error("Exceção ao atualizar original:", err);
    }
  };

  const handleComentarioBlur = async (id, novoComentario) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;

    try {
      const updateData = { comentario: novoComentario || null };
      const { error: espelhoError } = await supabase
        .from("planilha_itens")
        .update(updateData)
        .eq("id", id);
      if (espelhoError) throw espelhoError;

      await atualizarOriginal(row.item_original_id, updateData);
      setRows(prev => prev.map(r => (r.id === id ? { ...r, comentario: novoComentario } : r)));
    } catch (err) {
      console.error("Erro ao salvar comentário:", err);
      alert("Erro ao salvar comentário.");
    }
  };

  const handleAddCriar = async (row) => {
    if (!row.codigo?.trim() || row.codigo.toLowerCase() === "criar") {
      alert("Digite um código válido antes de criar o item!");
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from("itens")
        .insert({
          codigo: row.codigo.trim(),
          descricao: row.descricao || "",
          unidade: row.unidade || null,
        });
      if (insertError && insertError.code !== '23505') {
        throw insertError;
      }

      const updateData = {
        codigo: row.codigo.trim(),
        descricao: row.descricao || "",
        isCriar: false,
      };
      const { error: updateEspelhoError } = await supabase
        .from("planilha_itens")
        .update({
          codigo: row.codigo.trim(),
          descricao: row.descricao || "",
        })
        .eq("id", row.id);
      if (updateEspelhoError) throw updateEspelhoError;

      await atualizarOriginal(row.item_original_id, {
        codigo: row.codigo.trim(),
        descricao: row.descricao || "",
      });

      setRows(prev =>
        prev.map(r =>
          r.id === row.id
            ? { ...r, ...updateData }
            : r
        )
      );

      alert("Item atualizado! A listagem original foi sincronizada.");
    } catch (err) {
      console.error("Erro ao criar item:", err);
      alert("Erro ao salvar: " + (err.message || "Erro desconhecido"));
    }
  };

  const handleSave = async () => {
    if (!notaEspelhoId) return;
    setStatusEnvio("enviando");
    try {
      await Promise.all(
        rows.map(async (row) => {
          const updateData = { selecionado: row.selecionado };
          if (row.isCriar) {
            updateData.codigo = row.codigo?.trim() || null;
            updateData.descricao = row.descricao || null;
          }

          await supabase.from("planilha_itens").update(updateData).eq("id", row.id);
          if (row.item_original_id) {
            await supabase.from("planilha_itens").update(updateData).eq("id", row.item_original_id);
          }
        })
      );

      const { data: notaEspelhoData } = await supabase
        .from("notas")
        .select("nota_original_id")
        .eq("id", notaEspelhoId)
        .single();

      if (!notaEspelhoData?.nota_original_id) {
        throw new Error("Nota original não encontrada.");
      }

      const notaOriginalId = notaEspelhoData.nota_original_id;

      await supabase.from("notas").update({ respondida: true }).eq("id", notaOriginalId);
      await supabase.from("notas").update({ respondida: true }).eq("id", notaEspelhoId);

      if (onStatusUpdate) {
        onStatusUpdate(notaOriginalId, { respondida: true, enviada: true });
        onStatusUpdate(notaEspelhoId, { respondida: true, enviada: true });
      }

      setStatusEnvio("sucesso");
      setTimeout(() => setStatusEnvio(null), 2000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar a lista.");
      setStatusEnvio(null);
    }
  };

  if (loading) {
    return (
      <div className="listagem-card">
        <Loading />
      </div>
    );
  }

  const rowsParaExibir = [...rows].reverse();

  return (
    <div className="listagem-card">
      <div className="listagem-header-container">
        <div className="listagem-header-titles">
          <span className="project-name">{projetoOrigem?.name || "Sem projeto"}</span>
          <div className="sub-info">
            <span className="nota-name">{notaOrigem?.nome || "Sem nota"}</span>
          </div>
        </div>
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

      <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
        <div className="send-action-wrapper">
          <button
            className="send-btn"
            onClick={handleSave}
            disabled={statusEnvio === "enviando"}
          >
            <FaPaperPlane style={{ marginRight: 6 }} /> Enviar
          </button>
          {statusEnvio === "enviando" && <span className="loader-inline"></span>}
          {statusEnvio === "sucesso" && <Check />}
        </div>
      </div>

      <div className="listagem-table-wrapper" style={{ position: 'relative' }}>
        <table className="listagem-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>#</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Unidade</th>
              <th>Qnt/pav</th>
              <th>Locação</th>
              <th>EAP</th>
              <th>Observação</th>
              <th>Comentário</th>
              <th style={{ width: '40px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rowsParaExibir.map((row, visualIdx) => {
              const currentGroup = row.grupo_envio;
              const nextRow = rowsParaExibir[visualIdx + 1];
              const isLastInGroup = !nextRow || nextRow.grupo_envio !== currentGroup;

              return (
                <React.Fragment key={row.id ?? visualIdx}>
                  <tr className={row.selecionado ? "linha-selecionada" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selecionado}
                        onChange={(e) => toggleSelecionado(row.id, e.target.checked)}
                      />
                    </td>
                    <td>{row.ordem}</td>
                    <td>
                      {row.isCriar ? (
                        <input
                          type="text"
                          value={row.codigo}
                          onChange={(e) => handleInputChange(row.id, "codigo", e.target.value)}
                          placeholder="Código"
                        />
                      ) : (
                        <span>{row.codigo || ""}</span>
                      )}
                    </td>
                    <td>
                      {row.isCriar ? (
                        <input
                          className="descri"
                          type="text"
                          value={row.descricao || ""}
                          onChange={(e) => handleInputChange(row.id, "descricao", e.target.value)}
                          placeholder="Descrição"
                        />
                      ) : (
                        <span>{row.descricao || ""}</span>
                      )}
                    </td>
                    <td><span>{row.unidade || ""}</span></td>
                    <td><span>{row.quantidade || ""}</span></td>
                    <td>
                      <div
                        className="locacao-resumo"
                        onClick={() => {
                          if (row.locacao?.length > 1) {
                            setTooltipAberto(row.id);
                          }
                        }}
                        style={{
                          cursor: row.locacao?.length > 1 ? 'pointer' : 'default',
                          padding: '4px 6px',
                          borderRadius: '3px',
                          fontSize: '0.9em',
                          color: '#444',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.locacao?.length === 0
                          ? "–"
                          : row.locacao.length === 1
                            ? row.locacao[0]
                            : `${row.locacao[0]} +`}
                      </div>

                      {tooltipAberto === row.id && (
                        <div
                          ref={tooltipRef}
                          className="locacao-tooltip"
                        >
                          {row.locacao.map((loc, i) => (
                            <div key={i} className="inside-tooltip">
                              • {loc}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td><span>{row.eap || ""}</span></td>
                    <td>
                      <div className="observacao-rendered">
                        {row.observacao || ""}
                      </div>
                    </td>
                    <td>
                      <textarea
                        value={row.comentario || ""}
                        onChange={(e) => handleInputChange(row.id, "comentario", e.target.value)}
                        onBlur={(e) => handleComentarioBlur(row.id, e.target.value)}
                        className="observacao-textarea"
                        rows="1"
                        placeholder="Comentário..."
                      />
                    </td>
                    <td>
                      {row.isCriar && (
                        <button
                          className="add-supabase-btn"
                          style={{ padding: '4px', fontSize: '0.9em' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddCriar(row);
                          }}
                          title="Atualizar item"
                        >
                          <FaPlus />
                        </button>
                      )}
                    </td>
                  </tr>

                  {isLastInGroup && visualIdx < rowsParaExibir.length - 1 && (
                    <tr className="delimiter-row">
                      <td colSpan="11">
                        <div className="envio-delimiter">
                          Enviado por <strong>{row.enviado_por}</strong> em{" "}
                          {new Date(row.data_envio).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}