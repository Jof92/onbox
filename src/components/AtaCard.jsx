import React, { useState, useEffect, useRef } from "react";
import "./AtaCard.css";

const verbosInfinitivo = [
  "verificar","acompanhar","implementar","analisar","finalizar",
  "revisar","enviar","agendar","checar"
];

export default function AtaCard({ projetoAtual, pilhaAtual, notaAtual, ultimaAlteracao }) {
  const [pauta, setPauta] = useState("");
  const [local, setLocal] = useState("");
  const [texto, setTexto] = useState("");
  const [objetivosList, setObjetivosList] = useState([]);
  const [objetivosConcluidos, setObjetivosConcluidos] = useState([]);
  const [proxima, setProxima] = useState("");
  const [data, setData] = useState("");

  // Inline edit states
  const [editingPauta, setEditingPauta] = useState(false);
  const [editingLocal, setEditingLocal] = useState(false);

  // Participantes
  const [participanteInput, setParticipanteInput] = useState("");
  const [participantes, setParticipantes] = useState([]);

  // Refs para detectar blur
  const pautaRef = useRef();
  const localRef = useRef();

  useEffect(() => {
    const hoje = new Date();
    setData(hoje.toLocaleDateString());
  }, []);

  const extrairObjetivoResumido = (linha) => {
    for (const verbo of verbosInfinitivo) {
      const regex = new RegExp(`\\b${verbo}\\b`, "i");
      if (regex.test(linha)) {
        const palavras = linha.split(/\s+/);
        const idxVerbo = palavras.findIndex(w => w.match(regex));
        const objetivo = palavras.slice(idxVerbo, idxVerbo + 5).join(" ");
        return objetivo.charAt(0).toUpperCase() + objetivo.slice(1);
      }
    }
    return null;
  };

  const atualizarObjetivos = (value) => {
    const linhas = value.split(/\n|\.|;/).map(l => l.trim()).filter(l => l.length > 0);
    const objs = [];
    linhas.forEach(linha => {
      const obj = extrairObjetivoResumido(linha);
      if (obj && !objs.includes(obj)) objs.push(obj);
    });
    setObjetivosList(objs);
    setObjetivosConcluidos([]);
  };

  const toggleObjetivo = (idx) => {
    setObjetivosConcluidos(prev =>
      prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]
    );
  };

  // Participantes
  const handleParticipanteKeyDown = (e) => {
    if (e.key === "Enter" && participanteInput.startsWith("@")) {
      e.preventDefault();
      const nome = participanteInput.trim();
      if (!participantes.includes(nome)) {
        setParticipantes([...participantes, nome]);
      }
      setParticipanteInput("");
    }
  };

  const removerParticipante = (nome) => {
    setParticipantes(participantes.filter(p => p !== nome));
  };

  // Salvar inline edit ao sair do input
  const handleBlur = (campo) => {
    if (campo === "pauta") setEditingPauta(false);
    if (campo === "local") setEditingLocal(false);
  };

  return (
    <div className="ata-card">
      {/* HEADER idêntico ao Listagem */}
      <div className="listagem-card">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{projetoAtual?.nome || "Sem projeto"}</span>
            <div className="sub-info">
              <span className="pilha-name">{pilhaAtual?.nome || pilhaAtual || "Sem pilha"}</span>
              &nbsp;-&nbsp;
              <span className="nota-name">{notaAtual?.nome || notaAtual || "Sem nota"}</span>
            </div>
          </div>
          <div className="alteracao-info">{ultimaAlteracao || data}</div>
        </div>
      </div>

      <div className="ata-body">

        {/* Pauta */}
        <div className="ata-section">
          {editingPauta ? (
            <input
              ref={pautaRef}
              type="text"
              value={pauta}
              onChange={e => setPauta(e.target.value)}
              onBlur={() => handleBlur("pauta")}
              onKeyDown={e => { if(e.key === "Enter") setEditingPauta(false); }}
              autoFocus
            />
          ) : (
            <span
              onDoubleClick={() => setEditingPauta(true)}
              style={{ cursor: "pointer", padding: "8px", display: "inline-block", border: "1px solid #ccc", borderRadius: "6px" }}
            >
              {pauta || "Digite a pauta da reunião"}
            </span>
          )}
        </div>

        {/* Local */}
        <div className="ata-section">
          {editingLocal ? (
            <input
              ref={localRef}
              type="text"
              value={local}
              onChange={e => setLocal(e.target.value)}
              onBlur={() => handleBlur("local")}
              onKeyDown={e => { if(e.key === "Enter") setEditingLocal(false); }}
              autoFocus
            />
          ) : (
            <span
              onDoubleClick={() => setEditingLocal(true)}
              style={{ cursor: "pointer", padding: "8px", display: "inline-block", border: "1px solid #ccc", borderRadius: "6px" }}
            >
              {local || "Digite o local"}
            </span>
          )}
        </div>

        {/* Participantes */}
        <div className="ata-section">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {participantes.map((p, i) => (
              <div
                key={i}
                style={{
                  background: "#3b82f6",
                  color: "#fff",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "13px"
                }}
              >
                {p}
                <span
                  style={{ cursor: "pointer" }}
                  onClick={() => removerParticipante(p)}
                >
                  ×
                </span>
              </div>
            ))}
          </div>
          <input
            type="text"
            value={participanteInput}
            onChange={e => setParticipanteInput(e.target.value)}
            onKeyDown={handleParticipanteKeyDown}
            placeholder="Digite @Nome e pressione Enter"
            style={{ marginTop: "6px", width: "200px" }}
          />
        </div>

        {/* Texto da Ata */}
        <div className="ata-section">
          <textarea
            value={texto}
            onChange={e => { setTexto(e.target.value); atualizarObjetivos(e.target.value); }}
            rows={6}
            placeholder="Digite o texto da ata. Verbos no infinitivo serão detectados como objetivos."
          />
        </div>

        {/* Objetivos */}
        <div className="ata-section">
          <div className="ata-objectives">
            {objetivosList.map((obj, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={objetivosConcluidos.includes(i)}
                  onChange={() => toggleObjetivo(i)}
                />
                {obj}
              </label>
            ))}
          </div>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${(objetivosList.length ? (objetivosConcluidos.length / objetivosList.length) * 100 : 0)}%` }}></div>
          </div>
        </div>

        {/* Próxima reunião */}
        <div className="ata-section">
          <input
            type="text"
            value={proxima}
            onChange={e => setProxima(e.target.value)}
            placeholder="Próxima reunião: Data ou observações"
          />
        </div>

      </div>
    </div>
  );
}
