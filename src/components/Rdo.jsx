// src/components/Rdo.jsx
import React, { useState, useEffect } from "react";
import "./Rdo.css";
import { supabase } from "../supabaseClient";

const Rdo = ({ notaId, onClose, usuarioId }) => {
  const [data, setData] = useState({
    data_obra: "",
    dia_semana: "",
    inicio_obra: "",
    termino_obra: "",
    atraso_dias: "",
    engenheiro: "",
    pavimentos: "",
    atividades: "",
    clima_manha: "",
    clima_tarde: "",
    obra_op_manha: "",
    obra_op_tarde: "",
    efetivo_proprio: [{ funcao: "", total: "", presentes: "" }],
    efetivo_terceirizado: [{ funcao: "", total: "", presentes: "" }],
    equipamentos: [{ codigo: "", descricao: "", total: "", em_uso: "" }],
    intercorrencias: "",
    responsavel_preenchimento: "Engenharia",
  });

  const [loading, setLoading] = useState(false);

  // Carregar dados existentes da nota
  useEffect(() => {
    const fetchRdo = async () => {
      const { data: nota, error } = await supabase
        .from("notas")
        .select("data_entrega, campos_rdo")
        .eq("id", notaId)
        .single();

      if (error) {
        console.error("Erro ao carregar RDO:", error);
        return;
      }

      const campos = nota?.campos_rdo || {};
      const dataEntrega = nota?.data_entrega
        ? nota.data_entrega.split("T")[0]
        : "";

      const diaSemanaMap = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
      const dataObj = new Date(dataEntrega);
      const diaSemana = dataEntrega
        ? diaSemanaMap[dataObj.getDay()]
        : "";

      setData((prev) => ({
        ...prev,
        data_obra: dataEntrega,
        dia_semana: diaSemana,
        ...campos,
      }));
    };

    if (notaId) fetchRdo();
  }, [notaId]);

  const updateField = (field, value) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateArrayField = (arrayKey, index, field, value) => {
    setData((prev) => {
      const newArray = [...prev[arrayKey]];
      newArray[index] = { ...newArray[index], [field]: value };
      return { ...prev, [arrayKey]: newArray };
    });
  };

  const addRow = (arrayKey) => {
    setData((prev) => ({
      ...prev,
      [arrayKey]: [...prev[arrayKey], { funcao: "", total: "", presentes: "", codigo: "", descricao: "", em_uso: "" }],
    }));
  };

  const saveRdo = async () => {
    if (!notaId) return;
    setLoading(true);

    const payload = {
      campos_rdo: data,
      // Opcional: sincroniza data_entrega com data_obra
      data_entrega: data.data_obra || null,
    };

    const { error } = await supabase
      .from("notas")
      .update(payload)
      .eq("id", notaId);

    setLoading(false);
    if (error) {
      alert("Erro ao salvar o Diário de Obra.");
      console.error(error);
    } else {
      alert("Diário de Obra salvo com sucesso!");
      onClose();
    }
  };

  return (
    <div className="rdo-modal-container">
      <div className="rdo-header">
        <h2>Diário de Obra (RDO)</h2>
        <button className="rdo-close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      {/* Dados Gerais */}
      <div className="rdo-section">
        <div className="rdo-row">
          <div className="rdo-col">
            <label>Data:</label>
            <input
              type="date"
              value={data.data_obra}
              onChange={(e) => updateField("data_obra", e.target.value)}
            />
          </div>
          <div className="rdo-col">
            <label>Dia:</label>
            <input type="text" value={data.dia_semana} readOnly />
          </div>
        </div>

        <div className="rdo-row">
          <div className="rdo-col">
            <label>Início da Obra:</label>
            <input
              type="date"
              value={data.inicio_obra || ""}
              onChange={(e) => updateField("inicio_obra", e.target.value)}
            />
          </div>
          <div className="rdo-col">
            <label>Término Previsto:</label>
            <input
              type="date"
              value={data.termino_obra || ""}
              onChange={(e) => updateField("termino_obra", e.target.value)}
            />
          </div>
          <div className="rdo-col">
            <label>Atraso (dias):</label>
            <input
              type="text"
              value={data.atraso_dias || ""}
              onChange={(e) => updateField("atraso_dias", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label>Engenheiro Responsável:</label>
          <input
            type="text"
            value={data.engenheiro || ""}
            onChange={(e) => updateField("engenheiro", e.target.value)}
            placeholder="Nome e CREA"
          />
        </div>
      </div>

      {/* Condições Climáticas */}
      <div className="rdo-section">
        <h3>Condições Climáticas</h3>
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Condição</th>
              <th>Obra Operacional?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Manhã</td>
              <td>
                <label>
                  <input
                    type="radio"
                    name="clima_manha"
                    checked={data.clima_manha === "chuvoso"}
                    onChange={() => updateField("clima_manha", "chuvoso")}
                  />{" "}
                  Chuvoso
                </label>
                <label>
                  <input
                    type="radio"
                    name="clima_manha"
                    checked={data.clima_manha === "seco"}
                    onChange={() => updateField("clima_manha", "seco")}
                  />{" "}
                  Seco
                </label>
              </td>
              <td>
                <label>
                  <input
                    type="radio"
                    name="op_manha"
                    checked={data.obra_op_manha === "sim"}
                    onChange={() => updateField("obra_op_manha", "sim")}
                  />{" "}
                  Sim
                </label>
                <label>
                  <input
                    type="radio"
                    name="op_manha"
                    checked={data.obra_op_manha === "nao"}
                    onChange={() => updateField("obra_op_manha", "nao")}
                  />{" "}
                  Não
                </label>
              </td>
            </tr>
            <tr>
              <td>Tarde</td>
              <td>
                <label>
                  <input
                    type="radio"
                    name="clima_tarde"
                    checked={data.clima_tarde === "chuvoso"}
                    onChange={() => updateField("clima_tarde", "chuvoso")}
                  />{" "}
                  Chuvoso
                </label>
                <label>
                  <input
                    type="radio"
                    name="clima_tarde"
                    checked={data.clima_tarde === "seco"}
                    onChange={() => updateField("clima_tarde", "seco")}
                  />{" "}
                  Seco
                </label>
              </td>
              <td>
                <label>
                  <input
                    type="radio"
                    name="op_tarde"
                    checked={data.obra_op_tarde === "sim"}
                    onChange={() => updateField("obra_op_tarde", "sim")}
                  />{" "}
                  Sim
                </label>
                <label>
                  <input
                    type="radio"
                    name="op_tarde"
                    checked={data.obra_op_tarde === "nao"}
                    onChange={() => updateField("obra_op_tarde", "nao")}
                  />{" "}
                  Não
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Atividades Executadas */}
      <div className="rdo-section">
        <h3>Atividades Executadas</h3>
        <div>
          <label>Pavimentos/Setores envolvidos:</label>
          <input
            type="text"
            value={data.pavimentos || ""}
            onChange={(e) => updateField("pavimentos", e.target.value)}
            placeholder="Ex: Térreo, 1º Pavimento..."
          />
        </div>
        <div>
          <label>Descrição dos Serviços Realizados:</label>
          <textarea
            value={data.atividades || ""}
            onChange={(e) => updateField("atividades", e.target.value)}
            placeholder="Descreva as atividades do dia..."
          />
        </div>
      </div>

      {/* Efetivo Próprio */}
      <div className="rdo-section">
        <div className="rdo-section-header">
          <h3>Efetivo Próprio</h3>
          <button type="button" onClick={() => addRow("efetivo_proprio")}>
            +
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Função</th>
              <th>Total</th>
              <th>Presentes</th>
            </tr>
          </thead>
          <tbody>
            {data.efetivo_proprio.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    value={item.funcao || ""}
                    onChange={(e) =>
                      updateArrayField("efetivo_proprio", idx, "funcao", e.target.value)
                    }
                    placeholder="Função"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.total || ""}
                    onChange={(e) =>
                      updateArrayField("efetivo_proprio", idx, "total", e.target.value)
                    }
                    placeholder="0"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.presentes || ""}
                    onChange={(e) =>
                      updateArrayField("efetivo_proprio", idx, "presentes", e.target.value)
                    }
                    placeholder="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Efetivo Terceirizado */}
      <div className="rdo-section">
        <div className="rdo-section-header">
          <h3>Efetivo Terceirizado</h3>
          <button type="button" onClick={() => addRow("efetivo_terceirizado")}>
            +
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Função</th>
              <th>Total</th>
              <th>Presentes</th>
            </tr>
          </thead>
          <tbody>
            {data.efetivo_terceirizado.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    value={item.funcao || ""}
                    onChange={(e) =>
                      updateArrayField("efetivo_terceirizado", idx, "funcao", e.target.value)
                    }
                    placeholder="Função"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.total || ""}
                    onChange={(e) =>
                      updateArrayField("efetivo_terceirizado", idx, "total", e.target.value)
                    }
                    placeholder="0"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.presentes || ""}
                    onChange={(e) =>
                      updateArrayField("efetivo_terceirizado", idx, "presentes", e.target.value)
                    }
                    placeholder="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Equipamentos */}
      <div className="rdo-section">
        <div className="rdo-section-header">
          <h3>Equipamentos</h3>
          <button type="button" onClick={() => addRow("equipamentos")}>
            +
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Total</th>
              <th>Em Uso</th>
            </tr>
          </thead>
          <tbody>
            {data.equipamentos.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    value={item.codigo || ""}
                    onChange={(e) =>
                      updateArrayField("equipamentos", idx, "codigo", e.target.value)
                    }
                    placeholder="Cód."
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={item.descricao || ""}
                    onChange={(e) =>
                      updateArrayField("equipamentos", idx, "descricao", e.target.value)
                    }
                    placeholder="Descrição"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.total || ""}
                    onChange={(e) =>
                      updateArrayField("equipamentos", idx, "total", e.target.value)
                    }
                    placeholder="0"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.em_uso || ""}
                    onChange={(e) =>
                      updateArrayField("equipamentos", idx, "em_uso", e.target.value)
                    }
                    placeholder="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Intercorrências */}
      <div className="rdo-section">
        <h3>Intercorrências</h3>
        <textarea
          value={data.intercorrencias || ""}
          onChange={(e) => updateField("intercorrencias", e.target.value)}
          placeholder="Descreva imprevistos, paralisações, não conformidades, etc."
        />
      </div>

      {/* Fotos (área visual) */}
      <div className="rdo-section">
        <h3>Espaço para Inclusão de Fotos</h3>
        <div className="rdo-photo-placeholder">Área reservada para anexar imagens do dia</div>
        <div className="rdo-photo-placeholder">Área reservada para anexar imagens do dia</div>
      </div>

      {/* Responsável */}
      <div className="rdo-section">
        <label>Responsável pelo preenchimento:</label>
        <input
          type="text"
          value={data.responsavel_preenchimento || ""}
          onChange={(e) => updateField("responsavel_preenchimento", e.target.value)}
        />
      </div>

      {/* Ações */}
      <div className="rdo-actions">
        <button className="btn-cancel" onClick={onClose} disabled={loading}>
          Cancelar
        </button>
        <button className="btn-save" onClick={saveRdo} disabled={loading}>
          {loading ? "Salvando..." : "Salvar RDO"}
        </button>
      </div>
    </div>
  );
};

export default Rdo;