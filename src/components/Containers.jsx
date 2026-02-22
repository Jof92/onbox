import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalculator, faXmark, faArrowRight, faChevronDown, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import Loading from "./Loading";
import ThinSidebar from "../components/ThinSidebar";
import Sidebar from "../components/Sidebar";
import ProjectManager from "./ProjectManager";
import "./Containers.css";

const INCC_API_URL = "https://incc-api.onrender.com";

const MESES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

function parseMesAno(mesAno) {
  const [mes, ano] = mesAno.split("/");
  const idx = MESES_PT.findIndex((m) => m.toLowerCase() === mes.toLowerCase());
  return new Date(parseInt(ano), idx, 1);
}

// ─────────────────────────────────────────────
// BADGE + DROPDOWN HISTÓRICO
// ─────────────────────────────────────────────
function INCCBadge({ incc, historico }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const invertido = [...historico].reverse();

  return (
    <div className="incc-badge-wrapper" ref={ref}>
      <div
        className={`incc-badge ${open ? "incc-badge--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Clique para ver o histórico completo"
      >
        {!incc ? (
          <>
            <span className="incc-badge__label">INCC-DI</span>
            <span className="incc-badge__value">Carregando...</span>
          </>
        ) : (
          <>
            <span className="incc-badge__label">INCC-DI · {incc.mes}</span>
            <div className="incc-badge__values">
              <span className="incc-badge__value">
                {incc.indice.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}
                <span className="incc-badge__sub-label"> índice</span>
              </span>
              <span className="incc-badge__separator">|</span>
              <span className="incc-badge__value">
                {incc.variacao.no_mes > 0 ? "+" : ""}
                {incc.variacao.no_mes.toFixed(2)}%
                <span className="incc-badge__sub-label"> no mês</span>
              </span>
              <span className="incc-badge__separator">|</span>
              <span className="incc-badge__value">
                {incc.variacao.doze_meses.toFixed(2)}%
                <span className="incc-badge__sub-label"> 12m</span>
              </span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`incc-badge__chevron ${open ? "incc-badge__chevron--open" : ""}`}
              />
            </div>
          </>
        )}
      </div>

      {open && historico.length > 0 && (
        <div className="incc-dropdown">
          <div className="incc-dropdown__header">
            <span>Histórico INCC-DI (FGV)</span>
            <span className="incc-dropdown__total">{historico.length} registros</span>
          </div>
          <div className="incc-dropdown__table-wrap">
            <table className="incc-dropdown__table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Índice</th>
                  <th>No mês (%)</th>
                  <th>No ano (%)</th>
                  <th>12 meses (%)</th>
                </tr>
              </thead>
              <tbody>
                {invertido.map((row) => (
                  <tr key={row.mes}>
                    <td>{row.mes}</td>
                    <td>{row.indice?.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</td>
                    <td className={row.variacao?.no_mes > 0 ? "incc-pos" : "incc-neg"}>
                      {row.variacao?.no_mes != null
                        ? `${row.variacao.no_mes > 0 ? "+" : ""}${row.variacao.no_mes.toFixed(2)}`
                        : "—"}
                    </td>
                    <td>{row.variacao?.no_ano != null ? row.variacao.no_ano.toFixed(2) : "—"}</td>
                    <td>{row.variacao?.doze_meses != null ? row.variacao.doze_meses.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="incc-dropdown__fonte">Fonte: FGV / Sinduscon-PR</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// JANELA FLUTUANTE ARRASTÁVEL — Calculadora INCC
// ─────────────────────────────────────────────
function CalculadoraWindow({ historico, onClose }) {
  const [pos, setPos] = useState({
    x: Math.max(0, window.innerWidth / 2 - 220),
    y: Math.max(0, window.innerHeight / 2 - 260),
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);

  const [valor, setValor] = useState("");
  const [mesInicio, setMesInicio] = useState("");
  const [mesFim, setMesFim] = useState("");
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");

  const onMouseDown = useCallback((e) => {
    if (e.target.closest(".calc-window__close")) return;
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const opcoesMeses = historico.map((r) => r.mes);

  function calcular() {
    setErro("");
    setResultado(null);
    const valorNum = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    if (!valorNum || isNaN(valorNum)) return setErro("Informe um valor válido.");
    if (!mesInicio) return setErro("Selecione o mês de início.");
    if (!mesFim) return setErro("Selecione o mês de fim.");
    const dataInicio = parseMesAno(mesInicio);
    const dataFim = parseMesAno(mesFim);
    if (dataInicio >= dataFim) return setErro("O mês de início deve ser anterior ao mês de fim.");
    const rowInicio = historico.find((r) => r.mes === mesInicio);
    const rowFim = historico.find((r) => r.mes === mesFim);
    if (!rowInicio?.indice || !rowFim?.indice)
      return setErro("Índice não disponível para o período selecionado.");
    const fator = rowFim.indice / rowInicio.indice;
    const valorCorrigido = valorNum * fator;
    const variacao = (fator - 1) * 100;
    setResultado({ valorCorrigido, fator, variacao, indiceInicio: rowInicio.indice, indiceFim: rowFim.indice });
  }

  return (
    <div
      className="calc-window"
      style={{ left: pos.x, top: pos.y, cursor: dragging ? "grabbing" : "default" }}
    >
      {/* Barra de título — área de arrasto */}
      <div
        className="calc-window__titlebar"
        onMouseDown={onMouseDown}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <div className="calc-window__title">
          <FontAwesomeIcon icon={faGripVertical} className="calc-window__grip" />
          Calculadora INCC
        </div>
        <button className="calc-window__close" onClick={onClose} title="Fechar">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      {/* Corpo da calculadora */}
      <div className="calc-window__body">
        <div className="incc-calc__field">
          <label>Valor original (R$)</label>
          <input
            type="text"
            placeholder="Ex: 350.000,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="incc-calc__input"
            onKeyDown={(e) => e.key === "Enter" && calcular()}
          />
        </div>

        <div className="incc-calc__row">
          <div className="incc-calc__field">
            <label>Mês de início</label>
            <select value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} className="incc-calc__input">
              <option value="">Selecione...</option>
              {opcoesMeses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <FontAwesomeIcon icon={faArrowRight} className="incc-calc__arrow" />
          <div className="incc-calc__field">
            <label>Mês de fim</label>
            <select value={mesFim} onChange={(e) => setMesFim(e.target.value)} className="incc-calc__input">
              <option value="">Selecione...</option>
              {[...opcoesMeses].reverse().map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {erro && <p className="incc-calc__erro">{erro}</p>}

        <button className="incc-calc__btn" onClick={calcular}>
          Calcular correção
        </button>

        {resultado && (
          <div className="incc-calc__resultado">
            <div className="incc-calc__resultado-row">
              <span>Índice início ({mesInicio})</span>
              <strong>{resultado.indiceInicio.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</strong>
            </div>
            <div className="incc-calc__resultado-row">
              <span>Índice fim ({mesFim})</span>
              <strong>{resultado.indiceFim.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</strong>
            </div>
            <div className="incc-calc__resultado-row">
              <span>Fator de correção</span>
              <strong>{resultado.fator.toFixed(6)}</strong>
            </div>
            <div className="incc-calc__resultado-row">
              <span>Variação no período</span>
              <strong className={resultado.variacao >= 0 ? "incc-calc__pos" : "incc-calc__neg"}>
                {resultado.variacao > 0 ? "+" : ""}{resultado.variacao.toFixed(4)}%
              </strong>
            </div>
            <div className="incc-calc__resultado-destaque">
              <span>Valor corrigido</span>
              <strong>
                {resultado.valorCorrigido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </div>
          </div>
        )}

        <p className="incc-calc__fonte">Fonte: FGV / Sinduscon-PR</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CONTAINERS — página principal
// ─────────────────────────────────────────────
export default function Containers({ containerIdDaUrl }) {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [containerAtual, setContainerAtual] = useState(null);
  const [nomeContainer, setNomeContainer] = useState("");
  const [loading, setLoading] = useState(true);

  const [inccUltimo, setInccUltimo] = useState(null);
  const [inccHistorico, setInccHistorico] = useState([]);
  const [showCalculadora, setShowCalculadora] = useState(false);

  const [sidebarProps, setSidebarProps] = useState({
    projects: [],
    selectedProject: null,
    onCreateProject: () => {},
    onProjectSelect: () => {},
    onDeleteProject: () => {},
    onOpenSetoresManager: () => {},
    currentUserId: null,
    containerOwnerId: null,
    gerenteContainerId: null,
    currentContainerId: null,
  });

  useEffect(() => {
    fetch(`${INCC_API_URL}/incc`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setInccUltimo(json.data.ultimo);
          setInccHistorico(json.data.historico);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) setUser(data.user);
      else navigate("/login", { replace: true });
      setLoading(false);
    };
    loadUser();
  }, [navigate]);

  useEffect(() => {
    const idParaUsar = containerIdDaUrl || localStorage.getItem("containerAtual") || user?.id;
    setContainerAtual(idParaUsar);
  }, [user, containerIdDaUrl]);

  useEffect(() => {
    const fetchNomeDono = async () => {
      if (!containerAtual) { setNomeContainer(""); return; }
      try {
        const { data, error } = await supabase.from("profiles").select("nome").eq("id", containerAtual);
        if (error) setNomeContainer("Erro");
        else if (!data || data.length === 0) setNomeContainer("Desconhecido");
        else setNomeContainer(data[0].nome || "Sem nome");
      } catch { setNomeContainer("Erro"); }
    };
    fetchNomeDono();
  }, [containerAtual]);

  useEffect(() => {
    if (containerAtual) {
      localStorage.setItem("containerAtual", containerAtual);
      setSidebarProps((prev) => ({ ...prev, currentContainerId: containerAtual }));
    }
  }, [containerAtual]);

  if (loading) return <Loading />;

  return (
    <div className="containers-page">
      <div className="containers-content">
        <ThinSidebar containerAtual={containerAtual} setContainerAtual={setContainerAtual} user={user} />
        <Sidebar {...sidebarProps} currentContainerId={containerAtual} />

        <div className="containers-main-with-title">
          <div className="title-bar">
            <h1 className="tittle-cont">
              Container {nomeContainer ? `- ${nomeContainer}` : ""}
            </h1>

            <div className="incc-toolbar">
              <button
                className={`incc-calc-btn ${showCalculadora ? "incc-calc-btn--active" : ""}`}
                onClick={() => setShowCalculadora((v) => !v)}
                title="Calculadora de correção pelo INCC"
              >
                <FontAwesomeIcon icon={faCalculator} />
              </button>

              <INCCBadge incc={inccUltimo} historico={inccHistorico} />
            </div>
          </div>

          <ProjectManager containerAtual={containerAtual} user={user} onSidebarUpdate={setSidebarProps} />
        </div>
      </div>

      {/* Janela flutuante — renderizada sobre tudo, fora do layout normal */}
      {showCalculadora && inccHistorico.length > 0 && (
        <CalculadoraWindow historico={inccHistorico} onClose={() => setShowCalculadora(false)} />
      )}
    </div>
  );
}