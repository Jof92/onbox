import React, { useState, useEffect } from "react";
import "./AtaCard.css";

const verbosInfinitivo = [
  "verificar","acompanhar","implementar","analisar","finalizar",
  "revisar","enviar","agendar","checar"
];

export default function AtaCard() {
  const [pauta, setPauta] = useState("");
  const [data, setData] = useState("");
  const [local, setLocal] = useState("");
  const [presentes, setPresentes] = useState("");
  const [texto, setTexto] = useState("");
  const [objetivosList, setObjetivosList] = useState([]);
  const [objetivosConcluidos, setObjetivosConcluidos] = useState([]);
  const [proxima, setProxima] = useState("");

  // Inicializa data
  useEffect(() => {
    const hoje = new Date();
    const dataStr = hoje.toLocaleDateString();
    setData(dataStr);
  }, []);

  // Extrai objetivos resumidos
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

  // Atualiza objetivos ao digitar texto
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

  const progresso = objetivosList.length ? (objetivosConcluidos.length / objetivosList.length) * 100 : 0;

  return (
    <div className="ata-card">
      <div className="ata-header">
        <h2>ATA DE REUNIÃO</h2>
        <span>{data}</span>
      </div>

      <div className="ata-body">
        <div className="ata-section">
          <label>Pauta:</label>
          <input type="text" value={pauta} onChange={e => setPauta(e.target.value)} placeholder="Digite a pauta da reunião" />
        </div>

        <div className="ata-section">
          <label>Data:</label>
          <input type="text" value={data} readOnly />
        </div>

        <div className="ata-section">
          <label>Local:</label>
          <input type="text" value={local} onChange={e => setLocal(e.target.value)} placeholder="Digite o local" />
        </div>

        <div className="ata-section">
          <label>Presentes:</label>
          <input type="text" value={presentes} onChange={e => setPresentes(e.target.value)} placeholder="Digite os participantes" />
        </div>

        <div className="ata-section">
          <label>Texto da Ata:</label>
          <textarea
            value={texto}
            onChange={e => { setTexto(e.target.value); atualizarObjetivos(e.target.value); }}
            rows={6}
            placeholder="Digite o texto da ata. Verbos no infinitivo serão detectados como objetivos."
          />
        </div>

        <div className="ata-section">
          <label>Objetivos:</label>
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
            <div className="progress-bar" style={{ width: `${progresso}%` }}></div>
          </div>
        </div>

        <div className="ata-section">
          <label>Próxima Reunião:</label>
          <input type="text" value={proxima} onChange={e => setProxima(e.target.value)} placeholder="Data ou observações" />
        </div>
      </div>
    </div>
  );
}
