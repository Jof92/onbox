// Listagem.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import { FaPlus, FaTimes, FaPaperPlane } from "react-icons/fa";

export default function Listagem({ projetoAtual, notaAtual, usuarioAtual }) {
  const [rows, setRows] = useState([]);
  const [ultimaAlteracao, setUltimaAlteracao] = useState("");
  const [locacoes, setLocacoes] = useState([]);
  const [eaps, setEaps] = useState([]);
  const [direcionarPara, setDirecionarPara] = useState("");

  // Atualiza registro visual da última alteração
  const registrarAlteracao = (autor = usuarioAtual) => {
    const agora = new Date();
    const timestamp = `${autor || "Usuário"} alterou em ${agora.toLocaleDateString()} ${agora.toLocaleTimeString()}`;
    setUltimaAlteracao(timestamp);
  };

  // Carregar listas e itens salvos
  useEffect(() => {
    if (!projetoAtual?.id || !notaAtual?.id) {
      setRows(
        Array.from({ length: 10 }, () => ({
          codigo: "",
          descricao: "",
          unidade: "",
          quantidade: "",
          locacao: "",
          eap: "",
          fornecedor: ""
        }))
      );
      return;
    }

    const carregarDados = async () => {
      try {
        // Carregar locações (pavimentos)
        const { data: pavimentosData } = await supabase
          .from("pavimentos")
          .select("name")
          .eq("project_id", projetoAtual.id);
        setLocacoes(pavimentosData?.map(p => p.name) || []);

        // Carregar EAPs
        const { data: eapsData } = await supabase
          .from("eap")
          .select("name")
          .eq("project_id", projetoAtual.id);
        setEaps(eapsData?.map(e => e.name) || []);

        // Carregar itens pela nota_id (UUID)
        const { data: itensSalvos } = await supabase
          .from("planilha_itens")
          .select("*")
          .eq("nota_id", notaAtual.id);

        if (itensSalvos?.length) {
          setRows(
            itensSalvos.map(item => ({
              id: item.id,
              codigo: item.codigo || "",
              descricao: item.descricao || "",
              unidade: item.unidade || "",
              quantidade: item.quantidade || "",
              locacao: item.locacao || "",
              eap: item.eap || "",
              fornecedor: item.fornecedor || ""
            }))
          );
        } else {
          setRows(
            Array.from({ length: 10 }, () => ({
              codigo: "",
              descricao: "",
              unidade: "",
              quantidade: "",
              locacao: "",
              eap: "",
              fornecedor: ""
            }))
          );
        }

        registrarAlteracao();
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        alert("Erro ao carregar os dados da lista.");
      }
    };

    carregarDados();
  }, [projetoAtual, notaAtual, usuarioAtual]);

  // Buscar descrição e unidade pelo código
  const buscarItemPorCodigo = async (index, codigo) => {
    if (!codigo?.trim()) return;
    try {
      const { data } = await supabase
        .from("itens")
        .select("descricao, unidade")
        .eq("codigo", codigo)
        .maybeSingle();

      const novasLinhas = [...rows];
      novasLinhas[index] = {
        ...novasLinhas[index],
        descricao: data?.descricao || "",
        unidade: data?.unidade || ""
      };

      setRows(novasLinhas);
      registrarAlteracao();
    } catch (err) {
      console.error("Erro ao buscar item por código:", err);
    }
  };

  // Atualizar valores
  const handleInputChange = (index, campo, valor) => {
    const novasLinhas = [...rows];
    novasLinhas[index][campo] = valor;
    setRows(novasLinhas);
    registrarAlteracao();
  };

  const handleCodigoEnter = (e, index, codigo) => {
    if (e.key === "Enter") buscarItemPorCodigo(index, codigo);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { codigo: "", descricao: "", unidade: "", quantidade: "", locacao: "", eap: "", fornecedor: "" }
    ]);
    registrarAlteracao();
  };

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
    registrarAlteracao();
  };

  // Salvar
  const handleSave = async () => {
    if (!notaAtual?.id) {
      alert("Nota não selecionada. Não é possível salvar.");
      return;
    }

    try {
      // Filtrar linhas com conteúdo relevante
      const linhasValidas = rows.filter(row =>
        row.codigo?.trim() || row.descricao?.trim() || row.quantidade
      );

      const itensParaSalvar = linhasValidas.map(row => ({
        projeto_id: projetoAtual.id,
        nota_id: notaAtual.id, // UUID da nota
        codigo: row.codigo?.trim() || null,
        descricao: row.descricao || null,
        unidade: row.unidade || null,
        quantidade: row.quantidade ? Number(row.quantidade) : null,
        locacao: row.locacao || null,
        eap: row.eap || null,
        fornecedor: row.fornecedor || null,
        direcionar_para: direcionarPara?.trim() || null,
      }));

      // Remover duplicatas por código dentro da mesma nota (último vence)
      const mapa = new Map();
      itensParaSalvar.forEach(item => {
        const key = item.codigo || `__sem_codigo_${Math.random()}`;
        mapa.set(key, item); // sobrescreve duplicatas
      });
      const itensUnicos = Array.from(mapa.values());

      // ✅ UPSERT com conflito baseado em (codigo, nota_id)
      const { error } = await supabase
        .from("planilha_itens")
        .upsert(itensUnicos, {
          onConflict: "codigo,nota_id", // ← CORRETO! Deve corresponder ao índice único
          defaultToNull: true
        });

      if (error) throw error;

      alert("Lista salva com sucesso!");
      registrarAlteracao();
    } catch (err) {
      console.error("Erro ao salvar lista:", err);
      alert("Erro ao salvar lista: " + (err.message || "Erro desconhecido"));
    }
  };

  return (
    <div className="listagem-card">
      {/* Cabeçalho */}
      <div className="listagem-header-container">
        <div className="listagem-header-titles">
          <span className="project-name">{projetoAtual?.name || "Sem projeto"}</span>
          <div className="sub-info">
            <span className="nota-name">{notaAtual?.nome || "Sem nota"}</span>
          </div>
        </div>
        <div className="alteracao-info">{ultimaAlteracao}</div>
      </div>

      {/* Botões de ação */}
      <div className="action-buttons">
        <button className="add-row-btn" onClick={addRow}>
          <FaPlus /> Adicionar linha
        </button>

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

      {/* Tabela */}
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
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>

                <td>
                  <input
                    type="text"
                    value={row.codigo}
                    onChange={(e) => handleInputChange(idx, "codigo", e.target.value)}
                    onBlur={() => buscarItemPorCodigo(idx, row.codigo)}
                    onKeyPress={(e) => handleCodigoEnter(e, idx, row.codigo)}
                    placeholder="Código"
                  />
                </td>

                <td>{row.descricao}</td>
                <td>{row.unidade}</td>

                <td>
                  <input
                    type="number"
                    value={row.quantidade}
                    onChange={(e) => handleInputChange(idx, "quantidade", e.target.value)}
                    min="0"
                    step="any"
                  />
                </td>

                <td>
                  <select value={row.locacao} onChange={(e) => handleInputChange(idx, "locacao", e.target.value)}>
                    <option value="">(selecionar)</option>
                    {locacoes.map((loc, i) => (
                      <option key={i} value={loc}>{loc}</option>
                    ))}
                  </select>
                </td>

                <td>
                  <select value={row.eap} onChange={(e) => handleInputChange(idx, "eap", e.target.value)}>
                    <option value="">(selecionar)</option>
                    {eaps.map((eap, i) => (
                      <option key={i} value={eap}>{eap}</option>
                    ))}
                  </select>
                </td>

                <td>{row.fornecedor}</td>

                <td>
                  <div className="button-group">
                    <button
                      className="add-supabase-btn"
                      onClick={() => alert("Funcionalidade de adicionar insumo ainda em desenvolvimento")}
                    >
                      <FaPlus />
                    </button>
                    <button className="remove-btn" onClick={() => removeRow(idx)}>
                      <FaTimes />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}