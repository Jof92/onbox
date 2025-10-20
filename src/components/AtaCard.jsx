import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./AtaCard.css";

const verbosInfinitivo = [
  "verificar", "acompanhar", "implementar", "analisar", "finalizar",
  "revisar", "enviar", "agendar", "checar"
];

export default function AtaCard({ projetoAtual, pilhaAtual, notaAtual, ultimaAlteracao }) {
  const [projetoNome, setProjetoNome] = useState("");
  const [dataLocal, setDataLocal] = useState("");

  const [pauta, setPauta] = useState("");
  const [local, setLocal] = useState("");
  const [texto, setTexto] = useState("");
  const [objetivosList, setObjetivosList] = useState([]);
  const [objetivosConcluidos, setObjetivosConcluidos] = useState([]);
  const [proxima, setProxima] = useState("");
  const [criarObjetivos, setCriarObjetivos] = useState(false);

  const [editingPauta, setEditingPauta] = useState(false);
  const [editingLocal, setEditingLocal] = useState(false);

  const [participanteInput, setParticipanteInput] = useState("");
  const [participantes, setParticipantes] = useState([]);
  const [sugestoes, setSugestoes] = useState([]);

  const pautaRef = useRef();
  const localRef = useRef();

  // ===== BUSCA NOME DO PROJETO =====
  useEffect(() => {
    const fetchProjetoNome = async () => {
      try {
        if (!projetoAtual) return;
        const { data, error } = await supabase
          .from("projects")
          .select("name")
          .eq("id", projetoAtual.id || projetoAtual)
          .single();
        if (error) throw error;
        setProjetoNome(data?.name || "Projeto sem nome");
      } catch (err) {
        console.error("Erro ao buscar nome do projeto:", err);
        setProjetoNome("Projeto não encontrado");
      }
    };
    fetchProjetoNome();
  }, [projetoAtual]);

  // ===== LOCAL E DATA =====
  useEffect(() => {
    const hoje = new Date();
    const formatarData = (cidade) => {
      const dataFormatada = hoje.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
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
          setDataLocal(
            hoje.toLocaleDateString("pt-BR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          );
        }
      }
    };

    obterLocalizacao();
  }, []);

  // ===== OBJETIVOS =====
  const extrairObjetivoResumido = (linha) => {
    for (const verbo of verbosInfinitivo) {
      const regex = new RegExp(`\\b${verbo}\\b`, "i");
      if (regex.test(linha)) {
        const palavras = linha.split(/\s+/);
        const idxVerbo = palavras.findIndex((w) => w.match(regex));
        const objetivo = palavras.slice(idxVerbo, idxVerbo + 5).join(" ");
        return objetivo.charAt(0).toUpperCase() + objetivo.slice(1);
      }
    }
    return null;
  };

  const atualizarObjetivos = (value) => {
    if (!criarObjetivos) return; // 🚫 Se não estiver ativado, não faz nada

    const linhas = value
      .split(/\n|\.|;/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const objs = [];
    linhas.forEach((linha) => {
      const obj = extrairObjetivoResumido(linha);
      if (obj && !objs.includes(obj)) objs.push(obj);
    });
    setObjetivosList(objs);
    setObjetivosConcluidos([]);
  };

  const toggleObjetivo = (idx) => {
    setObjetivosConcluidos((prev) =>
      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
    );
  };

  // ===== PARTICIPANTES =====
  const buscarSugestoes = async (query) => {
    if (!query.startsWith("@") || query.length < 2) {
      setSugestoes([]);
      return;
    }
    const termo = query.slice(1);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, funcao")
        .ilike("nome", `%${termo}%`)
        .limit(10);

      if (error) {
        console.error("Erro ao buscar participantes:", error.message);
        setSugestoes([]);
        return;
      }

      setSugestoes(data || []);
    } catch (err) {
      console.error("Erro inesperado ao buscar participantes:", err.message || err);
      setSugestoes([]);
    }
  };

  const handleParticipanteChange = (e) => {
    const val = e.target.value;
    setParticipanteInput(val);
    buscarSugestoes(val);
  };

  const selecionarSugestao = (item) => {
    if (!participantes.some((p) => p.id === item.id)) {
      setParticipantes([...participantes, item]);
    }
    setParticipanteInput("");
    setSugestoes([]);
  };

  const removerParticipante = (id) => {
    setParticipantes(participantes.filter((p) => p.id !== id));
  };

  const handleBlur = (campo) => {
    if (campo === "pauta") setEditingPauta(false);
    if (campo === "local") setEditingLocal(false);
  };

  return (
    <div className="ata-card">
      <div className="listagem-card">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{projetoNome}</span>
            <div className="sub-info">
              <span className="pilha-name">{pilhaAtual?.nome || pilhaAtual || "Sem pilha"}</span>
              &nbsp;-&nbsp;
              <span className="nota-name">{notaAtual?.nome || notaAtual || "Sem nota"}</span>
            </div>
          </div>
          <div className="alteracao-info">{dataLocal || ultimaAlteracao}</div>
        </div>
      </div>

      <div className="ata-body">
        {/* ===== PAUTA ===== */}
        <div className="ata-section">
          {editingPauta ? (
            <input
              ref={pautaRef}
              className="pauta-input"
              type="text"
              value={pauta}
              onChange={(e) => setPauta(e.target.value)}
              onBlur={() => handleBlur("pauta")}
              onKeyDown={(e) => e.key === "Enter" && setEditingPauta(false)}
              autoFocus
            />
          ) : (
            <span
              className="pauta-text"
              onDoubleClick={() => setEditingPauta(true)}
            >
              {pauta || "Digite a pauta da reunião"}
            </span>
          )}
        </div>

        {/* ===== LOCAL ===== */}
        <div className="ata-section">
          {editingLocal ? (
            <input
              ref={localRef}
              className="local-input"
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              onBlur={() => handleBlur("local")}
              onKeyDown={(e) => e.key === "Enter" && setEditingLocal(false)}
              autoFocus
            />
          ) : (
            <span
              className="local-text"
              onDoubleClick={() => setEditingLocal(true)}
            >
              {local || "Digite o local"}
            </span>
          )}
        </div>

        {/* ===== PARTICIPANTES ===== */}
        <div className="ata-section">
          <input
            type="text"
            value={participanteInput}
            onChange={handleParticipanteChange}
            placeholder="Digite @Nome e selecione"
            className="participante-input"
          />

          {sugestoes.length > 0 && (
            <div className="sugestoes-list">
              {sugestoes.map((item) => (
                <div key={item.id} className="sugestao-item" onClick={() => selecionarSugestao(item)}>
                  <span>@{item.nome}</span>
                  <span className="sugestao-funcao">{item.funcao}</span>
                </div>
              ))}
            </div>
          )}

          <div className="participantes-list">
            {participantes.map((p) => (
              <div key={p.id} className="participante-item">
                <span>{p.nome} ({p.funcao})</span>
                <span className="remover-participante" onClick={() => removerParticipante(p.id)}>×</span>
              </div>
            ))}
          </div>
        </div>

        {/* ===== TEXTO DA ATA ===== */}
        <div className="ata-section">
          <textarea
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              atualizarObjetivos(e.target.value);
            }}
            rows={6}
            placeholder="Digite o texto da ata..."
          />
        </div>

        {/* ===== CHECKBOX PARA CRIAR OBJETIVOS ===== */}
        <div className="ata-section">
          <label className="checkbox-objetivos">
            <input
              type="checkbox"
              checked={criarObjetivos}
              onChange={() => setCriarObjetivos(!criarObjetivos)}
            />
            Criar objetivos a partir da ata?
          </label>
        </div>

        {/* ===== OBJETIVOS ===== */}
        <div className="ata-section">
          <div className={`ata-objectives ${!criarObjetivos ? "desativado" : ""}`}>
            {criarObjetivos ? (
              objetivosList.map((obj, i) => (
                <label key={i}>
                  <input
                    type="checkbox"
                    checked={objetivosConcluidos.includes(i)}
                    onChange={() => toggleObjetivo(i)}
                  />
                  {obj}
                </label>
              ))
            ) : (
              <p className="texto-desativado">Ative para gerar objetivos automaticamente.</p>
            )}
          </div>
          <div className="progress-container">
            <div
              className="progress-bar"
              style={{
                width: `${
                  criarObjetivos && objetivosList.length
                    ? (objetivosConcluidos.length / objetivosList.length) * 100
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </div>

        {/* ===== PRÓXIMA REUNIÃO ===== */}
        <div className="ata-section">
          <input
            type="text"
            value={proxima}
            onChange={(e) => setProxima(e.target.value)}
            placeholder="Próxima reunião: Data ou observações"
          />
        </div>
      </div>
    </div>
  );
}
