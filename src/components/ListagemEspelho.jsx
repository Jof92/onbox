// src/components/ListagemEspelho.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import "./ListagemEspelho.css";
import "./loader.css";
import { FaPaperPlane, FaComment, FaPlus, FaTimes } from "react-icons/fa";
import Check from "./Check";
import Loading from "./Loading";

export default function ListagemEspelho({ projetoOrigem, notaOrigem, notaEspelhoId, onClose }) {
  const [rows, setRows] = useState([]);
  const [comentarios, setComentarios] = useState({});
  const [comentarioEditandoId, setComentarioEditandoId] = useState(null);
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("Usuário");
  const [statusEnvio, setStatusEnvio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", user.id)
          .single();
        setNomeUsuarioLogado(profile?.nome || user.email?.split("@")[0] || "Usuário");
      }
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
        comentario: item.comentario || "",
        criado_em: item.criado_em || null,
        grupo_envio: item.grupo_envio || "antigo",
        data_envio: item.data_envio || item.criado_em,
        enviado_por: item.enviado_por || "Usuário",
        isCriar: (item.codigo || "").toLowerCase() === "criar",
        ordem: item.ordem || 0,
      }));

      setRows(mapped);

      const comentariosIniciais = {};
      mapped.forEach(item => {
        comentariosIniciais[item.id] = item.comentario || "";
      });
      setComentarios(comentariosIniciais);
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
    if (!row || !row.isCriar) return; // Só permite marcar se for "criar"

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

  const handleComentarioChange = (id, valor) => {
    setComentarios(prev => ({ ...prev, [id]: valor }));
  };

  const salvarComentarioIndividual = async (id, novoComentario) => {
    try {
      const { error } = await supabase
        .from("planilha_itens")
        .update({ comentario: novoComentario || null })
        .eq("id", id);

      if (error) throw error;

      setComentarios(prev => ({ ...prev, [id]: novoComentario }));
      setComentarioEditandoId(null);
    } catch (err) {
      alert("Erro ao salvar comentário.");
    }
  };

  const handleAddCriar = async (row) => {
    if (!row.codigo?.trim() || row.codigo.toLowerCase() === 'criar') {
      alert("Digite um código válido antes de criar o item!");
      return;
    }

    try {
      // 1. Cria o item na tabela global de insumos
      const { error: insertError } = await supabase
        .from("itens")
        .insert({
          codigo: row.codigo.trim(),
          descricao: row.descricao || "",
          unidade: row.unidade || null,
        });

      if (insertError) throw insertError;

      // 2. Atualiza apenas codigo e descricao na nota espelho
      const { error: updateEspelhoError } = await supabase
        .from("planilha_itens")
        .update({
          codigo: row.codigo.trim(),
          descricao: row.descricao || "",
        })
        .eq("id", row.id);

      if (updateEspelhoError) throw updateEspelhoError;

      // 3. Atualiza APENAS codigo e descricao no item original
      const mapaStr = localStorage.getItem(`mapa_itens_${notaEspelhoId}`);
      if (mapaStr) {
        try {
          const mapa = JSON.parse(mapaStr);
          const itemOriginalId = mapa[row.id];

          if (itemOriginalId) {
            const { error: updateOriginalError } = await supabase
              .from("planilha_itens")
              .update({
                codigo: row.codigo.trim(),
                descricao: row.descricao || "",
              })
              .eq("id", itemOriginalId);

            if (updateOriginalError) {
              console.error("Erro ao atualizar item original:", updateOriginalError);
            }
          }
        } catch (e) {
          console.error("Erro ao processar mapeamento:", e);
        }
      }

      // 4. Atualiza estado local
      setRows(prev =>
        prev.map(r =>
          r.id === row.id
            ? {
                ...r,
                isCriar: false,
                codigo: row.codigo.trim(),
                descricao: row.descricao,
              }
            : r
        )
      );

      alert("Item criado com sucesso! A listagem original foi atualizada automaticamente.");
    } catch (err) {
      alert("Erro ao criar item: " + (err.message || "Erro desconhecido"));
    }
  };

  const handleSave = async () => {
    if (!notaEspelhoId) return;

    setStatusEnvio("enviando");
    try {
      await Promise.all(
        rows.map(async (row) => {
          const updateData = {
            comentario: comentarios[row.id] || null,
            selecionado: row.selecionado,
          };

          if (row.isCriar) {
            updateData.codigo = row.codigo?.trim() || null;
            updateData.descricao = row.descricao || null;
          }

          await supabase
            .from("planilha_itens")
            .update(updateData)
            .eq("id", row.id);
        })
      );

      setStatusEnvio("sucesso");
      setTimeout(() => setStatusEnvio(null), 2000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar a lista.");
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
              <th>Unid</th>
              <th>Qtd.</th>
              <th>Locação</th>
              <th>EAP</th>
              <th style={{ width: '120px' }}>Comentário</th>
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
                      {/* Checkbox só aparece para itens "criar" */}
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
                      {/* Código só edita se for "criar" */}
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
                      {/* Descrição só edita se for "criar" */}
                      {row.isCriar ? (
                        <input
                          type="text"
                          value={row.descricao || ""}
                          onChange={(e) => handleInputChange(row.id, "descricao", e.target.value)}
                          placeholder="Descrição"
                        />
                      ) : (
                        <span>{row.descricao || ""}</span>
                      )}
                    </td>
                    <td>
                      {/* Unidade SEMPRE congelada */}
                      <span>{row.unidade || ""}</span>
                    </td>
                    <td>
                      {/* Quantidade SEMPRE congelada */}
                      <span>{row.quantidade || ""}</span>
                    </td>
                    <td>
                      {/* Locação SEMPRE congelada */}
                      <span>{row.locacao || ""}</span>
                    </td>
                    <td>
                      {/* EAP SEMPRE congelado */}
                      <span>{row.eap || ""}</span>
                    </td>
                    <td>
                      {comentarioEditandoId === row.id ? (
                        <div className="comentario-editavel">
                          <textarea
                            value={comentarios[row.id] || ""}
                            onChange={(e) => handleComentarioChange(row.id, e.target.value)}
                            placeholder="Comente aqui..."
                            autoFocus
                            disabled={!row.isCriar}
                          />
                          <div className="comentario-botoes">
                            <button
                              className="btn-comentario-salvar"
                              onClick={() => salvarComentarioIndividual(row.id, comentarios[row.id])}
                              disabled={!row.isCriar}
                            >
                              Salvar
                            </button>
                            <button
                              className="btn-comentario-cancelar"
                              onClick={() => setComentarioEditandoId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="icone-comentario-clicavel"
                          onClick={() => row.isCriar && setComentarioEditandoId(row.id)}
                          style={!row.isCriar ? { opacity: 0.6, pointerEvents: "none" } : {}}
                        >
                          <FaComment />
                          {comentarios[row.id] && <span className="indicador-comentario">•</span>}
                          {row.isCriar && (
                            <button
                              className="add-supabase-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddCriar(row);
                              }}
                            >
                              <FaPlus />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>

                  {isLastInGroup && visualIdx < rowsParaExibir.length - 1 && (
                    <tr className="delimiter-row">
                      <td colSpan="9">
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