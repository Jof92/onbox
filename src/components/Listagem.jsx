import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import { FaPlus, FaTimes, FaPaperPlane } from "react-icons/fa";

export default function Listagem({ projetoAtual, pilhaAtual, notaAtual, usuarioAtual }) {
  const [rows, setRows] = useState([]);
  const [ultimaAlteracao, setUltimaAlteracao] = useState("");
  const [locacoes, setLocacoes] = useState([]);
  const [eaps, setEaps] = useState([]);
  const [direcionarPara, setDirecionarPara] = useState("");

  // Inicializa locações, EAPs e linhas
  useEffect(() => {
    if (!projetoAtual?.id) return;

    const fetchListsAndRows = async () => {
      // Buscar locações
      const { data: pavimentosData } = await supabase
        .from("pavimentos")
        .select("*")
        .eq("project_id", projetoAtual.id);

      setLocacoes(pavimentosData?.map((p) => p.name) || []);

      // Buscar EAPs
      const { data: eapsData } = await supabase
        .from("eap")
        .select("*")
        .eq("project_id", projetoAtual.id);

      setEaps(eapsData?.map((e) => e.name) || []);

      // Buscar itens já salvos para projeto/pilha/nota
      const { data: itensSalvos } = await supabase
        .from("planilha_itens")
        .select("*")
        .eq("projeto_id", projetoAtual.id)
        .eq("pilha", pilhaAtual)
        .eq("nota", notaAtual);

      if (itensSalvos && itensSalvos.length > 0) {
        setRows(itensSalvos.map(item => ({
          codigo: item.codigo || "",
          descricao: item.descricao || "",
          unidade: item.unidade || "",
          quantidade: item.quantidade || "",
          locacao: item.locacao || "",
          eap: item.eap || "",
          fornecedor: item.fornecedor || ""
        })));
      } else {
        // Se não houver itens, inicializa 10 linhas vazias
        setRows(Array.from({ length: 10 }, () => ({
          codigo: "",
          descricao: "",
          unidade: "",
          quantidade: "",
          locacao: "",
          eap: "",
          fornecedor: ""
        })));
      }
    };

    fetchListsAndRows();
  }, [projetoAtual, pilhaAtual, notaAtual]);

  // Atualiza última alteração
  useEffect(() => {
    const now = new Date();
    setUltimaAlteracao(`${usuarioAtual} alterou em ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  }, [usuarioAtual]);

  const updateAlteracao = () => {
    const now = new Date();
    setUltimaAlteracao(`${usuarioAtual} alterou em ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  };

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
    setRows([...rows, { codigo: "", descricao: "", unidade: "", quantidade: "", locacao: "", eap: "", fornecedor: "" }]);
    updateAlteracao();
  };

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
    updateAlteracao();
  };

  const handleSave = async () => {
    try {
      let itensToSave = rows.map((row) => ({
        codigo: row.codigo,
        descricao: row.descricao,
        unidade: row.unidade,
        quantidade: row.quantidade ? Number(row.quantidade) : null,
        locacao: row.locacao,
        eap: row.eap,
        fornecedor: row.fornecedor,
        projeto_id: projetoAtual?.id || null,
        pilha: pilhaAtual || null,
        nota: notaAtual || null,
        direcionar_para: direcionarPara || null,
      }));

      // Remove duplicados (mesmo codigo + projeto_id)
      itensToSave = Object.values(
        itensToSave.reduce((acc, item) => {
          const key = `${item.codigo}_${item.projeto_id}`;
          acc[key] = item; // último prevalece
          return acc;
        }, {})
      );

      const { error } = await supabase
        .from("planilha_itens")
        .upsert(itensToSave, { onConflict: ["codigo", "projeto_id"] });

      if (error) throw error;

      alert("Lista enviada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar lista: " + err.message);
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
        <button className="add-row-btn" onClick={addRow}><FaPlus /> Adicionar linha</button>

        <input
          type="text"
          className="direcionar-para-input"
          placeholder="Direcionar para"
          value={direcionarPara}
          onChange={(e) => setDirecionarPara(e.target.value)}
        />

        <button className="send-btn" onClick={handleSave}>
          <FaPaperPlane style={{ marginRight: "6px" }} />
          Enviar
        </button>
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
                    {locacoes.map((loc, i) => (
                      <option key={`${loc}_${i}`} value={loc}>{loc}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={row.eap} onChange={(e) => handleInputChange(idx, "eap", e.target.value)}>
                    <option value="">(selecionar)</option>
                    {eaps.map((eap, i) => (
                      <option key={`${eap}_${i}`} value={eap}>{eap}</option>
                    ))}
                  </select>
                </td>
                <td>{row.fornecedor}</td>
                <td>
                  <div className="button-group">
                    <button className="add-supabase-btn" onClick={() => alert("Adicionar insumo no Supabase")}><FaPlus /></button>
                    <button className="remove-btn" onClick={() => removeRow(idx)}><FaTimes /></button>
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
