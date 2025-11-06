// src/components/Listagem.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import { FaPlus, FaTimes, FaPaperPlane } from "react-icons/fa";
import Loading from "./Loading";

export default function Listagem({ projetoAtual, notaAtual }) {
  const [rows, setRows] = useState([]);
  const [ultimaAlteracao, setUltimaAlteracao] = useState("");
  const [locacoes, setLocacoes] = useState([]);
  const [eaps, setEaps] = useState([]);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState([]);
  const [direcionarPara, setDirecionarPara] = useState("");
  const [loading, setLoading] = useState(true);
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("Usuário");
  const [codigoErro, setCodigoErro] = useState(new Set()); // ✅ controle de erros

  // Busca o nome real do usuário logado
  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        setNomeUsuarioLogado(profile?.full_name || user.email?.split("@")[0] || "Usuário");
      }
    };
    fetchUserProfile();
  }, []);

  const registrarAlteracao = (autor = nomeUsuarioLogado) => {
    const agora = new Date();
    const timestamp = `${autor} alterou em ${agora.toLocaleDateString()} ${agora.toLocaleTimeString()}`;
    setUltimaAlteracao(timestamp);
  };

  const sortRowsByCreatedDesc = (arr) => {
    return [...arr].sort((a, b) => {
      const ta = a?.criado_em ? new Date(a.criado_em).getTime() : 0;
      const tb = b?.criado_em ? new Date(b.criado_em).getTime() : 0;
      return tb - ta;
    });
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      if (!projetoAtual?.id || !notaAtual?.id) {
        setRows(Array.from({ length: 10 }, () => ({
          codigo: "", descricao: "", unidade: "", quantidade: "", locacao: "", eap: "", fornecedor: ""
        })));
        setLoading(false);
        return;
      }

      const { data: pavimentosData } = await supabase
        .from("pavimentos")
        .select("name")
        .eq("project_id", projetoAtual.id);
      setLocacoes(pavimentosData?.map(p => p.name) || []);

      const { data: eapsData } = await supabase
        .from("eap")
        .select("name")
        .eq("project_id", projetoAtual.id);
      setEaps(eapsData?.map(e => e.name) || []);

      const { data: unidadesData } = await supabase.from("itens").select("unidade");
      const unidadesUnicas = [...new Set(unidadesData?.map(u => u.unidade).filter(Boolean))];
      setUnidadesDisponiveis(unidadesUnicas);

      const { data: itensSalvos, error: itensErr } = await supabase
        .from("planilha_itens")
        .select("*")
        .eq("nota_id", notaAtual.id)
        .order("criado_em", { ascending: false });

      if (itensErr) throw itensErr;

      if (itensSalvos?.length) {
        const mapped = itensSalvos.map(item => ({
          id: item.id,
          codigo: item.codigo || "",
          descricao: item.descricao || "",
          unidade: item.unidade || "",
          quantidade: item.quantidade || "",
          locacao: item.locacao || "",
          eap: item.eap || "",
          fornecedor: item.fornecedor || "",
          criado_em: item.criado_em || null,
          grupo_envio: item.grupo_envio || "antigo",
          data_envio: item.data_envio || item.criado_em,
          enviado_por: item.enviado_por || "Usuário"
        }));
        setRows(sortRowsByCreatedDesc(mapped));
      } else {
        setRows(Array.from({ length: 10 }, () => ({
          codigo: "", descricao: "", unidade: "", quantidade: "", locacao: "", eap: "", fornecedor: ""
        })));
      }

      registrarAlteracao();
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      alert("Erro ao carregar os dados da lista.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoAtual, notaAtual]);

  const buscarItemPorCodigo = async (index, codigo) => {
    if (!codigo?.trim() || codigo.toLowerCase() === "criar") {
      setCodigoErro(prev => {
        const novo = new Set(prev);
        novo.delete(index);
        return novo;
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("itens")
        .select("descricao, unidade")
        .eq("codigo", codigo)
        .maybeSingle();

      if (error) throw error;

      const novas = [...rows];
      if (data) {
        novas[index] = { ...novas[index], descricao: data.descricao || "", unidade: data.unidade || "" };
        setCodigoErro(prev => {
          const novo = new Set(prev);
          novo.delete(index);
          return novo;
        });
      } else {
        // ❌ Código não encontrado
        setCodigoErro(prev => new Set(prev).add(index));
        novas[index] = { ...novas[index], descricao: "", unidade: "" };
      }
      setRows(novas);
      registrarAlteracao();
    } catch (err) {
      console.error("Erro ao buscar item por código:", err);
      setCodigoErro(prev => new Set(prev).add(index));
    }
  };

  const handleInputChange = (index, campo, valor) => {
    const novas = [...rows];
    novas[index][campo] = valor;
    setRows(novas);
    registrarAlteracao();
  };

  const handleCodigoEnter = (e, index, codigo) => {
    if (e.key === "Enter") buscarItemPorCodigo(index, codigo);
  };

  const addRow = () => {
    const novaLinha = {
      codigo: "",
      descricao: "",
      unidade: "",
      quantidade: "",
      locacao: "",
      eap: "",
      fornecedor: "",
      criado_em: new Date().toISOString()
    };
    setRows(prev => {
      const next = [...prev, novaLinha];
      return sortRowsByCreatedDesc(next);
    });
    registrarAlteracao();
  };

  const removeRow = async (index) => {
    const linha = rows[index];
    setRows(prev => prev.filter((_, i) => i !== index));
    registrarAlteracao();

    if (linha?.id) {
      try {
        const { error } = await supabase.from("planilha_itens").delete().eq("id", linha.id);
        if (error) throw error;
      } catch (err) {
        console.error("Erro ao excluir item:", err);
        alert("Erro ao excluir item: " + (err.message || "Erro desconhecido"));
        await carregarDados();
      }
    }
  };

  const handleSave = async () => {
    if (!notaAtual?.id) {
      alert("Nota não selecionada. Não é possível salvar.");
      return;
    }
    setLoading(true);
    try {
      const grupoEnvio = `envio_${Date.now()}`;
      const dataEnvio = new Date().toISOString();
      const remetente = nomeUsuarioLogado;

      const linhasValidas = rows.filter(r => r.codigo?.trim() || r.descricao?.trim() || r.quantidade);
      const existentes = linhasValidas.filter(r => r.id);
      const novos = linhasValidas.filter(r => !r.id);

      if (existentes.length) {
        await Promise.all(existentes.map(async (it) => {
          const payload = {
            codigo: it.codigo?.trim() || null,
            descricao: it.descricao || null,
            unidade: it.unidade || null,
            quantidade: it.quantidade ? Number(it.quantidade) : null,
            locacao: it.locacao || null,
            eap: it.eap || null,
            fornecedor: it.fornecedor || null,
            direcionar_para: direcionarPara?.trim() || null
          };
          const { error } = await supabase.from("planilha_itens").update(payload).eq("id", it.id);
          if (error) throw error;
        }));
      }

      if (novos.length) {
        const inserts = novos.map(it => ({
          projeto_id: projetoAtual.id,
          nota_id: notaAtual.id,
          codigo: it.codigo?.trim() || null,
          descricao: it.descricao || null,
          unidade: it.unidade || null,
          quantidade: it.quantidade ? Number(it.quantidade) : null,
          locacao: it.locacao || null,
          eap: it.eap || null,
          fornecedor: it.fornecedor || null,
          direcionar_para: direcionarPara?.trim() || null,
          grupo_envio: grupoEnvio,
          data_envio: dataEnvio,
          enviado_por: remetente,
          criado_em: new Date().toISOString()
        }));
        const { error } = await supabase.from("planilha_itens").insert(inserts);
        if (error) throw error;
      }

      setCodigoErro(new Set()); // Limpa erros após salvar
      await carregarDados();
      alert("Lista salva com sucesso!");
      registrarAlteracao();
    } catch (err) {
      console.error("Erro ao salvar lista:", err);
      alert("Erro ao salvar lista.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Loading />
      </div>
    );
  }

  return (
    <div className="listagem-card">
      <div className="listagem-header-container">
        <div className="listagem-header-titles">
          <span className="project-name">{projetoAtual?.name || "Sem projeto"}</span>
          <div className="sub-info"><span className="nota-name">{notaAtual?.nome || "Sem nota"}</span></div>
        </div>
        <div className="alteracao-info">{ultimaAlteracao}</div>
      </div>

      <div className="action-buttons">
        <button className="add-row-btn" onClick={addRow}><FaPlus /> Adicionar linha</button>
        <input
          type="text"
          className="direcionar-para-input"
          placeholder="Direcionar para"
          value={direcionarPara}
          onChange={(e) => setDirecionarPara(e.target.value)}
        />
        <button className="send-btn" onClick={handleSave}>
          <FaPaperPlane style={{ marginRight: 6 }} /> Enviar
        </button>
      </div>

      <div className="listagem-table-wrapper">
        <table className="listagem-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Unidade</th>
              <th>Qtd.</th>
              <th>Locação</th>
              <th>EAP</th>
              <th>Fornecedor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isCriar = row.codigo?.toLowerCase() === "criar";

              const isEditavel = (() => {
                if (!row.id) return true;
                if (!row.data_envio) return false;
                const envioMs = new Date(row.data_envio).getTime();
                return (Date.now() - envioMs) < 60 * 60 * 1000;
              })();

              const isLinhaCongelada = !isEditavel;

              const currentGroup = row.grupo_envio;
              const nextRow = rows[idx + 1];
              const isLastInGroup = !nextRow || nextRow.grupo_envio !== currentGroup;

              return (
                <React.Fragment key={row.id ?? idx}>
                  <tr className={isLinhaCongelada ? "linha-congelada" : ""}>
                    <td>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        value={row.codigo}
                        onChange={(e) => {
                          handleInputChange(idx, "codigo", e.target.value);
                          if (codigoErro.has(idx)) {
                            setCodigoErro(prev => {
                              const novo = new Set(prev);
                              novo.delete(idx);
                              return novo;
                            });
                          }
                        }}
                        onBlur={() => buscarItemPorCodigo(idx, row.codigo)}
                        onKeyPress={(e) => handleCodigoEnter(e, idx, row.codigo)}
                        placeholder="Código"
                        disabled={isLinhaCongelada}
                        className={codigoErro.has(idx) ? "codigo-invalido" : ""}
                      />
                    </td>
                    <td>
                      {isCriar && isEditavel ? (
                        <input
                          type="text"
                          value={row.descricao || ""}
                          onChange={(e) => handleInputChange(idx, "descricao", e.target.value)}
                          placeholder="Descrição do novo item"
                        />
                      ) : (
                        <span>{row.descricao || "—"}</span>
                      )}
                    </td>
                    <td>
                      {isCriar && isEditavel ? (
                        <select
                          value={row.unidade || ""}
                          onChange={(e) => handleInputChange(idx, "unidade", e.target.value)}
                        >
                          <option value="">(selecionar)</option>
                          {unidadesDisponiveis.map((un, i) => (
                            <option key={i} value={un}>{un}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.unidade || "—"}</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.quantidade ?? ""}
                        onChange={(e) => handleInputChange(idx, "quantidade", e.target.value)}
                        min="0"
                        step="any"
                        disabled={isLinhaCongelada}
                      />
                    </td>
                    <td>
                      {isEditavel ? (
                        <select
                          value={row.locacao || ""}
                          onChange={(e) => handleInputChange(idx, "locacao", e.target.value)}
                        >
                          <option value="">(selecionar)</option>
                          {locacoes.map((loc, i) => (
                            <option key={i} value={loc}>{loc}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.locacao || "—"}</span>
                      )}
                    </td>
                    <td>
                      {isEditavel ? (
                        <select
                          value={row.eap || ""}
                          onChange={(e) => handleInputChange(idx, "eap", e.target.value)}
                        >
                          <option value="">(selecionar)</option>
                          {eaps.map((eap, i) => (
                            <option key={i} value={eap}>{eap}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.eap || "—"}</span>
                      )}
                    </td>
                    <td>{row.fornecedor || "—"}</td>
                    <td>
                      <div className="button-group">
                        {isEditavel && (
                          <button
                            className="add-supabase-btn"
                            onClick={() => alert("Funcionalidade de adicionar insumo ainda em desenvolvimento")}
                          >
                            <FaPlus />
                          </button>
                        )}
                        {isEditavel && (
                          <button className="remove-btn" onClick={() => removeRow(idx)}>
                            <FaTimes />
                          </button>
                        )}
                      </div>
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