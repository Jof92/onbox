// src/components/Rdo.jsx
import React, { useState, useEffect, useRef } from "react";
import "./Rdo.css";
import { supabase } from "../supabaseClient";
import { FaTimes, FaTrash } from "react-icons/fa";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudSun,
  faCloudShowersHeavy,
  faPersonDigging,
  faUserGroup,
  faGear,
  faTriangleExclamation,
  faCamera,
  faPrint,
} from "@fortawesome/free-solid-svg-icons";
import {
  faSun,
  faFilePdf,
} from "@fortawesome/free-regular-svg-icons";
import BuscaInsumo from "./BuscaInsumo";

// Ícone de transferência de dados (SVG fornecido)
const DataTransferIcon = ({ onClick }) => (
  <svg
    id="Layer_1"
    data-name="Layer 1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 122.88 85.45"
    width="24"
    height="24"
    className="data-transfer-icon"
    onClick={onClick}
  >
    <title>data-transfer</title>
    <path d="M74.69,32.21a.72.72,0,0,0-.52.21.72.72,0,0,0-.2.52v17.5a6.65,6.65,0,0,0-4.35,0V32.94a5.12,5.12,0,0,1,5.09-5.1h43.08a5.12,5.12,0,0,1,5.09,5.1V80.36a5.12,5.12,0,0,1-5.09,5.09H78.45c1.14-1,2.84-2.69,4.55-4.36h34.81a.72.72,0,0,0,.73-.73V32.94a.72.72,0,0,0-.73-.73ZM53.16,73V65.87a2.59,2.59,0,0,1,2.58-2.58H69.61V58.74a2.13,2.13,0,0,1,.86-1.82c1.44-1,2.85.35,3.85,1.25,2.81,2.57,8.49,8.39,10,9.66a2.09,2.09,0,0,1,0,3.28c-1.53,1.31-7.51,7.45-10.25,9.89-1,.85-2.26,1.89-3.58,1a2.14,2.14,0,0,1-.86-1.82V75.62H55.74A2.62,2.62,0,0,1,53.16,73ZM40.92,7.89,54.39,20.51H40.92V7.89ZM13.71,33a2,2,0,0,1,1.47-.68H38.79a1.93,1.93,0,0,1,1.47.66,2.31,2.31,0,0,1,0,3.06,2,2,0,0,1-1.47.68H15.18a2,2,0,0,1-1.48-.67,2.33,2.33,0,0,1-.57-1.53A2.26,2.26,0,0,1,13.71,33Zm0,25.58a2,2,0,0,1,1.47-.67H45.57a2,2,0,0,1,1.43.63l0,0a2.28,2.28,0,0,1,.58,1.53,2.24,2.24,0,0,1-.57,1.53,2,2,0,0,1-1.48.67H15.18a2,2,0,0,1-1.44-.62l0-.05a2.32,2.32,0,0,1,0-3.06ZM46.14,45.13a2,2,0,0,1,1.47.68,2.32,2.32,0,0,1,0,3.06,2,2,0,0,1-1.48.67h-31a2,2,0,0,1-1.48-.67,2.32,2.32,0,0,1,0-3.06l0,0a2,2,0,0,1,1.43-.64ZM13.71,20.23a2,2,0,0,1,1.47-.68h9.38a2,2,0,0,1,1.43.63l0,0a2.25,2.25,0,0,1,.58,1.53,2.29,2.29,0,0,1-.54,1.48l0,.05a2,2,0,0,1-1.47.67H15.18a2,2,0,0,1-1.44-.62l0,0a2.33,2.33,0,0,1-.57-1.54,2.27,2.27,0,0,1,.57-1.51ZM61.89,22.6c0-1.05-1.44-2.26-2.12-2.92L40.4.83A2.19,2.19,0,0,0,38.67,0H4A4,4,0,0,0,0,4V73.08a4,4,0,0,0,4,4H46.79v-4.5H4.51V4.49h31.9V22.76A2.26,2.26,0,0,0,38.67,25H57.39V56.56h4.5v-34ZM84.46,48.65a2.1,2.1,0,0,1-2-2.17,2.07,2.07,0,0,1,2-2.17H108a2.07,2.07,0,0,1,2,2.17,2.1,2.1,0,0,1-2,2.17H84.46ZM91,62.79a2.11,2.11,0,0,1-2-2.17,2.07,2.07,0,0,1,2-2.17h17a2.07,2.07,0,0,1,2,2.17,2.1,2.1,0,0,1-2,2.17H91Z" />
  </svg>
);

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
    fotos: [],
  });
  const [dataOriginal, setDataOriginal] = useState("");
  const [diaSemanaOriginal, setDiaSemanaOriginal] = useState("");
  const [pavimentosAtividades, setPavimentosAtividades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projetoNome, setProjetoNome] = useState("");
  const [engenheiroNome, setEngenheiroNome] = useState("");
  const [rdoId, setRdoId] = useState(null);
  const [rdoCarregado, setRdoCarregado] = useState(false);
  const [sugestoesMembros, setSugestoesMembros] = useState([]);
  const [mostrarSugestoesMembros, setMostrarSugestoesMembros] = useState(false);
  const [buscaInsumoAberta, setBuscaInsumoAberta] = useState(false);
  const [linhaBuscaAtiva, setLinhaBuscaAtiva] = useState(null);
  const [fotoEmExibicao, setFotoEmExibicao] = useState(null);

  // Carregar projeto
  useEffect(() => {
    const fetchProjetoData = async () => {
      if (!projetoAtual?.id) return;
      const { data: proj, error } = await supabase
        .from("projects")
        .select("name, engenheiro_id, data_inicio, data_finalizacao")
        .eq("id", projetoAtual.id)
        .single();

      if (error || !proj) return;

      setProjetoNome(proj.name);
      setData((prev) => ({
        ...prev,
        inicio_obra: prev.inicio_obra || proj.data_inicio || "",
        termino_obra: prev.termino_obra || proj.data_finalizacao || "",
      }));

      if (proj.engenheiro_id) {
        const { data: user } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", proj.engenheiro_id)
          .single();
        setEngenheiroNome(user?.nome || "Não atribuído");
      } else {
        setEngenheiroNome("Não atribuído");
      }
    };
    fetchProjetoData();
  }, [projetoAtual, rdoCarregado]);

  // Carregar RDO
  useEffect(() => {
    const fetchRdo = async () => {
      if (!notaId) return;
      try {
        const { data: nota } = await supabase
          .from("notas")
          .select("data_entrega")
          .eq("id", notaId)
          .single();

        const dataEntrega = nota?.data_entrega ? nota.data_entrega.split("T")[0] : "";
        setDataOriginal(dataEntrega);

        let diaSemana = "";
        if (dataEntrega) {
          const [ano, mes, dia] = dataEntrega.split("-").map(Number);
          const dataLocal = new Date(ano, mes - 1, dia);
          const dias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
          diaSemana = dias[dataLocal.getDay()];
        }
        setDiaSemanaOriginal(diaSemana);

        const { data: rdoData } = await supabase
          .from("rdos")
          .select("*")
          .eq("nota_id", notaId)
          .maybeSingle();

        const { data: pavimentosData } = await supabase
          .from("pavimentos")
          .select("name")
          .eq("project_id", projetoAtual.id)
          .order("ordem", { ascending: true });

        let pavimentosComDescricao = [];
        if (rdoData?.atividades && Object.keys(rdoData.atividades).length > 0) {
          pavimentosComDescricao = Object.keys(rdoData.atividades).map(p => ({
            pavimento: p,
            descricao: rdoData.atividades[p] || "",
          }));
        } else {
          pavimentosComDescricao = pavimentosData.map(p => ({ pavimento: p.name, descricao: "" }));
        }
        setPavimentosAtividades(pavimentosComDescricao);

        if (rdoData) {
          setRdoId(rdoData.id);
          setRdoCarregado(true);
          setData({
            inicio_obra: rdoData.inicio_obra || "",
            termino_obra: rdoData.termino_obra || "",
            atraso_dias: rdoData.atraso_dias || "",
            clima_manha: rdoData.clima_manha || "",
            clima_tarde: rdoData.clima_tarde || "",
            obra_op_manha: rdoData.obra_op_manha || "",
            obra_op_tarde: rdoData.obra_op_tarde || "",
            efetivo_proprio: Array.isArray(rdoData.efetivo_proprio) ? rdoData.efetivo_proprio : [{ funcao: "", total: "", presentes: "" }],
            efetivo_terceirizado: Array.isArray(rdoData.efetivo_terceirizado) ? rdoData.efetivo_terceirizado : [{ funcao: "", total: "", presentes: "" }],
            equipamentos: Array.isArray(rdoData.equipamentos) ? rdoData.equipamentos : [{ codigo: "", descricao: "", total: "", em_uso: "" }],
            intercorrencias: rdoData.intercorrencias || "",
            responsavel_preenchimento: rdoData.responsavel_preenchimento || "",
            fotos: Array.isArray(rdoData.fotos) ? rdoData.fotos : [],
          });
          if (rdoData.projeto_nome) setProjetoNome(rdoData.projeto_nome);
          if (rdoData.engenheiro_nome) setEngenheiroNome(rdoData.engenheiro_nome);
        } else {
          setRdoCarregado(true);
        }
      } catch (err) {
        console.error("Erro ao carregar RDO:", err);
      }
    };
    fetchRdo();
  }, [notaId, projetoAtual]);

  // Funções auxiliares
  const copiarDoUltimoRdo = async (tipo) => {
    if (!projetoAtual?.id) return;
    try {
      let query = supabase.from("rdos").select("*").eq("project_id", projetoAtual.id).order("created_at", { ascending: false }).limit(1);
      if (rdoId) query = query.neq("id", rdoId);
      const { data: rdos } = await query;
      if (!rdos?.[0]) {
        alert("Nenhum Diário de Obra anterior encontrado para copiar.");
        return;
      }
      const ultimo = rdos[0];
      let dados = [];
      if (tipo === "efetivo_proprio") dados = ultimo.efetivo_proprio || [{ funcao: "", total: "", presentes: "" }];
      if (tipo === "efetivo_terceirizado") dados = ultimo.efetivo_terceirizado || [{ funcao: "", total: "", presentes: "" }];
      if (tipo === "equipamentos") dados = ultimo.equipamentos || [{ codigo: "", descricao: "", total: "", em_uso: "" }];
      setData(prev => ({ ...prev, [tipo]: dados }));
    } catch (err) {
      alert("Erro ao copiar dados do último Diário de Obra.");
    }
  };

  const buscarMembrosDoProjetoRdo = async (termo) => {
    if (!termo.trim() || !projetoAtual?.id) return [];
    const { data: membros } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projetoAtual.id);
    const ids = membros?.map(m => m.user_id).filter(Boolean) || [];
    if (ids.length === 0) return [];
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id, name, nickname")
      .in("id", ids)
      .or(`name.ilike.%${termo}%,nickname.ilike.%${termo}%`)
      .limit(5);
    return perfis || [];
  };

  const handleResponsavelChange = async (e) => {
    const valor = e.target.value;
    const pos = e.target.selectionStart;
    setData(prev => ({ ...prev, responsavel_preenchimento: valor }));
    const antes = valor.substring(0, pos);
    const arroba = antes.lastIndexOf("@");
    if (arroba !== -1) {
      const termo = antes.substring(arroba + 1).trim();
      if (termo) {
        setMostrarSugestoesMembros(true);
        const res = await buscarMembrosDoProjetoRdo(termo);
        setSugestoesMembros(res);
      } else setMostrarSugestoesMembros(false);
    } else setMostrarSugestoesMembros(false);
  };

  const inserirResponsavel = (perfil) => {
    setData(prev => ({ ...prev, responsavel_preenchimento: perfil.name || perfil.nickname }));
    setMostrarSugestoesMembros(false);
    setTimeout(() => responsavelInputRef.current?.focus(), 0);
  };

  const updateField = (field, value) => setData(prev => ({ ...prev, [field]: value }));
  const updateArrayField = (arrayKey, index, field, value) => {
    setData(prev => {
      const arr = [...prev[arrayKey]];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [arrayKey]: arr };
    });
  };

  const addRow = (key) => {
    const row = key === "equipamentos"
      ? { codigo: "", descricao: "", total: "", em_uso: "" }
      : { funcao: "", total: "", presentes: "" };
    setData(prev => ({ ...prev, [key]: [...prev[key], row] }));
  };

  const removeRow = (key, idx) => {
    setData(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  const updatePavimentoDescricao = (pav, desc) => {
    setPavimentosAtividades(prev =>
      prev.map(item => item.pavimento === pav ? { ...item, descricao: desc } : item)
    );
  };

  const removerPavimentoDoRdo = (pav) => {
    setPavimentosAtividades(prev => prev.filter(item => item.pavimento !== pav));
  };

  const buscarItemPorCodigo = async (idx, cod) => {
    if (!cod?.trim()) {
      setData(prev => {
        const eq = [...prev.equipamentos];
        eq[idx].descricao = "";
        return { ...prev, equipamentos: eq };
      });
      return;
    }
    const { data: item } = await supabase
      .from("itens")
      .select("descricao")
      .eq("codigo", cod)
      .maybeSingle();
    setData(prev => {
      const eq = [...prev.equipamentos];
      eq[idx].descricao = item?.descricao || "";
      return { ...prev, equipamentos: eq };
    });
  };

  const abrirBuscaInsumo = (idx) => {
    setLinhaBuscaAtiva(idx);
    setBuscaInsumoAberta(true);
  };

  const handleSelecionarInsumo = (cod) => {
    if (linhaBuscaAtiva !== null) {
      updateArrayField("equipamentos", linhaBuscaAtiva, "codigo", cod);
      buscarItemPorCodigo(linhaBuscaAtiva, cod);
    }
    setBuscaInsumoAberta(false);
    setLinhaBuscaAtiva(null);
  };

  const saveRdo = async () => {
    if (!notaId || !projetoAtual?.id || !usuarioId) {
      alert("Dados insuficientes para salvar o RDO.");
      return;
    }
    setLoading(true);
    try {
      let fotosUrls = [];
      if (data.fotos.length > 0) {
        const uploads = data.fotos.map(async (foto, i) => {
          if (typeof foto === "string") return foto;
          const ext = (foto.name?.split(".").pop() || "jpg").toLowerCase();
          const name = `rdo-${notaId}-${Date.now()}-${i}.${ext}`;
          const path = `rdo-fotos/${notaId}/${name}`;
          const { error } = await supabase.storage.from("rdo-fotos").upload(path, foto);
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from("rdo-fotos").getPublicUrl(path);
          return publicUrl;
        });
        fotosUrls = await Promise.all(uploads);
      }

      const atividades = {};
      pavimentosAtividades.forEach(item => {
        if (item.descricao.trim()) atividades[item.pavimento] = item.descricao.trim();
      });

      const payload = {
        nota_id: notaId,
        project_id: projetoAtual.id,
        data_rdo: dataOriginal || null,
        dia_semana: diaSemanaOriginal || "",
        projeto_nome: projetoNome || "",
        engenheiro_nome: engenheiroNome || "",
        inicio_obra: data.inicio_obra || null,
        termino_obra: data.termino_obra || null,
        atraso_dias: data.atraso_dias || "",
        clima_manha: data.clima_manha || "",
        clima_tarde: data.clima_tarde || "",
        obra_op_manha: data.obra_op_manha || "",
        obra_op_tarde: data.obra_op_tarde || "",
        efetivo_proprio: data.efetivo_proprio || [],
        efetivo_terceirizado: data.efetivo_terceirizado || [],
        equipamentos: data.equipamentos || [],
        atividades,
        intercorrencias: data.intercorrencias || "",
        responsavel_preenchimento: data.responsavel_preenchimento || "",
        fotos: fotosUrls,
        created_by: usuarioId,
      };

      if (rdoId) {
        const { error } = await supabase.from("rdos").update(payload).eq("id", rdoId);
        if (error) throw error;
      } else {
        const { data: res } = await supabase.from("rdos").insert([payload]).select();
        if (res?.[0]?.id) setRdoId(res[0].id);
      }

      alert("Diário de Obra salvo com sucesso!");
      onClose();
    } catch (error) {
      console.error("Erro ao salvar RDO:", error);
      alert(`Erro ao salvar: ${error.message}`);
    } finally {
      setLoading(false);
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
            <button className="listagem-close-btn" onClick={onClose} aria-label="Fechar">
              <FaTimes />
            </button>
          )}
        </div>
      </div>

      <div className="rdo-content">
        {/* Engenheiro e responsável */}
        <div className="rdo-section">
          <div className="rdo-row">
            <div className="rdo-col">
              <label>Engenheiro Responsável</label>
              <input type="text" value={engenheiroNome} readOnly className="rdo-input-readonly" />
            </div>
            <div className="rdo-col">
              <label>Responsável pelo Preenchimento</label>
              <div className="relative-input-wrapper">
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
                    {sugestoesMembros.map(membro => (
                      <div
                        key={membro.id}
                        onClick={() => inserirResponsavel(membro)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="suggestion-item"
                      >
                        <div className="suggestion-avatar-placeholder">
                          {(membro.name || membro.nickname)?.charAt(0).toUpperCase() || "?"}
                        </div>
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
              <input type="date" value={data.inicio_obra || ""} onChange={(e) => updateField("inicio_obra", e.target.value)} />
            </div>
            <div className="rdo-col">
              <label>Término Previsto</label>
              <input type="date" value={data.termino_obra || ""} onChange={(e) => updateField("termino_obra", e.target.value)} />
            </div>
            <div className="rdo-col">
              <label>Atraso (dias)</label>
              <input type="text" value={data.atraso_dias || ""} onChange={(e) => updateField("atraso_dias", e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        {/* Clima */}
        <div className="rdo-section">
          <h3><FontAwesomeIcon icon={faCloudSun} /> Clima</h3>
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
                    aria-label="Sim"
                  >
                    Sim
                  </div>
                  <div
                    className={`rdo-op-text ${data.obra_op_manha === "nao" ? "selected" : ""}`}
                    onClick={() => updateField("obra_op_manha", "nao")}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === "Enter" && updateField("obra_op_manha", "nao")}
                    aria-label="Não"
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
                    aria-label="Sim"
                  >
                    Sim
                  </div>
                  <div
                    className={`rdo-op-text ${data.obra_op_tarde === "nao" ? "selected" : ""}`}
                    onClick={() => updateField("obra_op_tarde", "nao")}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === "Enter" && updateField("obra_op_tarde", "nao")}
                    aria-label="Não"
                  >
                    Não
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Atividades Executadas */}
        <div className="rdo-section">
          <h3><FontAwesomeIcon icon={faPersonDigging} /> Atividades Executadas</h3>
          {pavimentosAtividades.length === 0 ? (
            <p>Nenhum pavimento cadastrado no projeto.</p>
          ) : (
            pavimentosAtividades.map((item, idx) => (
              <div key={idx} className="rdo-pavimento-linha">
                <div className="rdo-pavimento-nome">{item.pavimento}</div>
                <div className="rdo-pavimento-descricao">
                  <textarea
                    value={item.descricao}
                    onChange={(e) => updatePavimentoDescricao(item.pavimento, e.target.value)}
                    placeholder={`Descreva os serviços realizados no ${item.pavimento}...`}
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

        {/* Efetivos */}
        <div className="rdo-section rdo-efetivos-container">
          <div className="rdo-efetivo-col">
            <div className="rdo-section-header">
              <h3><FontAwesomeIcon icon={faUserGroup} /> Efetivo Próprio</h3>
              <div className="rdo-add-button-group">
                <DataTransferIcon onClick={() => copiarDoUltimoRdo("efetivo_proprio")} />
                <button type="button" onClick={() => addRow("efetivo_proprio")}>+</button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Função</th>
                  <th>Total</th>
                  <th>Presentes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.efetivo_proprio.map((item, idx) => (
                  <tr key={idx}>
                    <td><input type="text" value={item.funcao || ""} onChange={(e) => updateArrayField("efetivo_proprio", idx, "funcao", e.target.value)} /></td>
                    <td><input type="number" value={item.total || ""} onChange={(e) => updateArrayField("efetivo_proprio", idx, "total", e.target.value)} placeholder="0" /></td>
                    <td><input type="number" value={item.presentes || ""} onChange={(e) => updateArrayField("efetivo_proprio", idx, "presentes", e.target.value)} placeholder="0" /></td>
                    <td>
                      <button type="button" className="rdo-pavimento-remover" onClick={() => removeRow("efetivo_proprio", idx)} aria-label={`Remover linha ${idx + 1}`}>
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rdo-efetivo-col">
            <div className="rdo-section-header">
              <h3><FontAwesomeIcon icon={faUserGroup} /> Efetivo Terceirizado</h3>
              <div className="rdo-add-button-group">
                <DataTransferIcon onClick={() => copiarDoUltimoRdo("efetivo_terceirizado")} />
                <button type="button" onClick={() => addRow("efetivo_terceirizado")}>+</button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Total</th>
                  <th>Presentes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.efetivo_terceirizado.map((item, idx) => (
                  <tr key={idx}>
                    <td><input type="text" value={item.funcao || ""} onChange={(e) => updateArrayField("efetivo_terceirizado", idx, "funcao", e.target.value)} /></td>
                    <td><input type="number" value={item.total || ""} onChange={(e) => updateArrayField("efetivo_terceirizado", idx, "total", e.target.value)} placeholder="0" /></td>
                    <td><input type="number" value={item.presentes || ""} onChange={(e) => updateArrayField("efetivo_terceirizado", idx, "presentes", e.target.value)} placeholder="0" /></td>
                    <td>
                      <button type="button" className="rdo-pavimento-remover" onClick={() => removeRow("efetivo_terceirizado", idx)} aria-label={`Remover linha ${idx + 1}`}>
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Equipamentos */}
        <div className="rdo-section">
          <div className="rdo-section-header">
            <h3><FontAwesomeIcon icon={faGear} /> Equipamentos</h3>
            <div className="rdo-add-button-group">
              <DataTransferIcon onClick={() => copiarDoUltimoRdo("equipamentos")} />
              <button type="button" onClick={() => addRow("equipamentos")}>+</button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Total</th>
                <th>Em Uso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.equipamentos.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="codigo-com-lupa">
                      <input
                        type="text"
                        value={item.codigo || ""}
                        onChange={(e) => updateArrayField("equipamentos", idx, "codigo", e.target.value)}
                        onBlur={() => buscarItemPorCodigo(idx, item.codigo)}
                        onKeyPress={(e) => e.key === "Enter" && buscarItemPorCodigo(idx, item.codigo)}
                        placeholder="Cód."
                      />
                      <button
                        type="button"
                        className="lupa-busca-btn"
                        onClick={() => abrirBuscaInsumo(idx)}
                        title="Buscar insumo"
                      >
                        <FaMagnifyingGlass />
                      </button>
                    </div>
                  </td>
                  <td>
                    <input type="text" value={item.descricao || ""} readOnly className="rdo-input-readonly" placeholder="Descrição" />
                  </td>
                  <td>
                    <input type="number" value={item.total || ""} onChange={(e) => updateArrayField("equipamentos", idx, "total", e.target.value)} placeholder="0" />
                  </td>
                  <td>
                    <input type="number" value={item.em_uso || ""} onChange={(e) => updateArrayField("equipamentos", idx, "em_uso", e.target.value)} placeholder="0" />
                  </td>
                  <td>
                    <button type="button" className="rdo-pavimento-remover" onClick={() => removeRow("equipamentos", idx)} aria-label={`Remover linha ${idx + 1}`}>
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Intercorrências */}
        <div className="rdo-section">
          <h3><FontAwesomeIcon icon={faTriangleExclamation} /> Intercorrências</h3>
          <textarea
            value={data.intercorrencias || ""}
            onChange={(e) => updateField("intercorrencias", e.target.value)}
            placeholder="Descreva imprevistos, paralisações, não conformidades, etc."
          />
        </div>

        {/* Fotos */}
        <div className="rdo-section">
          <h3><FontAwesomeIcon icon={faCamera} /> Fotos</h3>
          {data.fotos.length > 0 && (
            <div className="rdo-fotos-preview">
              {data.fotos.map((foto, idx) => (
                <div
                  key={idx}
                  className="rdo-foto-item"
                  onClick={() => {
                    setFotoEmExibicao(idx);
                    document.body.classList.add("no-scroll");
                  }}
                >
                  <img
                    src={typeof foto === "string" ? foto : URL.createObjectURL(foto)}
                    alt={`Foto ${idx + 1}`}
                    className="rdo-foto-thumb"
                  />
                  <button
                    type="button"
                    className="rdo-foto-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      setData(prev => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== idx) }));
                    }}
                    aria-label="Remover foto"
                  >
                    <FaTrash size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {data.fotos.length < 4 && (
            <div className="rdo-fotos-actions">
              <label className="rdo-btn rdo-btn-primary">
                📁 Escolher da galeria
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="rdo-file-input"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const espaco = 4 - data.fotos.length;
                    if (files.length > espaco) {
                      alert(`Você só pode adicionar até ${espaco} foto(s).`);
                      return;
                    }
                    setData(prev => ({ ...prev, fotos: [...prev.fotos, ...files] }));
                  }}
                />
              </label>
              <button
                type="button"
                className="rdo-btn rdo-btn-success"
                onClick={async () => {
                  if (data.fotos.length >= 4) {
                    alert("Limite de 4 fotos atingido.");
                    return;
                  }
                  if (!navigator.mediaDevices?.getUserMedia) {
                    alert("Câmera não suportada.");
                    return;
                  }
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    const video = document.createElement("video");
                    video.srcObject = stream;
                    video.play();
                    await new Promise(resolve => video.onloadedmetadata = resolve);
                    const canvas = document.createElement("canvas");
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(blob => {
                      if (blob) {
                        blob.name = `camera-${Date.now()}.jpg`;
                        setData(prev => ({ ...prev, fotos: [...prev.fotos, blob] }));
                      }
                      stream.getTracks().forEach(t => t.stop());
                    }, "image/jpeg", 0.9);
                  } catch (err) {
                    alert("Erro ao acessar câmera.");
                  }
                }}
              >
                📷 Tirar foto
              </button>
            </div>
          )}
        </div>

        {/* Ações com botões de exportação à esquerda */}
        <div className="rdo-actions">
          <div className="rdo-export-buttons">
            <button
              type="button"
              className="rdo-export-btn rdo-print-btn"
              onClick={() => window.print()}
              title="Imprimir RDO"
            >
              <FontAwesomeIcon icon={faPrint} />
              <span>Impressão</span>
            </button>
            <button
              type="button"
              className="rdo-export-btn rdo-pdf-btn"
              onClick={() => {
                alert("Funcionalidade de exportação para PDF ainda em desenvolvimento.");
              }}
              title="Exportar para PDF"
            >
              <FontAwesomeIcon icon={faFilePdf} />
              <span>PDF</span>
            </button>
          </div>

          <div className="rdo-main-actions">
            <button className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button className="btn-save" onClick={saveRdo} disabled={loading}>
              {loading ? "Salvando..." : "Salvar RDO"}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox de fotos */}
      {fotoEmExibicao !== null && (
        <div
          className="rdo-lightbox"
          onClick={() => {
            setFotoEmExibicao(null);
            document.body.classList.remove("no-scroll");
          }}
        >
          <div className="rdo-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={typeof data.fotos[fotoEmExibicao] === "string"
                ? data.fotos[fotoEmExibicao]
                : URL.createObjectURL(data.fotos[fotoEmExibicao])
              }
              alt={`Foto ${fotoEmExibicao + 1}`}
              className="rdo-lightbox-img"
            />
            {data.fotos.length > 1 && (
              <>
                <button
                  className="rdo-lightbox-nav rdo-lightbox-prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFotoEmExibicao(prev => prev === 0 ? data.fotos.length - 1 : prev - 1);
                  }}
                >
                  ❮
                </button>
                <button
                  className="rdo-lightbox-nav rdo-lightbox-next"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFotoEmExibicao(prev => prev === data.fotos.length - 1 ? 0 : prev + 1);
                  }}
                >
                  ❯
                </button>
              </>
            )}
            <div className="rdo-lightbox-counter">
              {fotoEmExibicao + 1} / {data.fotos.length}
            </div>
          </div>
        </div>
      )}

      {/* Modal de busca de insumos */}
      <BuscaInsumo
        isOpen={buscaInsumoAberta}
        onClose={() => {
          setBuscaInsumoAberta(false);
          setLinhaBuscaAtiva(null);
        }}
        onSelect={handleSelecionarInsumo}
      />
    </div>
  );
};

export default Rdo;