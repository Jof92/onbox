import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";

export default function Listagem({ projetoAtual, pilhaAtual, notaAtual, usuarioAtual }) {
  const [rows, setRows] = useState([]);
  const [ultimaAlteracao, setUltimaAlteracao] = useState("");
  const [locacoes, setLocacoes] = useState([]);
  const [eaps, setEaps] = useState([]);

  // Inicializa as linhas e última alteração
  useEffect(() => {
    const initialRows = Array.from({ length: 10 }, () => ({
      codigo: "",
      descricao: "",
      unidade: "",
      quantidade: "",
      locacao: "",
      eap: "",
      fornecedor: "",
    }));
    setRows(initialRows);

    const now = new Date();
    setUltimaAlteracao(`${usuarioAtual} alterou em ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  }, [usuarioAtual]);

  // Carrega locações e EAPs do projeto
  useEffect(() => {
    if (!projetoAtual?.id) return;

    const fetchLists = async () => {
      const { data: pavimentosData } = await supabase
        .from("pavimentos")
        .select("*")
        .eq("project_id", projetoAtual.id);

      const { data: eapsData } = await supabase
        .from("eap")
        .select("*")
        .eq("project_id", projetoAtual.id);

      setLocacoes(pavimentosData?.map((p) => p.name) || []);
      setEaps(eapsData?.map((e) => e.name) || []);
    };

    fetchLists();
  }, [projetoAtual]);

  const updateAlteracao = () => {
    const now = new Date();
    setUltimaAlteracao(`${usuarioAtual} alterou em ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  };

  // Busca diretamente o item pelo código no Supabase
  const fetchItemDirect = async (index, codigo) => {
    if (!codigo.trim()) return;

    try {
      const { data: itemData, error } = await supabase
        .from("itens")
        .select("descricao, unidade")
        .eq("codigo", codigo)
        .single();

      const newRows = [...rows];
      if (!error && itemData) {
        newRows[index] = {
          ...newRows[index],
          descricao: itemData.descricao || "",
          unidade: itemData.unidade || "",
        };
      } else {
        newRows[index] = {
          ...newRows[index],
          descricao: "",
          unidade: "",
        };
      }

      setRows(newRows);
      updateAlteracao();
    } catch (err) {
      console.error("Erro ao buscar item direto do Supabase:", err);
    }
  };

  const handleInputChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
    updateAlteracao();
  };

  const handleCodigoKeyPress = (e, index, codigo) => {
    if (e.key === "Enter") fetchItemDirect(index, codigo);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { codigo: "", descricao: "", unidade: "", quantidade: "", locacao: "", eap: "", fornecedor: "" },
    ]);
    updateAlteracao();
  };

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
    updateAlteracao();
  };

  const handleSave = async () => {
    try {
      const itensToSave = rows.map((row) => ({
        codigo: row.codigo,
        descricao: row.descricao,
        unidade: row.unidade,
        quantidade: row.quantidade,
        locacao: row.locacao,
        eap: row.eap,
        fornecedor: row.fornecedor,
        projeto_id: projetoAtual?.id || null,
        pilha: pilhaAtual || null,
        nota: notaAtual || null,
      }));

      const { error } = await supabase.from("itens").upsert(itensToSave, { onConflict: ["codigo", "projeto_id"] });
      if (error) throw error;

      alert("Lista salva com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar lista: " + err.message);
    }
  };

  return (
    <div className="listagem-card">
      <div className="listagem-header-container">
        <div className="listagem-header-titles">
          <span className="project-name">{projetoAtual?.name || "Sem projeto"}</span>
          <div className="sub-info">
            <span className="pilha-name">{pilhaAtual || "Sem pilha"}</span> &nbsp;- &nbsp;
            <span className="nota-name">{notaAtual || "Sem nota"}</span>
          </div>
        </div>
        <div className="alteracao-info">{ultimaAlteracao}</div>
      </div>

      <div className="action-buttons">
        <button className="add-row-btn" onClick={addRow}>Adicionar linha</button>
        <button className="save-btn" onClick={handleSave}>Salvar</button>
      </div>

      <div className="listagem-table-wrapper">
        <table className="listagem-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Unidade</th>
              <th>Quantidade</th>
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
                    onBlur={() => fetchItemDirect(idx, row.codigo)}
                    onKeyPress={(e) => handleCodigoKeyPress(e, idx, row.codigo)}
                    placeholder="Digite o código"
                  />
                </td>
                <td>{row.descricao}</td>
                <td>{row.unidade}</td>
                <td>
                  <input
                    type="number"
                    value={row.quantidade}
                    onChange={(e) => handleInputChange(idx, "quantidade", e.target.value)}
                  />
                </td>
                <td>
                  <select value={row.locacao} onChange={(e) => handleInputChange(idx, "locacao", e.target.value)}>
                    <option value="">(selecionar)</option>
                    {locacoes.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </td>
                <td>
                  <select value={row.eap} onChange={(e) => handleInputChange(idx, "eap", e.target.value)}>
                    <option value="">(selecionar)</option>
                    {eaps.map((eap) => <option key={eap} value={eap}>{eap}</option>)}
                  </select>
                </td>
                <td>{row.fornecedor}</td>
                <td>
                  <div className="button-group">
                    <button className="remove-btn" onClick={() => removeRow(idx)}>X</button>
                    <button className="add-supabase-btn" onClick={() => alert("Adicionar insumo no Supabase")}>+</button>
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
