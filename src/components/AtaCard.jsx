import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./AtaCard.css";

const verbosInfinitivo = ["verificar", "acompanhar", "implementar", "analisar", "finalizar", "revisar", "enviar", "agendar", "checar"];

export default function AtaCard({ projetoAtual, pilhaAtual, notaAtual, ultimaAlteracao }) {
  const [projetoNome, setProjetoNome] = useState("");
  const [dataLocal, setDataLocal] = useState("");
  const [pauta, setPauta] = useState("");
  const [local, setLocal] = useState("");
  const [texto, setTexto] = useState("");
  const [proxima, setProxima] = useState("");
  const [criarObjetivos, setCriarObjetivos] = useState(false);
  const [objetivosList, setObjetivosList] = useState([]);
  const [objetivosConcluidos, setObjetivosConcluidos] = useState([]);
  const [editingPauta, setEditingPauta] = useState(false);
  const [editingLocal, setEditingLocal] = useState(false);
  const [participanteInput, setParticipanteInput] = useState("");
  const [participantes, setParticipantes] = useState([]);
  const [sugestoes, setSugestoes] = useState([]);
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState({});

  const pautaRef = useRef();
  const localRef = useRef();

  // Busca nome do projeto
  useEffect(() => {
    if (!projetoAtual) return;
    supabase
      .from("projects")
      .select("name")
      .eq("id", projetoAtual.id || projetoAtual)
      .single()
      .then(({ data, error }) => setProjetoNome(error ? "Projeto não encontrado" : data?.name || "Projeto sem nome"))
      .catch(() => setProjetoNome("Projeto não encontrado"));
  }, [projetoAtual]);

  // Local e data
  useEffect(() => {
    const hoje = new Date();
    const formatarData = (cidade) => {
      const dataFormatada = hoje.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
      return cidade ? `${cidade}, ${dataFormatada}` : dataFormatada;
    };
    const obterLocalizacao = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        setDataLocal(formatarData(data.city));
      } catch {
        try {
          const res2 = await fetch("https://ipwho.is/");
          const data2 = await res2.json();
          setDataLocal(formatarData(data2.city));
        } catch {
          setDataLocal(formatarData());
        }
      }
    };
    obterLocalizacao();
  }, []);

  // Extrair objetivos
  const extrairObjetivos = (txt) => {
    if (!criarObjetivos) return [];
    const linhas = txt.split(/\n|\.|;/).map(l => l.trim()).filter(Boolean);
    const objs = [];
    linhas.forEach(linha => {
      let restante = linha, matchFound = true;
      while (matchFound) {
        matchFound = false;
        for (const verbo of verbosInfinitivo) {
          const match = new RegExp(`\\b${verbo}\\b`, "i").exec(restante);
          if (match) {
            matchFound = true;
            let objetivo = restante.slice(match.index).split(",")[0].trim();
            if (objetivo && !objs.some(o => o.texto === objetivo)) objs.push({ texto: objetivo, responsavel: "", dataEntrega: "" });
            restante = restante.slice(match.index + objetivo.length);
            break;
          }
        }
      }
    });
    return objs;
  };

  const atualizarObjetivos = (txt) => { if (criarObjetivos) { setObjetivosList(extrairObjetivos(txt)); setObjetivosConcluidos([]); } };
  const toggleObjetivo = (idx) => setObjetivosConcluidos(prev => prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]);

  // Participantes
  const buscarSugestoes = async (query, campo) => {
    if (!query.startsWith("@") || query.length < 2) return campo === "participante" ? setSugestoes([]) : setSugestoesResponsavel(prev => ({ ...prev, [campo]: [] }));
    const termo = query.slice(1);
    try {
      const { data } = await supabase.from("profiles").select("id, nome, funcao").ilike("nome", `%${termo}%`).limit(10);
      campo === "participante" ? setSugestoes(data || []) : setSugestoesResponsavel(prev => ({ ...prev, [campo]: data || [] }));
    } catch { campo === "participante" ? setSugestoes([]) : setSugestoesResponsavel(prev => ({ ...prev, [campo]: [] })); }
  };
  const handleParticipanteChange = (e) => { setParticipanteInput(e.target.value); buscarSugestoes(e.target.value, "participante"); };
  const selecionarSugestao = (item) => { if (!participantes.some(p => p.id === item.id)) setParticipantes([...participantes, item]); setParticipanteInput(""); setSugestoes([]); };
  const removerParticipante = (id) => setParticipantes(participantes.filter(p => p.id !== id));
  const handleResponsavelChange = (e, idx) => { const val = e.target.value; const novos = [...objetivosList]; novos[idx].responsavel = val; setObjetivosList(novos); buscarSugestoes(val, idx); };
  const selecionarResponsavel = (item, idx) => { const novos = [...objetivosList]; novos[idx].responsavel = item.nome; setObjetivosList(novos); setSugestoesResponsavel(prev => ({ ...prev, [idx]: [] })); };
  const handleBlur = (campo) => { if (campo === "pauta") setEditingPauta(false); if (campo === "local") setEditingLocal(false); };

  return (
    <div className="ata-card">
      <div className="listagem-card">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{projetoNome}</span>
            <div className="sub-info">
              <span className="pilha-name">{pilhaAtual?.nome || pilhaAtual || "Sem pilha"}</span> - <span className="nota-name">{notaAtual?.nome || notaAtual || "Sem nota"}</span>
            </div>
          </div>
          <div className="alteracao-info">{dataLocal || ultimaAlteracao}</div>
        </div>
      </div>

      <div className="ata-body">
        {/* PAUTA */}
        <div className="ata-section">
          {editingPauta ? <input ref={pautaRef} className="pauta-input" type="text" value={pauta} onChange={e => setPauta(e.target.value)} onBlur={() => handleBlur("pauta")} onKeyDown={e => e.key === "Enter" && setEditingPauta(false)} autoFocus /> :
            <span className="pauta-text" onDoubleClick={() => setEditingPauta(true)}>{pauta || "Digite a pauta da reunião"}</span>}
        </div>

        {/* LOCAL */}
        <div className="ata-section">
          {editingLocal ? <input ref={localRef} className="local-input" type="text" value={local} onChange={e => setLocal(e.target.value)} onBlur={() => handleBlur("local")} onKeyDown={e => e.key === "Enter" && setEditingLocal(false)} autoFocus /> :
            <span className="local-text" onDoubleClick={() => setEditingLocal(true)}>{local || "Digite o local"}</span>}
        </div>

        {/* PARTICIPANTES */}
        <div className="ata-section">
          <input type="text" value={participanteInput} onChange={handleParticipanteChange} placeholder="Digite @Nome e selecione" className="participante-input" />
          {sugestoes.length > 0 && <div className="sugestoes-list">{sugestoes.map(item => <div key={item.id} className="sugestao-item" onClick={() => selecionarSugestao(item)}><span>@{item.nome}</span><span className="sugestao-funcao">{item.funcao}</span></div>)}</div>}
          <div className="participantes-list">{participantes.map(p => <div key={p.id} className="participante-item"><span>{p.nome} ({p.funcao})</span><span className="remover-participante" onClick={() => removerParticipante(p.id)}>×</span></div>)}</div>
        </div>

        {/* TEXTO DA ATA */}
        <div className="ata-section">
          <textarea value={texto} onChange={e => { setTexto(e.target.value); atualizarObjetivos(e.target.value); }} rows={6} placeholder="Digite o texto da ata..." />
          <label className="checkbox-objetivos">
            <input type="checkbox" checked={criarObjetivos} onChange={() => { setCriarObjetivos(!criarObjetivos); if (!criarObjetivos) atualizarObjetivos(texto); }} />
            Criar objetivos a partir da ata?
          </label>
        </div>

        {/* OBJETIVOS E PROGRESSO */}
        {criarObjetivos && (
          <div className="ata-section">
            <div className="ata-objectives">
              {objetivosList.map((obj, i) => (
                <div key={i} className="objetivo-item">
                  <input type="checkbox" checked={objetivosConcluidos.includes(i)} onChange={() => toggleObjetivo(i)} />
                  <span>{obj.texto}</span>
                  <div style={{ position: "relative" }}>
                    <input type="text" placeholder="@Responsável" value={obj.responsavel} onChange={e => handleResponsavelChange(e, i)} />
                    {sugestoesResponsavel[i]?.length > 0 && <div className="sugestoes-list" style={{ position: "absolute", zIndex: 10 }}>{sugestoesResponsavel[i].map(item => <div key={item.id} className="sugestao-item" onClick={() => selecionarResponsavel(item, i)}><span>@{item.nome}</span><span className="sugestao-funcao">{item.funcao}</span></div>)}</div>}
                  </div>
                  <input type="date" value={obj.dataEntrega} onChange={e => { const novos = [...objetivosList]; novos[i].dataEntrega = e.target.value; setObjetivosList(novos); }} />
                </div>
              ))}
            </div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: objetivosList.length ? `${(objetivosConcluidos.length / objetivosList.length) * 100}%` : "0%" }}></div>
            </div>
          </div>
        )}

        {/* PRÓXIMA REUNIÃO */}
        <div className="ata-section">
          <input type="text" value={proxima} onChange={e => setProxima(e.target.value)} placeholder="Próxima reunião: Data ou observações" />
        </div>
      </div>
    </div>
  );
}
