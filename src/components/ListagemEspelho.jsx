// src/components/ListagemEspelho.jsx
import React, { useState, useEffect } from "react";
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

  // Carrega dados do perfil (opcional)
  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .single();
    };
    fetchUserProfile();
  }, []);

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

      const mapped = (itensSalvos || []).map(item => ({
        id: item.id,
        selecionado: Boolean(item.selecionado),
        codigo: item.codigo || "",
        descricao: item.descricao || "",
        unidade: item.unidade || "",
        quantidade: item.quantidade || "",
        locacao: item.locacao || "",
        eap: item.eap || "",
        observacao: item.observacao || "",
        comentario: item.comentario || "",
        criado_em: item.criado_em || null,
        grupo_envio: item.grupo_envio || "antigo",
        data_envio: item.data_envio || item.criado_em,
        enviado_por: item.enviado_por || "Usuário",
        isCriar: (item.codigo || "").toLowerCase() === "criar",
        ordem: item.ordem || 0,
      }));

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

  const toggleSelecionado = async (id) => {
    const row = rows.find(r => r.id === id);
    if (!row || !row.isCriar) return;

    const novoValor = !row.selecionado;
    setRows(prev => prev.map(r => (r.id === id ? { ...r, selecionado: novoValor } : r)));

    try {
      const { error } = await supabase
        .from("planilha_itens")
        .update({ selecionado: novoValor })
        .eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao salvar seleção:", err);
      alert("Erro ao salvar a marcação.");
      setRows(prev => prev.map(r => (r.id === id ? { ...r, selecionado: !novoValor } : r)));
    }
  };

  const handleInputChange = (id, campo, valor) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [campo]: valor } : r)));
  };

  const handleComentarioBlur = async (id, novoComentario) => {
    try {
      // 1. Salvar no espelho
      const { error: espelhoError } = await supabase
        .from("planilha_itens")
        .update({ comentario: novoComentario || null })
        .eq("id", id);
      if (espelhoError) throw espelhoError;

      // 2. Atualizar localmente
      setRows(prev => prev.map(r => (r.id === id ? { ...r, comentario: novoComentario } : r)));

      // 3. Sincronizar com a linha original, se houver mapeamento
      const mapaKey = `mapa_itens_${notaEspelhoId}`;
      const mapaStr = localStorage.getItem(mapaKey);
      let itemOriginalId = null;

      if (mapaStr) {
        try {
          const mapa = JSON.parse(mapaStr);
          itemOriginalId = mapa[id];
        } catch (parseError) {
          console.warn("Falha ao parsear mapeamento:", parseError);
        }
      }

      if (itemOriginalId) {
        const { error: originalError } = await supabase
          .from("planilha_itens")
          .update({ comentario: novoComentario || null })
          .eq("id", itemOriginalId);
        if (originalError) {
          console.error("Erro ao atualizar comentário na linha original:", originalError);
        }
      }
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
      // Inserir no catálogo global
      const { error: insertError } = await supabase
        .from("itens")
        .insert({
          codigo: row.codigo.trim(),
          descricao: row.descricao || "",
          unidade: row.unidade || null,
        });
      if (insertError) throw insertError;

      // Atualizar linha no espelho
      const { error: updateEspelhoError } = await supabase
        .from("planilha_itens")
        .update({
          codigo: row.codigo.trim(),
          descricao: row.descricao || "",
        })
        .eq("id", row.id);
      if (updateEspelhoError) throw updateEspelhoError;

      // Atualizar linha original via mapeamento
      const mapaKey = `mapa_itens_${notaEspelhoId}`;
      const mapaStr = localStorage.getItem(mapaKey);
      if (mapaStr) {
        try {
          const mapa = JSON.parse(mapaStr);
          const itemOriginalId = mapa[row.id];
          if (itemOriginalId) {
            await supabase
              .from("planilha_itens")
              .update({
                codigo: row.codigo.trim(),
                descricao: row.descricao || "",
              })
              .eq("id", itemOriginalId);
          }
        } catch (e) {
          console.error("Erro ao atualizar item original via mapeamento:", e);
        }
      }

      // Atualizar estado local
      setRows(prev =>
        prev.map(r =>
          r.id === row.id
            ? { ...r, isCriar: false, codigo: row.codigo.trim(), descricao: row.descricao }
            : r
        )
      );

      alert("Item criado com sucesso! A listagem original foi atualizada automaticamente.");
    } catch (err) {
      console.error("Erro ao criar item:", err);
      alert("Erro ao criar item: " + (err.message || "Erro desconhecido"));
    }
  };

  // ✅ CORREÇÃO PRINCIPAL: atualiza a NOTA ORIGINAL ao responder
    const handleSave = async () => {
      if (!notaEspelhoId) return;
      setStatusEnvio("enviando");
      try {
        // Salvar os itens (mesmo que antes)
        await Promise.all(
          rows.map(async (row) => {
            const updateData = { selecionado: row.selecionado };
            if (row.isCriar) {
              updateData.codigo = row.codigo?.trim() || null;
              updateData.descricao = row.descricao || null;
            }
            await supabase.from("planilha_itens").update(updateData).eq("id", row.id);
          })
        );

        // Buscar nota espelho para obter a original
        const { data: notaEspelhoData } = await supabase
          .from("notas")
          .select("nota_original_id")
          .eq("id", notaEspelhoId)
          .single();

        if (!notaEspelhoData?.nota_original_id) {
          throw new Error("Nota original não encontrada.");
        }

        const notaOriginalId = notaEspelhoData.nota_original_id;

        // ✅ Atualizar AMBAS as notas como respondidas
        await supabase.from("notas").update({ respondida: true }).eq("id", notaOriginalId);
        await supabase.from("notas").update({ respondida: true }).eq("id", notaEspelhoId);

        // ✅ Atualizar UI de AMBAS
        if (onStatusUpdate) {
          onStatusUpdate(notaOriginalId, { respondida: true, enviada: true });
          onStatusUpdate(notaEspelhoId, { respondida: true, enviada: true }); // ← agora a espelho também vira verde
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

      <div className="listagem-table-wrapper">
        <table className="listagem-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>#</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Unidade</th>
              <th>Quantidade</th>
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
                      {row.isCriar && (
                        <input
                          type="checkbox"
                          checked={row.selecionado}
                          onChange={() => toggleSelecionado(row.id)}
                        />
                      )}
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
                    <td><span>{row.locacao || ""}</span></td>
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
                          title="Criar item global"
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