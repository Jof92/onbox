// src/components/ListagemEspelho.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import "./ListagemEspelho.css";
import "./loader.css";
import { FaPaperPlane, FaComment, FaPlus, FaTimes} from "react-icons/fa";
import Check from "./Check";
import Loading from "./Loading";

export default function ListagemEspelho({ projetoOrigem, notaOrigem, notaEspelhoId, onClose }) {
  const [rows, setRows] = useState([]);
  const [comentarios, setComentarios] = useState({});
  const [comentarioEditandoId, setComentarioEditandoId] = useState(null);
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("Usuário");
  const [statusEnvio, setStatusEnvio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState([]);

  // Carregar perfil do usuário logado
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

  // Carregar dados da nota espelho
  const carregarDados = async () => {
    setLoading(true);
    try {
      if (!notaEspelhoId) {
        setRows([]);
        return;
      }

      // Carregar unidades disponíveis
      const { data: unidadesData } = await supabase.from("itens").select("unidade");
      setUnidadesDisponiveis([...new Set(unidadesData?.map(u => u.unidade).filter(Boolean) || [])]);

      // Carregar itens da nota espelho
      const { data: itensSalvos, error } = await supabase
        .from("planilha_itens")
        .select("*")
        .eq("nota_id", notaEspelhoId)
        .order("criado_em", { ascending: false });

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
        jaCriado: (item.codigo || "").toLowerCase() !== "criar" && !!item.codigo?.trim(),
      }));

      const sorted = mapped.sort((a, b) => {
        const ta = a.criado_em ? new Date(a.criado_em).getTime() : 0;
        const tb = b.criado_em ? new Date(b.criado_em).getTime() : 0;
        return tb - ta;
      });

      setRows(sorted);

      const comentariosIniciais = {};
      sorted.forEach(item => {
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
    if (!row) return;

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
    if (!row.codigo?.trim()) {
      alert("Informe um código válido.");
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

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("planilha_itens")
        .update({
          codigo: row.codigo.trim(),
          descricao: row.descricao || "",
          unidade: row.unidade || null,
        })
        .eq("id", row.id);

      if (updateError) throw updateError;

      setRows(prev =>
        prev.map(r =>
          r.id === row.id
            ? {
                ...r,
                isCriar: false,
                jaCriado: true,
                codigo: row.codigo.trim(),
                descricao: row.descricao,
                unidade: row.unidade,
              }
            : r
        )
      );

      const { data: unidadesAtualizadas } = await supabase.from("itens").select("unidade");
      setUnidadesDisponiveis([...new Set(unidadesAtualizadas?.map(u => u.unidade).filter(Boolean) || [])]);

      alert("Item criado com sucesso!");
    } catch (err) {
      console.error("Erro em handleAddCriar:", err);
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
            updateData.unidade = row.unidade || null;
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
            {rows.map((row, idx) => {
              const currentGroup = row.grupo_envio;
              const nextRow = rows[idx + 1];
              const isLastInGroup = !nextRow || nextRow.grupo_envio !== currentGroup;
              const isDisabled = !row.isCriar;

              return (
                <React.Fragment key={row.id ?? idx}>
                  <tr className={row.selecionado ? "linha-selecionada" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selecionado}
                        onChange={() => toggleSelecionado(row.id)}
                        disabled={isDisabled}
                      />
                    </td>
                    <td>{idx + 1}</td>
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
                      {row.isCriar ? (
                        <select
                          value={row.unidade || ""}
                          onChange={(e) => handleInputChange(row.id, "unidade", e.target.value)}
                        >
                          <option value="">(selecionar)</option>
                          {unidadesDisponiveis.map((un, i) => (
                            <option key={i} value={un}>{un}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.unidade || ""}</span>
                      )}
                    </td>
                    <td>
                      <span>{row.quantidade || ""}</span>
                    </td>
                    <td>{row.locacao || ""}</td>
                    <td>{row.eap || ""}</td>
                    <td>
                      {comentarioEditandoId === row.id ? (
                        <div className="comentario-editavel">
                          <textarea
                            value={comentarios[row.id] || ""}
                            onChange={(e) => handleComentarioChange(row.id, e.target.value)}
                            placeholder="Comente aqui..."
                            autoFocus
                            disabled={isDisabled}
                          />
                          <div className="comentario-botoes">
                            <button
                              className="btn-comentario-salvar"
                              onClick={() => salvarComentarioIndividual(row.id, comentarios[row.id])}
                              disabled={isDisabled}
                            >
                              Salvar
                            </button>
                            <button
                              className="btn-comentario-cancelar"
                              onClick={() => setComentarioEditandoId(null)}
                              disabled={isDisabled}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="icone-comentario-clicavel"
                          onClick={() => !isDisabled && setComentarioEditandoId(row.id)}
                          style={isDisabled ? { opacity: 0.6, pointerEvents: "none" } : {}}
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

                  {isLastInGroup && idx < rows.length - 1 && (
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