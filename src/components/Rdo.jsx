// src/components/Rdo.jsx
import React, { useState, useEffect, useRef } from "react";
import "./Rdo.css";
import { supabase } from "../supabaseClient";
import { FaTimes, FaTrash } from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudSun,
  faCloudShowersHeavy,
} from "@fortawesome/free-solid-svg-icons";
import { faSun } from "@fortawesome/free-regular-svg-icons";

const Rdo = ({ notaId, onClose, usuarioId, projetoAtual }) => {
  const responsavelInputRef = useRef(null);

  const [data, setData] = useState({
    inicio_obra: "",
    termino_obra: "",
    atraso_dias: "",
    clima_manha: "",
    clima_tarde: "",
    obra_op_manha: "",
    obra_op_tarde: "",
    efetivo_proprio: [{ funcao: "", total: "", presentes: "" }],
    efetivo_terceirizado: [{ funcao: "", total: "", presentes: "" }],
    equipamentos: [{ codigo: "", descricao: "", total: "", em_uso: "" }],
    intercorrencias: "",
    responsavel_preenchimento: "",
  });

  const [dataOriginal, setDataOriginal] = useState("");
  const [diaSemanaOriginal, setDiaSemanaOriginal] = useState("");
  const [pavimentosAtividades, setPavimentosAtividades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projetoNome, setProjetoNome] = useState("");
  const [engenheiroNome, setEngenheiroNome] = useState("");

  // Estados para autocomplete
  const [sugestoesMembros, setSugestoesMembros] = useState([]);
  const [mostrarSugestoesMembros, setMostrarSugestoesMembros] = useState(false);

  // Carregar nome do projeto, engenheiro e pavimentos
  useEffect(() => {
    const fetchProjetoData = async () => {
      if (!projetoAtual?.id) {
        console.warn("⚠️ projetoAtual não definido ou sem ID");
        return;
      }

      console.log("📥 Carregando dados do projeto:", projetoAtual.id);

      const { data: proj, error } = await supabase
        .from("projects")
        .select("name, engenheiro_id, data_inicio, data_finalizacao")
        .eq("id", projetoAtual.id)
        .single();

      if (error) {
        console.error("❌ Erro ao carregar projeto:", error);
        return;
      }

      if (!proj) {
        console.warn("⚠️ Projeto não encontrado");
        return;
      }

      setProjetoNome(proj.name);

      setData((prev) => ({
        ...prev,
        inicio_obra: proj.data_inicio || "",
        termino_obra: proj.data_finalizacao || "",
      }));

      // MANTIDO EXATAMENTE COMO VOCÊ ENVIOU
      if (proj.engenheiro_id) {
        const { data: user, error: userError } = await supabase
          .from("profiles")
          .select("nome, avatar_url")
          .eq("id", proj.engenheiro_id)
          .single();

        if (userError) {
          console.error("❌ Erro ao carregar engenheiro:", userError);
          setEngenheiroNome("Não atribuído");
        } else if (user) {
          setEngenheiroNome(user.nome || "Nome não cadastrado");
        } else {
          setEngenheiroNome("Não atribuído");
        }
      } else {
        setEngenheiroNome("Não atribuído");
      }

      const { data: pavimentosData, error: pavError } = await supabase
        .from("pavimentos")
        .select("id, name, ordem")
        .eq("project_id", projetoAtual.id)
        .order("ordem", { ascending: true });

      if (pavError) {
        console.error("❌ Erro ao carregar pavimentos:", pavError);
        return;
      }

      if (pavimentosData?.length > 0) {
        setPavimentosAtividades(
          pavimentosData.map((pav) => ({
            pavimento: pav.name,
            descricao: "",
          }))
        );
      } else {
        setPavimentosAtividades([]);
      }
    };

    fetchProjetoData();
  }, [projetoAtual]);

  // Carregar dados existentes da nota
  useEffect(() => {
    const fetchRdo = async () => {
      if (!notaId) return;

      const { data: nota, error } = await supabase
        .from("notas")
        .select("data_entrega, descricao")
        .eq("id", notaId)
        .single();

      if (error) {
        console.error("❌ Erro ao carregar RDO:", error);
        return;
      }

      const dataEntrega = nota?.data_entrega ? nota.data_entrega.split("T")[0] : "";
      setDataOriginal(dataEntrega);

      let diaSemana = "";
      if (dataEntrega) {
        const [ano, mes, dia] = dataEntrega.split("-").map(Number);
        const dataLocal = new Date(ano, mes - 1, dia);
        const diaSemanaMap = [
          "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
          "Quinta-feira", "Sexta-feira", "Sábado"
        ];
        diaSemana = diaSemanaMap[dataLocal.getDay()];
      }
      setDiaSemanaOriginal(diaSemana);

      let campos = {};
      if (nota?.descricao) {
        try {
          campos = JSON.parse(nota.descricao);
        } catch (e) {
          console.log("ℹ️ Descrição não é JSON válido");
        }
      }

      const { data_obra, dia_semana, engenheiro, ...resto } = campos;
      setData((prev) => ({
        ...prev,
        ...resto,
      }));

      if (campos.atividades) {
        try {
          const atividadesObj = JSON.parse(campos.atividades);
          if (typeof atividadesObj === "object" && !Array.isArray(atividadesObj)) {
            setPavimentosAtividades((prev) =>
              prev.map((item) => ({
                ...item,
                descricao: atividadesObj[item.pavimento] || "",
              }))
            );
          }
        } catch (e) {
          console.warn("Atividades não é um objeto válido");
        }
      }
    };

    fetchRdo();
  }, [notaId]);

  // Função para buscar membros do projeto
  const buscarMembrosDoProjetoRdo = async (termo) => {
    if (!termo.trim() || !projetoAtual?.id) return [];

    try {
      const { data: membrosData } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projetoAtual.id);

      const userIds = membrosData?.map((m) => m.user_id).filter(Boolean) || [];
      if (userIds.length === 0) return [];

      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, name, nickname, avatar_url")
        .in("id", userIds)
        .or(`name.ilike.%${termo}%,nickname.ilike.%${termo}%`)
        .limit(5);

      return perfis || [];
    } catch (err) {
      console.error("Erro ao buscar membros do projeto:", err);
      return [];
    }
  };

  // Handler para mudanças no campo de responsável
  const handleResponsavelChange = async (e) => {
    const valor = e.target.value;
    const pos = e.target.selectionStart;

    updateField("responsavel_preenchimento", valor);

    const antes = valor.substring(0, pos);
    const ultimaArroba = antes.lastIndexOf("@");

    if (ultimaArroba !== -1) {
      const termo = antes.substring(ultimaArroba + 1).trim();
      if (termo) {
        setMostrarSugestoesMembros(true);
        const resultados = await buscarMembrosDoProjetoRdo(termo);
        setSugestoesMembros(resultados);
      } else {
        setMostrarSugestoesMembros(false);
      }
    } else {
      setMostrarSugestoesMembros(false);
    }
  };

  // Inserir membro selecionado
  const inserirResponsavel = (perfil) => {
    updateField("responsavel_preenchimento", perfil.name || perfil.nickname);
    setMostrarSugestoesMembros(false);
    setTimeout(() => responsavelInputRef.current?.focus(), 0);
  };

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
    const emptyRow =
      arrayKey === "equipamentos"
        ? { codigo: "", descricao: "", total: "", em_uso: "" }
        : { funcao: "", total: "", presentes: "" };

    setData((prev) => ({
      ...prev,
      [arrayKey]: [...prev[arrayKey], emptyRow],
    }));
  };

  const updatePavimentoDescricao = (pavimento, descricao) => {
    setPavimentosAtividades((prev) =>
      prev.map((item) =>
        item.pavimento === pavimento ? { ...item, descricao } : item
      )
    );
  };

  const removerPavimentoDoRdo = (pavimento) => {
    setPavimentosAtividades((prev) =>
      prev.filter((item) => item.pavimento !== pavimento)
    );
  };

  const saveRdo = async () => {
    if (!notaId) return;
    setLoading(true);

    const atividadesObj = {};
    pavimentosAtividades.forEach((item) => {
      if (item.descricao.trim()) {
        atividadesObj[item.pavimento] = item.descricao.trim();
      }
    });

    const payload = {
      descricao: JSON.stringify({
        ...data,
        atividades: JSON.stringify(atividadesObj),
      }),
      data_entrega: dataOriginal || null,
    };

    const { error } = await supabase
      .from("notas")
      .update(payload)
      .eq("id", notaId);

    setLoading(false);

    if (error) {
      console.error("❌ Erro ao salvar:", error);
      alert("Erro ao salvar o Diário de Obra.");
    } else {
      alert("Diário de Obra salvo com sucesso!");
      onClose();
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [ano, mes, dia] = dateStr.split("-").map(Number);
    return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
  };

  return (
    <div className="rdo-modal-container">
      <div className="listagem-card">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">
              Diário de obra - {projetoNome || "Projeto não informado"}
            </span>
            <div className="sub-info">
              <span className="nota-name1">
                {dataOriginal ? `${formatDate(dataOriginal)} – ${diaSemanaOriginal}` : "(Data não definida)"}
              </span>
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
      </div>

      <div className="rdo-content">
        <div className="rdo-section">
          <div className="rdo-row">
            {/* MANTIDO EXATAMENTE COMO VOCÊ ENVIOU */}
            <div className="rdo-col">
              <label>Engenheiro Responsável</label>
              <input
                type="text"
                value={engenheiroNome}
                readOnly
                className="rdo-input-readonly"
              />
            </div>
            
            {/* APENAS ESTE CAMPO FOI ALTERADO */}
            <div className="rdo-col">
              <label>Responsável pelo Preenchimento</label>
              <div style={{ position: "relative" }}>
                <input
                  ref={responsavelInputRef}
                  type="text"
                  value={data.responsavel_preenchimento || ""}
                  onChange={handleResponsavelChange}
                  placeholder="Digite @ para mencionar um membro"
                  autoComplete="off"
                  onBlur={() => setTimeout(() => setMostrarSugestoesMembros(false), 200)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && mostrarSugestoesMembros && sugestoesMembros.length > 0) {
                      e.preventDefault();
                      inserirResponsavel(sugestoesMembros[0]);
                    }
                  }}
                />
                
                {mostrarSugestoesMembros && sugestoesMembros.length > 0 && (
                  <div className="suggestions-dropdown">
                    {sugestoesMembros.map((membro) => (
                      <div
                        key={membro.id}
                        onClick={() => inserirResponsavel(membro)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="suggestion-item"
                      >
                        {membro.avatar_url ? (
                          <img src={membro.avatar_url} alt="" />
                        ) : (
                          <div className="suggestion-avatar-placeholder">
                            {(membro.name || membro.nickname)?.charAt(0).toUpperCase() || "?"}
                          </div>
                        )}
                        {membro.name || membro.nickname}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rdo-row">
            <div className="rdo-col">
              <label>Início da Obra</label>
              <input
                type="date"
                value={data.inicio_obra || ""}
                onChange={(e) => updateField("inicio_obra", e.target.value)}
              />
            </div>
            <div className="rdo-col">
              <label>Término Previsto</label>
              <input
                type="date"
                value={data.termino_obra || ""}
                onChange={(e) => updateField("termino_obra", e.target.value)}
              />
            </div>
            <div className="rdo-col">
              <label>Atraso (dias)</label>
              <input
                type="text"
                value={data.atraso_dias || ""}
                onChange={(e) => updateField("atraso_dias", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="rdo-section">
          <h3>
            <FontAwesomeIcon icon={faCloudSun} /> Clima
          </h3>
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Condição</th>
                <th>Obra Operacional</th>
              </tr>
            </thead>
            <tbody>
                    <tr>
                        <td>Manhã</td>
                        <td>
                        <div
                            className={`rdo-clima-icon ${data.clima_manha === "chuvoso" ? "selected" : ""}`}
                            onClick={() => updateField("clima_manha", "chuvoso")}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && updateField("clima_manha", "chuvoso")}
                            aria-label="Chuvoso"
                        >
                            <FontAwesomeIcon icon={faCloudShowersHeavy} />
                        </div>
                        <div
                            className={`rdo-clima-icon ${data.clima_manha === "seco" ? "selected" : ""}`}
                            onClick={() => updateField("clima_manha", "seco")}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && updateField("clima_manha", "seco")}
                            aria-label="Ensolarado"
                        >
                            <FontAwesomeIcon icon={faSun} />
                        </div>
                        </td>
                        <td>
                        <div
                            className={`rdo-op-text ${data.obra_op_manha === "sim" ? "selected" : ""}`}
                            onClick={() => updateField("obra_op_manha", "sim")}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && updateField("obra_op_manha", "sim")}
                            aria-label="Obra operacional: Sim"
                        >
                            Sim
                        </div>
                        <div
                            className={`rdo-op-text ${data.obra_op_manha === "nao" ? "selected" : ""}`}
                            onClick={() => updateField("obra_op_manha", "nao")}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && updateField("obra_op_manha", "nao")}
                            aria-label="Obra operacional: Não"
                        >
                            Não
                        </div>
                        </td>
                    </tr>
                    <tr>
                        <td>Tarde</td>
                        <td>
                        <div
                            className={`rdo-clima-icon ${data.clima_tarde === "chuvoso" ? "selected" : ""}`}
                            onClick={() => updateField("clima_tarde", "chuvoso")}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && updateField("clima_tarde", "chuvoso")}
                            aria-label="Chuvoso"
                        >
                            <FontAwesomeIcon icon={faCloudShowersHeavy} />
                        </div>
                        <div
                            className={`rdo-clima-icon ${data.clima_tarde === "seco" ? "selected" : ""}`}
                            onClick={() => updateField("clima_tarde", "seco")}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && updateField("clima_tarde", "seco")}
                            aria-label="Ensolarado"
                        >
                            <FontAwesomeIcon icon={faSun} />
                        </div>
                        </td>
                        <td>
                        <div
                            className={`rdo-op-text ${data.obra_op_tarde === "sim" ? "selected" : ""}`}
                            onClick={() => updateField("obra_op_tarde", "sim")}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && updateField("obra_op_tarde", "sim")}
                            aria-label="Obra operacional: Sim"
                        >
                            Sim
                        </div>
                        <div
                            className={`rdo-op-text ${data.obra_op_tarde === "nao" ? "selected" : ""}`}
                            onClick={() => updateField("obra_op_tarde", "nao")}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && updateField("obra_op_tarde", "nao")}
                            aria-label="Obra operacional: Não"
                        >
                            Não
                        </div>
                        </td>
                    </tr>
                    </tbody>
          </table>
        </div>

        <div className="rdo-section">
          <h3>Atividades Executadas</h3>
          {pavimentosAtividades.length === 0 ? (
            <p>Nenhum pavimento cadastrado no projeto.</p>
          ) : (
            pavimentosAtividades.map((item, index) => (
              <div key={index} className="rdo-pavimento-linha">
                <div className="rdo-pavimento-nome">{item.pavimento}</div>
                <div className="rdo-pavimento-descricao">
                  <textarea
                    value={item.descricao}
                    onChange={(e) =>
                      updatePavimentoDescricao(item.pavimento, e.target.value)
                    }
                    placeholder={`Descreva os serviços realizados em ${item.pavimento}...`}
                  />
                </div>
                <button
                  type="button"
                  className="rdo-pavimento-remover"
                  onClick={() => removerPavimentoDoRdo(item.pavimento)}
                  aria-label={`Remover ${item.pavimento}`}
                >
                  <FaTrash />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="rdo-section rdo-efetivos-container">
          <div className="rdo-efetivo-col">
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

          <div className="rdo-efetivo-col">
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
        </div>

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

        <div className="rdo-section">
          <h3>Intercorrências</h3>
          <textarea
            value={data.intercorrencias || ""}
            onChange={(e) => updateField("intercorrencias", e.target.value)}
            placeholder="Descreva imprevistos, paralisações, não conformidades, etc."
          />
        </div>

        <div className="rdo-section">
          <h3>Espaço para Inclusão de Fotos</h3>
          <div className="rdo-photo-placeholder">Área reservada para anexar imagens do dia</div>
          <div className="rdo-photo-placeholder">Área reservada para anexar imagens do dia</div>
        </div>

        <div className="rdo-actions">
          <button className="btn-cancel" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className="btn-save" onClick={saveRdo} disabled={loading}>
            {loading ? "Salvando..." : "Salvar RDO"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Rdo;