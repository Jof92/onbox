// AtaCard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import "./AtaCard.css";

const VERBOS = [
  "verificar", "viabilizar", "cobrar", "Fechar", "Definir", "reduzir", "alcançar", "acompanhar", "implementar", "analisar",
  "finalizar", "revisar", "enviar", "agendar", "checar", "executar", "conferir", "monitorar", "organizar", "planejar",
  "solicitar", "providenciar", "designar", "repassar", "avaliar", "confirmar", "documentar", "registrar", "controlar",
  "inspecionar", "medir", "orçar", "nivelar", "concretar", "dimensionar", "instalar", "regularizar", "liberar", "aprovar",
  "adequar", "corrigir", "homologar", "cotar", "negociar", "comprar", "requisitar", "receber", "armazenar", "devolver",
  "auditar", "contratar", "renovar", "pesquisar", "padronizar", "conferir", "emitir", "acompanhar", "rastrear", "autorizar",
  "validar", "orientar", "supervisionar", "delegar", "capacitar", "reportar", "alocar", "resolver", "alinhar"
];

export default function AtaCard({ projetoAtual, notaAtual, ultimaAlteracao, onProgressoChange }) {
  const [projetoNome, setProjetoNome] = useState("");
  const [pauta, setPauta] = useState("");
  const [local, setLocal] = useState("");
  const [texto, setTexto] = useState("");
  const [proxima, setProxima] = useState("");
  const [criarObjetivos, setCriarObjetivos] = useState(false);
  const [objetivosList, setObjetivosList] = useState([]);
  const [objetivosConcluidos, setObjetivosConcluidos] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [participanteInput, setParticipanteInput] = useState("");
  const [sugestoesParticipantes, setSugestoesParticipantes] = useState([]);
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState({});
  const [autorNome, setAutorNome] = useState("");
  const [usuarioId, setUsuarioId] = useState(null);
  const [ataId, setAtaId] = useState(null);
  const [editing, setEditing] = useState({ pauta: false, local: false });
  const [editingDataLocal, setEditingDataLocal] = useState(false);
  const [dataLocal, setDataLocal] = useState("");
  const [loading, setLoading] = useState(true);
  const [extIdCounter, setExtIdCounter] = useState(0);

  // Projeto
  const fetchProjeto = useCallback(async () => {
    if (!projetoAtual?.id) return;
    const { data } = await supabase.from("projects").select("name").eq("id", projetoAtual.id).single();
    setProjetoNome(data?.name || "Projeto sem nome");
  }, [projetoAtual?.id]);

  // Autor
  const fetchAutor = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setAutorNome("Usuário desconhecido");
    setUsuarioId(user.id);
    const { data: perfil } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
    setAutorNome(perfil?.nome || user.email || "Usuário desconhecido");
  }, []);

  // Extrair objetivos
  const extrairObjetivos = useCallback((txt) => {
    if (!criarObjetivos) return [];
    const objetivos = [];
    const regex = new RegExp(`\\b(${VERBOS.join("|")})\\b`, "gi");
    txt.split(/\n/).forEach((linha) => {
      let match; const matches = [];
      while ((match = regex.exec(linha)) !== null) matches.push({ index: match.index });
      matches.forEach((m, i) => {
        const start = m.index;
        const end = matches[i + 1]?.index ?? linha.length;
        const trecho = linha.slice(start, end).split(",")[0].trim();
        if (trecho && !objetivos.some((o) => o.texto === trecho)) {
          objetivos.push({ texto: trecho, responsavelId: null, responsavelNome: "", dataEntrega: "" });
        }
      });
    });
    return objetivos;
  }, [criarObjetivos]);

  // Fetch Ata
  const fetchAta = useCallback(async () => {
    if (!notaAtual?.id) return setLoading(false);

    const { data: ata } = await supabase.from("atas").select("*").eq("nota_id", notaAtual.id).single();

    if (!ata) {
      setAtaId(null);
      setPauta(""); setLocal(""); setTexto(""); setProxima(""); setObjetivosList([]); setParticipantes([]); setDataLocal("");
      setLoading(false); return;
    }

    setAtaId(ata.id);
    setPauta(ata.pauta || "");
    setLocal(ata.local || "");
    setTexto(ata.texto || "");
    setProxima(ata.proxima_reuniao || "");
    setDataLocal(ata.data_local || "");

    // Carregar participantes (REESCRITO / CORRIGIDO)
    const { data: partData } = await supabase
      .from("ata_participantes")
      .select(`id, profile_id, nome_externo, funcao_externa, profiles(id, nome, funcao)`)
      .eq("ata_id", ata.id);

    const participantesCarregados = (partData || [])
      .map(p => {
        if (!p) return null;
        if (p.profile_id) {
          return {
            id: p.profile_id,
            nome: p.profiles?.nome?.trim() || "Usuário não identificado",
            funcao: p.profiles?.funcao?.trim() || "Membro"
          };
        }
        return {
          id: `ext-${p.id}`,
          nome: p.nome_externo?.trim() || "Convidado",
          funcao: p.funcao_externa?.trim() || "Externo"
        };
      })
      .filter(p => p && p.id && p.nome);

    setParticipantes(participantesCarregados);

    // Objetivos
    const { data: objData } = await supabase.from("ata_objetivos").select("*, profiles(id,nome)").eq("ata_id", ata.id);

    if (objData?.length) {
      setCriarObjetivos(true);
      setObjetivosList(objData.map(o => ({
        texto: o.texto,
        responsavelId: o.responsavel_id,
        responsavelNome: o.nome_responsavel_externo || o.profiles?.nome || "",
        dataEntrega: o.data_entrega
      })));
      setObjetivosConcluidos(objData.filter(o => o.concluido).map((_, i) => i));
    }

    setLoading(false);
  }, [notaAtual?.id]);

  useEffect(() => { fetchProjeto(); fetchAutor(); }, [fetchProjeto, fetchAutor]);
  useEffect(() => { if (projetoAtual?.id && notaAtual?.id) fetchAta(); }, [projetoAtual?.id, notaAtual?.id, fetchAta]);
  useEffect(() => { if (criarObjetivos) { setObjetivosList(extrairObjetivos(texto)); setObjetivosConcluidos([]); } }, [texto, criarObjetivos, extrairObjetivos]);

  const progressoPercent = objetivosList.length ? Math.round((objetivosConcluidos.length / objetivosList.length) * 100) : 0;
  useEffect(() => { onProgressoChange?.(progressoPercent); }, [progressoPercent, onProgressoChange]);

  // Toggle objetivo
  const toggleObjetivo = (i) => setObjetivosConcluidos(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  // Participantes input & sugestão
  const handleParticipanteChange = (e) => {
    const v = e.target.value;
    setParticipanteInput(v);
    if (v.startsWith("@") && v.length > 1) {
      supabase.from("profiles").select("id,nome,funcao").ilike("nome", `%${v.slice(1)}%`).limit(10)
        .then(({ data }) => setSugestoesParticipantes(data || []));
    } else setSugestoesParticipantes([]);
  };

  const selecionarSugestao = (item) => {
    if (!participantes.some(p => p.id === item.id)) {
      setParticipantes([...participantes, { id: item.id, nome: item.nome, funcao: item.funcao || "Membro" }]);
    }
    setParticipanteInput(""); setSugestoesParticipantes([]);
  };

  const removerParticipante = (id) => setParticipantes(participantes.filter(p => p.id !== id));

  // Responsáveis
  const handleResponsavelChange = (e, i) => {
    const v = e.target.value;
    const novos = [...objetivosList];
    novos[i].responsavelNome = v; novos[i].responsavelId = null;
    setObjetivosList(novos);
    if (v.startsWith("@") && v.length > 1) {
      supabase.from("profiles").select("id,nome,funcao").ilike("nome", `%${v.slice(1)}%`).limit(10)
        .then(({ data }) => setSugestoesResponsavel(prev => ({ ...prev, [i]: data || [] })));
    } else setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
  };

  const selecionarResponsavel = (item, i) => {
    const novos = [...objetivosList];
    novos[i].responsavelId = item.id; novos[i].responsavelNome = item.nome;
    setObjetivosList(novos);
    setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
  };

  // Salvar ata
  const salvarAta = useCallback(async () => {
    if (!usuarioId || !notaAtual?.id || !projetoAtual?.id) return alert("Dados insuficientes para salvar.");

    try {
      let savedAta;

      if (ataId) {
        const { data, error } = await supabase
          .from("atas").update({
            pauta, local, texto,
            proxima_reuniao: proxima || null,
            data_local: dataLocal
          })
          .eq("id", ataId).select().single();
        if (error) throw error; savedAta = data;
      } else {
        const { data, error } = await supabase
          .from("atas").insert([{
            projeto_id: projetoAtual.id,
            nota_id: notaAtual.id,
            pauta, local, texto,
            proxima_reuniao: proxima || null,
            data_local: dataLocal,
            redigido_por: usuarioId,
            criado_em: new Date().toISOString(),
          }]).select().single();
        if (error) throw error;
        savedAta = data; setAtaId(data.id);
      }

      await supabase.from("ata_participantes").delete().eq("ata_id", savedAta.id);
      for (const p of participantes) {
        if (p.id.toString().startsWith("ext"))
          await supabase.from("ata_participantes").insert({ ata_id: savedAta.id, nome_externo: p.nome.trim(), funcao_externa: p.funcao });
        else
          await supabase.from("ata_participantes").insert({ ata_id: savedAta.id, profile_id: p.id });
      }

      await supabase.from("ata_objetivos").delete().eq("ata_id", savedAta.id);
      objetivosList.forEach(async (o, i) => {
        const ehExterno = !o.responsavelId;
        await supabase.from("ata_objetivos").insert({
          ata_id: savedAta.id,
          texto: o.texto,
          responsavel_id: ehExterno ? null : o.responsavelId,
          nome_responsavel_externo: ehExterno ? (o.responsavelNome.trim() || null) : null,
          data_entrega: o.dataEntrega || null,
          concluido: objetivosConcluidos.includes(i),
        });
      });

      await supabase.from("notas").update({ progresso: progressoPercent }).eq("id", notaAtual.id);
      alert("✅ Ata salva com sucesso!");
    } catch (e) {
      console.error(e);
      alert(`❌ Erro ao salvar ata: ${e.message}`);
    }
  }, [ataId, usuarioId, notaAtual?.id, projetoAtual?.id, pauta, local, texto, proxima, dataLocal, participantes, objetivosList, objetivosConcluidos, progressoPercent]);

  if (loading) return <div className="ata-card-loading"><Loading size={200} /></div>;

  return (
    <div className="ata-card">
      <div className="listagem-card">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{projetoNome}</span>
            <div className="sub-info"><span className="nota-name">{notaAtual?.nome || "Sem nota"}</span></div>
          </div>
          <div className="alteracao-info">{ultimaAlteracao}</div>
        </div>
      </div>

      <div className="ata-body">

        {/* Pauta e Local */}
        {["pauta", "local"].map(campo => (
          <div key={campo} className="ata-section">
            {editing[campo] ? (
              <input
                className={`${campo}-input`}
                value={campo === "pauta" ? pauta : local}
                onChange={e => campo === "pauta" ? setPauta(e.target.value) : setLocal(e.target.value)}
                onBlur={() => setEditing({ ...editing, [campo]: false })}
                onKeyDown={e => e.key === "Enter" && setEditing({ ...editing, [campo]: false })}
                autoFocus
              />
            ) : (
              <span
                className={`${campo}-text`}
                onDoubleClick={() => setEditing({ ...editing, [campo]: true })}
                style={{ cursor: "pointer" }}
              >
                {campo === "pauta" ? pauta || "Digite a pauta da reunião" : local || "Digite o local"}
              </span>
            )}
          </div>
        ))}

        {/* Participantes */}
        <div className="ata-section">
          <input
            type="text"
            value={participanteInput}
            onChange={handleParticipanteChange}
            placeholder="Digite @Nome (interno) ou Nome (externo) + Enter"
            className="participante-input"
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (sugestoesParticipantes.length > 0) {
                  selecionarSugestao(sugestoesParticipantes[0]);
                } else if (participanteInput.trim()) {
                  setParticipantes([...participantes, { id: `ext-${extIdCounter}`, nome: participanteInput.trim(), funcao: "Externo" }]);
                  setParticipanteInput(""); setExtIdCounter(prev => prev + 1);
                }
              }
            }}
          />

          {sugestoesParticipantes.length > 0 && (
            <div className="sugestoes-list">
              {sugestoesParticipantes.map(item => (
                <div key={item.id} className="sugestao-item" onClick={() => selecionarSugestao(item)}>
                  <span>@{item.nome}</span><span className="sugestao-funcao">{item.funcao}</span>
                </div>
              ))}
            </div>
          )}

          <div className="participantes-list">
            {participantes.map(p => (
              <div key={p.id} className="participante-item">
                <span>{p.nome} ({p.funcao})</span>
                <span className="remover-participante" onClick={() => removerParticipante(p.id)}>×</span>
              </div>
            ))}
          </div>
        </div>

        {/* Texto */}
        <div className="ata-section">
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={6} placeholder="Digite o texto da ata..." />
          <label className="checkbox-objetivos">
            <input type="checkbox" checked={criarObjetivos} onChange={() => setCriarObjetivos(!criarObjetivos)} />
            Criar objetivos a partir da ata?
          </label>
        </div>

        {/* Objetivos */}
        {criarObjetivos && (
          <div className="ata-section">
            <div className="ata-objectives">
              {objetivosList.map((o, i) => (
                <div key={i} className="objetivo-item">
                  <input type="checkbox" checked={objetivosConcluidos.includes(i)} onChange={() => toggleObjetivo(i)} />
                  <span>{o.texto}</span>
                  <div style={{ position: "relative" }}>
                    <input type="text" placeholder="@Responsável" value={o.responsavelNome || ""} onChange={e => handleResponsavelChange(e, i)} />
                    {sugestoesResponsavel[i]?.length > 0 && (
                      <div className="sugestoes-list" style={{ position: "absolute", zIndex: 10 }}>
                        {sugestoesResponsavel[i].map(item => (
                          <div key={item.id} className="sugestao-item" onClick={() => selecionarResponsavel(item, i)}>
                            <span>@{item.nome}</span><span className="sugestao-funcao">{item.funcao}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input type="date" value={o.dataEntrega || ""} onChange={e => {
                      const novos = [...objetivosList];
                      novos[i].dataEntrega = e.target.value;
                      setObjetivosList(novos);
                    }} />
                    <span style={{ cursor: "pointer", color: "red", fontWeight: "bold" }}
                      onClick={() => {
                        const novos = [...objetivosList];
                        novos.splice(i, 1);
                        setObjetivosList(novos);
                        setObjetivosConcluidos(prev => prev.filter(idx => idx !== i));
                      }}>×</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="progress-container"><div className="progress-bar" style={{ width: `${progressoPercent}%` }}></div><span className="progress-percent">{progressoPercent}%</span></div>
          </div>
        )}

        {/* Próxima reunião + salvar */}
        <div className="ata-section proxima-reuniao-container">
          <div className="proxima-reuniao-linha">
            <label>Próxima reunião em:</label>
            <input type="date" value={proxima} onChange={e => setProxima(e.target.value)} className="proxima-data-input" />
          </div>

          <button className="btn-salvar-ata" onClick={salvarAta}>Salvar</button>

          <div className="ata-data-local">
            {editingDataLocal ? (
              <input
                type="text"
                value={dataLocal}
                placeholder="Cidade, DD de Mês de AAAA"
                onChange={e => setDataLocal(e.target.value)}
                onBlur={() => setEditingDataLocal(false)}
                onKeyDown={e => e.key === "Enter" && setEditingDataLocal(false)}
                autoFocus
              />
            ) : (
              <span className="data-local-text" onDoubleClick={() => setEditingDataLocal(true)} style={{ cursor: "pointer" }}>
                {dataLocal || "Clique duas vezes para inserir cidade e data"}
              </span>
            )}
          </div>

          <div className="ata-autor"><p>Ata redigida por <strong>{autorNome || "Usuário desconhecido"}</strong></p></div>
        </div>

      </div>
    </div>
  );
}
