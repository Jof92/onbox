import React, { useState, useEffect } from "react";
import "./Listagem.css";

export default function Listagem({
  projetoAtual,
  usuarioAtual = "Usuário Exemplo",
  locacoes = [],
  eaps = [],
}) {
  const itemsByCode = {
    1001: { descricao: "Cimento CP II 50kg", unidade: "saco", sugestao: "Fornecedor A" },
    1002: { descricao: "Areia média m³", unidade: "m³", sugestao: "Fornecedor B" },
    1003: { descricao: "Tijolo maciço 6 furos", unidade: "un", sugestao: "Fornecedor C" },
    "200A": { descricao: "Fio 2,5 mm²", unidade: "rolo", sugestao: "Fornecedor D" },
    "300B": { descricao: 'Válvula esfera 1/2"', unidade: "un", sugestao: "Fornecedor E" },
  };

  const [rows, setRows] = useState([]);
  const [ultimaAlteracao, setUltimaAlteracao] = useState("");

  useEffect(() => {
    // 10 linhas iniciais
    const initialRows = [];
    for (let i = 0; i < 10; i++) {
      initialRows.push({ codigo: "", descricao: "", unidade: "", locacao: "", eap: "", sugestao: "" });
    }
    setRows(initialRows);
  }, []);

  const updateAlteracao = () => {
    const now = new Date();
    const formatted = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    setUltimaAlteracao(`${usuarioAtual} alterou, ${formatted}`);
  };

  const handleCodeChange = (index, value) => {
    const newRows = [...rows];
    newRows[index].codigo = value;

    if (itemsByCode[value]) {
      newRows[index].descricao = itemsByCode[value].descricao;
      newRows[index].unidade = itemsByCode[value].unidade;
      newRows[index].sugestao = itemsByCode[value].sugestao;
    } else {
      newRows[index].descricao = "";
      newRows[index].unidade = "";
      newRows[index].sugestao = "";
    }

    setRows(newRows);
    updateAlteracao();
  };

  const handleInputChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
    updateAlteracao();
  };

  const addRow = () => {
    setRows([...rows, { codigo: "", descricao: "", unidade: "", locacao: "", eap: "", sugestao: "" }]);
    updateAlteracao();
  };

  const removeRow = (index) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    updateAlteracao();
  };

  return (
    <div className="listagem-card">
      {/* Header */}
      <div className="listagem-header-container">
        <div className="projeto-nome">{projetoAtual}</div>
        <div className="alteracao-info">{ultimaAlteracao}</div>
      </div>

      {/* Botão de adicionar linha */}
      <div className="add-row-container">
        <button className="add-row-btn" onClick={addRow}>
          Adicionar linha
        </button>
      </div>

      {/* Tabela */}
      <div className="listagem-table-wrapper">
        <table className="listagem-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Unidade</th>
              <th>Locação</th>
              <th>EAP</th>
              <th>Sugestão</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="item-col">{idx + 1}</td>

                {/* Código */}
                <td>
                  <input
                    type="text"
                    className="code-input"
                    value={row.codigo}
                    onChange={(e) => handleCodeChange(idx, e.target.value)}
                  />
                </td>

                {/* Descrição */}
                <td>{row.descricao}</td>

                {/* Unidade */}
                <td>
                  <input
                    type="text"
                    className="unit-input"
                    value={row.unidade}
                    onChange={(e) => handleInputChange(idx, "unidade", e.target.value)}
                  />
                </td>

                {/* Locação */}
                <td>
                  <select value={row.locacao} onChange={(e) => handleInputChange(idx, "locacao", e.target.value)}>
                    <option value="">(selecionar)</option>
                    {locacoes.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </td>

                {/* EAP */}
                <td>
                  <select value={row.eap} onChange={(e) => handleInputChange(idx, "eap", e.target.value)}>
                    <option value="">(selecionar)</option>
                    {eaps.map((eap) => (
                      <option key={eap} value={eap}>
                        {eap}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Sugestão */}
                <td className="sugestao-col">{row.sugestao}</td>

                {/* Remover linha */}
                <td className="actions-col">
                  <button className="remove-btn" onClick={() => removeRow(idx)}>
                    X
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
