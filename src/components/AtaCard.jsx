import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./AtaCard.css";

const VERBOS = ["verificar","acompanhar","implementar","analisar","finalizar","revisar","enviar","agendar","checar"];

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
  const [participantes, setParticipantes] = useState([]);
  const [participanteInput, setParticipanteInput] = useState("");
  const [sugestoesParticipantes, setSugestoesParticipantes] = useState([]);
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState({});
  const [autorNome, setAutorNome] = useState("");
  const [usuarioId, setUsuarioId] = useState(null);
  const [ataId, setAtaId] = useState(null);
  const [editingPauta, setEditingPauta] = useState(false);
  const [editingLocal, setEditingLocal] = useState(false);

  const pautaRef = useRef();
  const localRef = useRef();

  // --- BUSCA NOME DO PROJETO ---
  useEffect(() => {
    if (!projetoAtual) return;
    supabase.from("projects")
      .select("name")
      .eq("id", projetoAtual.id || projetoAtual)
      .single()
      .then(({ data, error }) => setProjetoNome(data?.name || "Projeto sem nome"))
      .catch(() => setProjetoNome("Projeto não encontrado"));
  }, [projetoAtual]);

  // --- DATA E LOCAL ---
  useEffect(() => {
    const hoje = new Date();
    const formatarData = (cidade) => {
      const dataFormatada = hoje.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
      return cidade ? `${cidade}, ${dataFormatada}` : dataFormatada;
    };
    const obterLocalizacao = async () => {
      try { const res = await fetch("https://ipapi.co/json/"); const data = await res.json(); setDataLocal(formatarData(data.city)); }
      catch { try { const res2 = await fetch("https://ipwho.is/"); const data2 = await res2.json(); setDataLocal(formatarData(data2.city)); } 
      catch { setDataLocal(formatarData()); } }
    };
    obterLocalizacao();
  }, []);

  // --- BUSCA AUTOR ---
  useEffect(() => {
    const fetchAutor = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) return setAutorNome("Usuário desconhecido");
        setUsuarioId(user.id);

        let { data: perfil } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
        if (!perfil) {
          const resp = await supabase.from("profiles").select("nome").eq("user_id", user.id).single();
          perfil = resp.data;
        }

        const nomeDoPerfil = perfil?.nome || user.user_metadata?.nome || user.user_metadata?.name || user.email || "Usuário desconhecido";
        setAutorNome(nomeDoPerfil);
      } catch {
        setAutorNome("Usuário desconhecido");
      }
    };
    fetchAutor();
  }, []);

  // --- CARREGA ATA EXISTENTE ---
  useEffect(() => {
    if (!projetoAtual || !pilhaAtual || !notaAtual) return;

    const fetchAta = async () => {
      try {
        const { data: ata } = await supabase
          .from("atas")
          .select("*")
          .eq("projeto_id", projetoAtual.id || projetoAtual)
          .eq("pilha", pilhaAtual?.nome || pilhaAtual)
          .eq("nota", notaAtual?.nome || notaAtual)
          .single();

        if (!ata) {
          setAtaId(null); setPauta(""); setLocal(""); setTexto(""); setProxima(""); setCriarObjetivos(false);
          setObjetivosList([]); setObjetivosConcluidos([]); setParticipantes([]);
          return;
        }

        setAtaId(ata.id); setPauta(ata.pauta || ""); setLocal(ata.local || "");
        setTexto(ata.texto || ""); setProxima(ata.proxima_reuniao || "");

        const { data: partData } = await supabase
          .from("ata_participantes")
          .select("profiles(id,nome,funcao)")
          .eq("ata_id", ata.id);
        setParticipantes(partData?.map(p => p.profiles) || []);

        const { data: objData } = await supabase
          .from("ata_objetivos")
          .select("*")
          .eq("ata_id", ata.id);
        if (objData?.length > 0) {
          setObjetivosList(objData.map(o => ({
            texto: o.texto,
            responsavelId: o.responsavel_id,
            responsavelNome: "",
            dataEntrega: o.data_entrega
          })));
          setObjetivosConcluidos(objData.filter(o => o.concluido).map((_, i) => i));
          setCriarObjetivos(true);
        }

      } catch (err) {
        console.error("Erro ao carregar ata:", err);
      }
    };

    fetchAta();
  }, [projetoAtual, pilhaAtual, notaAtual]);

  // --- OBJETIVOS ---
  const extrairObjetivos = (txt) => {
    if (!criarObjetivos) return [];
    const linhas = txt.split(/\n|\.|;/).map(l => l.trim()).filter(Boolean);
    const objs = [];

    linhas.forEach(linha => {
      let restante = linha;
      let matchFound = true;
      while (matchFound) {
        matchFound = false;
        for (const verbo of VERBOS) {
          const match = new RegExp(`\\b${verbo}\\b`, "i").exec(restante);
          if (match) {
            matchFound = true;
            const objetivo = restante.slice(match.index).split(",")[0].trim();
            if (objetivo && !objs.some(o => o.texto === objetivo)) objs.push({ texto: objetivo, responsavelId: null, dataEntrega: "" });
            restante = restante.slice(match.index + objetivo.length);
            break;
          }
        }
      }
    });

    return objs;
  };

  const atualizarObjetivos = (txt) => {
    if (criarObjetivos) {
      setObjetivosList(extrairObjetivos(txt));
      setObjetivosConcluidos([]);
    }
  };

  const toggleObjetivo = (idx) =>
    setObjetivosConcluidos(prev => prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]);

  // --- PARTICIPANTES / RESPONSÁVEIS ---
  const buscarSugestoes = async (query, campo) => {
    if (!query.startsWith("@") || query.length < 2) {
      return campo === "participante"
        ? setSugestoesParticipantes([])
        : setSugestoesResponsavel(prev => ({ ...prev, [campo]: [] }));
    }
    const termo = query.slice(1);
    try {
      const { data } = await supabase.from("profiles").select("id,nome,funcao").ilike("nome", `%${termo}%`).limit(10);
      campo === "participante"
        ? setSugestoesParticipantes(data || [])
        : setSugestoesResponsavel(prev => ({ ...prev, [campo]: data || [] }));
    } catch {
      campo === "participante"
        ? setSugestoesParticipantes([])
        : setSugestoesResponsavel(prev => ({ ...prev, [campo]: [] }));
    }
  };

  const handleParticipanteChange = e => { setParticipanteInput(e.target.value); buscarSugestoes(e.target.value, "participante"); };
  const selecionarSugestao = item => { if(!participantes.some(p=>p.id===item.id)) setParticipantes([...participantes,item]); setParticipanteInput(""); setSugestoesParticipantes([]); };
  const removerParticipante = id => setParticipantes(participantes.filter(p => p.id !== id));

  const handleResponsavelChange = (e, idx) => {
    const novos = [...objetivosList]; novos[idx].responsavelId = null; novos[idx].responsavelNome = e.target.value; setObjetivosList(novos);
    buscarSugestoes(e.target.value, idx);
  };
  const selecionarResponsavel = (item, idx) => {
    const novos = [...objetivosList]; novos[idx].responsavelId = item.id; novos[idx].responsavelNome = item.nome; setObjetivosList(novos);
    setSugestoesResponsavel(prev => ({ ...prev, [idx]: [] }));
  };

  const handleBlur = campo => { if(campo==="pauta") setEditingPauta(false); if(campo==="local") setEditingLocal(false); };

  // --- SALVAR ATA ---
  const salvarAta = async () => {
    try {
      if (!usuarioId) throw new Error("Usuário não autenticado");
      let savedAta;
      if (ataId) {
        const { data, error } = await supabase.from("atas").update({ pauta, local, texto, proxima_reuniao: proxima || null }).eq("id", ataId).select().single();
        if(error) throw error;
        savedAta = data;
      } else {
        const { data, error } = await supabase.from("atas").insert([{ projeto_id: projetoAtual.id || projetoAtual, pilha: pilhaAtual?.nome || pilhaAtual, nota: notaAtual?.nome || notaAtual, pauta, local, texto, proxima_reuniao: proxima || null, redigido_por: usuarioId, criado_em: new Date().toISOString() }]).select().single();
        if(error) throw error;
        savedAta = data;
        setAtaId(data.id);
      }

      await supabase.from("ata_participantes").delete().eq("ata_id", savedAta.id);
      await supabase.from("ata_objetivos").delete().eq("ata_id", savedAta.id);

      for (const p of participantes) if(p.id) await supabase.from("ata_participantes").insert([{ ata_id: savedAta.id, profile_id: p.id }]);
      for (const [i,obj] of objetivosList.entries()) await supabase.from("ata_objetivos").insert([{ ata_id: savedAta.id, texto: obj.texto, responsavel_id: obj.responsavelId || null, data_entrega: obj.dataEntrega || null, concluido: objetivosConcluidos.includes(i) }]);

      alert("✅ Ata salva com sucesso!");
    } catch(err) { console.error(err); alert(`❌ Erro ao salvar a ata: ${err.message}`); }
  };

  const progressoPercent = objetivosList.length ? Math.round((objetivosConcluidos.length / objetivosList.length) * 100) : 0;

  return (
    <div className="ata-card">
      {/* HEADER */}
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

      {/* BODY */}
      <div className="ata-body">
        {/* Pauta */}
        <div className="ata-section">
          {editingPauta
            ? <input ref={pautaRef} className="pauta-input" type="text" value={pauta} onChange={e=>setPauta(e.target.value)} onBlur={()=>handleBlur("pauta")} onKeyDown={e=>e.key==="Enter"&&setEditingPauta(false)} autoFocus/>
            : <span className="pauta-text" onDoubleClick={()=>setEditingPauta(true)}>{pauta||"Digite a pauta da reunião"}</span>}
        </div>

        {/* Local */}
        <div className="ata-section">
          {editingLocal
            ? <input ref={localRef} className="local-input" type="text" value={local} onChange={e=>setLocal(e.target.value)} onBlur={()=>handleBlur("local")} onKeyDown={e=>e.key==="Enter"&&setEditingLocal(false)} autoFocus/>
            : <span className="local-text" onDoubleClick={()=>setEditingLocal(true)}>{local||"Digite o local"}</span>}
        </div>

        {/* Participantes */}
        <div className="ata-section">
          <input type="text" value={participanteInput} onChange={handleParticipanteChange} placeholder="Digite @Nome e selecione" className="participante-input"/>
          {sugestoesParticipantes.length>0 && (
            <div className="sugestoes-list">{sugestoesParticipantes.map(item=>(
              <div key={item.id} className="sugestao-item" onClick={()=>selecionarSugestao(item)}>
                <span>@{item.nome}</span><span className="sugestao-funcao">{item.funcao}</span>
              </div>
            ))}</div>
          )}
          <div className="participantes-list">
            {participantes.map(p=>(
              <div key={p.id} className="participante-item">
                <span>{p.nome} ({p.funcao})</span>
                <span className="remover-participante" onClick={()=>removerParticipante(p.id)}>×</span>
              </div>
            ))}
          </div>
        </div>

        {/* Texto / Objetivos */}
        <div className="ata-section">
          <textarea value={texto} onChange={e=>{setTexto(e.target.value); atualizarObjetivos(e.target.value);}} rows={6} placeholder="Digite o texto da ata..."/>
          <label className="checkbox-objetivos">
            <input type="checkbox" checked={criarObjetivos} onChange={()=>{setCriarObjetivos(!criarObjetivos); if(!criarObjetivos) atualizarObjetivos(texto);}}/>
            Criar objetivos a partir da ata?
          </label>
        </div>

        {criarObjetivos && (
          <div className="ata-section">
            <div className="ata-objectives">
              {objetivosList.map((obj,i)=>(
                <div key={i} className="objetivo-item">
                  <input type="checkbox" checked={objetivosConcluidos.includes(i)} onChange={()=>toggleObjetivo(i)}/>
                  <span>{obj.texto}</span>
                  <div style={{position:"relative"}}>
                    <input type="text" placeholder="@Responsável" value={obj.responsavelNome||""} onChange={e=>handleResponsavelChange(e,i)}/>
                    {sugestoesResponsavel[i]?.length>0 && (
                      <div className="sugestoes-list" style={{position:"absolute",zIndex:10}}>
                        {sugestoesResponsavel[i].map(item=>(
                          <div key={item.id} className="sugestao-item" onClick={()=>selecionarResponsavel(item,i)}>
                            <span>@{item.nome}</span><span className="sugestao-funcao">{item.funcao}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="date" value={obj.dataEntrega||""} onChange={e=>{const novos=[...objetivosList]; novos[i].dataEntrega=e.target.value; setObjetivosList(novos)}}/>
                </div>
              ))}
            </div>

            {/* Barra de progresso */}
            <div className="progress-container">
              <div className="progress-bar" style={{width:`${progressoPercent}%`}}></div>
              <span className="progress-percent">{progressoPercent}%</span>
            </div>
          </div>
        )}

        {/* Próxima reunião / Salvar */}
        <div className="ata-section proxima-reuniao-container">
          <div className="proxima-reuniao-linha">
            <label>Próxima reunião em:</label>
            <input type="date" value={proxima} onChange={e=>setProxima(e.target.value)} className="proxima-data-input"/>
          </div>
          <button className="btn-salvar-ata" onClick={salvarAta}>Salvar</button>
          <div className="ata-autor">
            <p>Ata redigida por <strong>{autorNome||"Usuário desconhecido"}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
