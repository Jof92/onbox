// AtaCard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import "./AtaCard.css";

const VERBOS = ["verificar", "acompanhar", "implementar", "analisar", "finalizar", "revisar", "enviar", "agendar", "checar"];

export default function AtaCard({ projetoAtual, notaAtual, ultimaAlteracao, onProgressoChange }) {
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
  const [editing, setEditing] = useState({ pauta: false, local: false });
  const [loading, setLoading] = useState(true);

  // Carregar projeto
  const fetchProjeto = useCallback(async () => {
    if (!projetoAtual?.id) return;
    const { data } = await supabase.from("projects").select("name").eq("id", projetoAtual.id).single();
    setProjetoNome(data?.name || "Projeto sem nome");
  }, [projetoAtual?.id]);

  // Obter data + cidade
  const obterLocalizacao = useCallback(async () => {
    const fmt = (cidade) =>
      `${cidade || ""}, ${new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}`;
    try {
      const res = await fetch("https://ipapi.co/json/");
      setDataLocal(fmt((await res.json()).city));
    } catch {
      try {
        const res = await fetch("https://ipwho.is/");
        setDataLocal(fmt((await res.json()).city));
      } catch {
        setDataLocal(fmt());
      }
    }
  }, []);

  // Obter autor
  const fetchAutor = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setAutorNome("Usuário desconhecido");
    setUsuarioId(user.id);

    let perfil = null;
    const { data: p1 } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
    if (p1) {
      perfil = p1;
    } else {
      const { data: p2 } = await supabase.from("profiles").select("nome").eq("user_id", user.id).single();
      perfil = p2;
    }

    setAutorNome(
      perfil?.nome ||
      user.user_metadata?.nome ||
      user.user_metadata?.name ||
      user.email ||
      "Usuário desconhecido"
    );
  }, []);

  // Extrair objetivos
  const extrairObjetivos = useCallback((txt) => {
    if (!criarObjetivos) return [];
    const objetivos = [];
    const regex = new RegExp(`\\b(${VERBOS.join("|")})\\b`, "gi");

    txt.split(/\n/).forEach((linha) => {
      const matches = [];
      let match;
      while ((match = regex.exec(linha)) !== null) {
        matches.push({ index: match.index });
      }
      matches.forEach((m, i) => {
        const start = m.index;
        const end = i + 1 < matches.length ? matches[i + 1].index : linha.length;
        const trecho = linha.slice(start, end).split(",")[0].trim();
        if (trecho && !objetivos.some((o) => o.texto === trecho)) {
          objetivos.push({ texto: trecho, responsavelId: null, responsavelNome: "", dataEntrega: "" });
        }
      });
    });
    return objetivos;
  }, [criarObjetivos]);

  // Carregar ata
  const fetchAta = useCallback(async () => {
    if (!notaAtual?.id) return setLoading(false);

    try {
      const { data: ata } = await supabase.from("atas").select("*").eq("nota_id", notaAtual.id).single();

      if (!ata) {
        setAtaId(null);
        setPauta("");
        setLocal("");
        setTexto("");
        setProxima("");
        setObjetivosList([]);
        setObjetivosConcluidos([]);
        setParticipantes([]);
        setCriarObjetivos(false);
        setLoading(false);
        return;
      }

      setAtaId(ata.id);
      setPauta(ata.pauta || "");
      setLocal(ata.local || "");
      setTexto(ata.texto || "");
      setProxima(ata.proxima_reuniao || "");

      const { data: partData } = await supabase
        .from("ata_participantes")
        .select("profiles(id,nome,funcao)")
        .eq("ata_id", ata.id);
      setParticipantes(partData?.map((p) => p.profiles) || []);

      const { data: objData } = await supabase
        .from("ata_objetivos")
        .select("*, profiles(id,nome)")
        .eq("ata_id", ata.id);

      if (objData?.length > 0) {
        const objetivos = objData.map((o) => ({
          texto: o.texto,
          responsavelId: o.responsavel_id,
          responsavelNome: o.profiles?.nome || "",
          dataEntrega: o.data_entrega,
        }));
        setObjetivosList(objetivos);
        setObjetivosConcluidos(objData.filter((o) => o.concluido).map((_, i) => i));
        setCriarObjetivos(true);
      } else {
        setCriarObjetivos(false);
        setObjetivosList([]);
        setObjetivosConcluidos([]);
      }

      setLoading(false);
    } catch (err) {
      console.error("Erro ao carregar ata:", err);
      setLoading(false);
    }
  }, [notaAtual?.id]);

  useEffect(() => {
    fetchProjeto();
    obterLocalizacao();
    fetchAutor();
  }, [fetchProjeto, obterLocalizacao, fetchAutor]);

  useEffect(() => {
    if (projetoAtual?.id && notaAtual?.id) fetchAta();
  }, [projetoAtual?.id, notaAtual?.id, fetchAta]);

  useEffect(() => {
    if (criarObjetivos) {
      setObjetivosList(extrairObjetivos(texto));
      setObjetivosConcluidos([]);
    }
  }, [texto, criarObjetivos, extrairObjetivos]);

  const progressoPercent = objetivosList.length
    ? Math.round((objetivosConcluidos.length / objetivosList.length) * 100)
    : 0;

  useEffect(() => {
    if (typeof onProgressoChange === "function") {
      onProgressoChange(progressoPercent);
    }
  }, [progressoPercent, onProgressoChange]);

  const salvarAta = useCallback(async () => {
    if (!usuarioId || !notaAtual?.id || !projetoAtual?.id) {
      return alert("Dados insuficientes para salvar.");
    }

    try {
      let savedAta;

      if (ataId) {
        const { data, error } = await supabase
          .from("atas")
          .update({ pauta, local, texto, proxima_reuniao: proxima || null })
          .eq("id", ataId)
          .select()
          .single();
        if (error) throw error;
        savedAta = data;
      } else {
        const { data, error } = await supabase
          .from("atas")
          .insert([{
            projeto_id: projetoAtual.id,
            nota_id: notaAtual.id,
            pauta,
            local,
            texto,
            proxima_reuniao: proxima || null,
            redigido_por: usuarioId,
            criado_em: new Date().toISOString(),
          }])
          .select()
          .single();
        if (error) throw error;
        savedAta = data;
        setAtaId(savedAta.id);
      }

      await supabase.from("ata_participantes").delete().eq("ata_id", savedAta.id);
      for (const p of participantes) {
        if (!p.id.toString().startsWith("ext")) {
          await supabase.from("ata_participantes").insert([{ ata_id: savedAta.id, profile_id: p.id }]);
        }
      }

      await supabase.from("ata_objetivos").delete().eq("ata_id", savedAta.id);
      for (const [i, o] of objetivosList.entries()) {
        await supabase.from("ata_objetivos").insert([{
          ata_id: savedAta.id,
          texto: o.texto,
          responsavel_id: o.responsavelId || null,
          data_entrega: o.dataEntrega || null,
          concluido: objetivosConcluidos.includes(i),
        }]);
      }

      await supabase.from("notas").update({ progresso: progressoPercent }).eq("id", notaAtual.id);
      alert("✅ Ata salva com sucesso!");
    } catch (e) {
      console.error(e);
      alert(`❌ Erro ao salvar ata: ${e.message}`);
    }
  }, [
    ataId, usuarioId, notaAtual?.id, projetoAtual?.id, pauta, local, texto, proxima,
    participantes, objetivosList, objetivosConcluidos, progressoPercent
  ]);

  // --- Handlers ---
  const toggleObjetivo = (i) => {
    setObjetivosConcluidos(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const handleParticipanteChange = (e) => {
    const v = e.target.value;
    setParticipanteInput(v);
    if (v.startsWith("@") && v.length > 1) {
      supabase.from("profiles").select("id,nome,funcao").ilike("nome", `%${v.slice(1)}%`).limit(10)
        .then(({ data }) => setSugestoesParticipantes(data || []));
    } else {
      setSugestoesParticipantes([]);
    }
  };

  const selecionarSugestao = (item) => {
    if (!participantes.some(p => p.id === item.id)) {
      setParticipantes([...participantes, item]);
    }
    setParticipanteInput("");
    setSugestoesParticipantes([]);
  };

  const removerParticipante = (id) => setParticipantes(participantes.filter(p => p.id !== id));

  const handleResponsavelChange = (e, i) => {
    const v = e.target.value;
    const novos = [...objetivosList];
    novos[i].responsavelNome = v;
    novos[i].responsavelId = null;
    setObjetivosList(novos);

    if (v.startsWith("@") && v.length > 1) {
      supabase.from("profiles").select("id,nome,funcao").ilike("nome", `%${v.slice(1)}%`).limit(10)
        .then(({ data }) => setSugestoesResponsavel(prev => ({ ...prev, [i]: data || [] })));
    } else {
      setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
    }
  };

  const selecionarResponsavel = (item, i) => {
    const novos = [...objetivosList];
    novos[i].responsavelId = item.id;
    novos[i].responsavelNome = item.nome;
    setObjetivosList(novos);
    setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
  };

  // --- Render ---
  if (loading) return <div className="ata-card-loading"><Loading size={200} /></div>;

  return (
    <div className="ata-card">
      {/* Header sem nome da pilha */}
      <div className="listagem-card">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{projetoNome}</span>
            <div className="sub-info">
              <span className="nota-name">{notaAtual?.nome || "Sem nota"}</span>
            </div>
          </div>
          <div className="alteracao-info">{dataLocal || ultimaAlteracao}</div>
        </div>
      </div>

      <div className="ata-body">
        {["pauta", "local"].map(campo => (
          <div key={campo} className="ata-section">
            {editing[campo] ? (
              <input
                className={`${campo}-input`}
                value={campo === "pauta" ? pauta : local}
                onChange={e => (campo === "pauta" ? setPauta(e.target.value) : setLocal(e.target.value))}
                onBlur={() => setEditing({ ...editing, [campo]: false })}
                onKeyDown={e => e.key === "Enter" && setEditing({ ...editing, [campo]: false })}
                autoFocus
              />
            ) : (
              <span
                className={`${campo}-text`}
                onDoubleClick={() => setEditing({ ...editing, [campo]: true })}
              >
                {campo === "pauta" ? pauta || "Digite a pauta da reunião" : local || "Digite o local"}
              </span>
            )}
          </div>
        ))}

        <div className="ata-section">
          <input
            type="text"
            value={participanteInput}
            onChange={handleParticipanteChange}
            placeholder="Digite @Nome ou Enter para externo"
            className="participante-input"
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (sugestoesParticipantes.length > 0) {
                  selecionarSugestao(sugestoesParticipantes[0]);
                } else if (participanteInput.trim()) {
                  setParticipantes(prev => [...prev, { id: `ext-${Date.now()}`, nome: participanteInput.trim(), funcao: "Externo" }]);
                  setParticipanteInput("");
                }
              }
            }}
          />
          {sugestoesParticipantes.length > 0 && (
            <div className="sugestoes-list">
              {sugestoesParticipantes.map(item => (
                <div key={item.id} className="sugestao-item" onClick={() => selecionarSugestao(item)}>
                  <span>@{item.nome}</span>
                  <span className="sugestao-funcao">{item.funcao}</span>
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

        <div className="ata-section">
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={6}
            placeholder="Digite o texto da ata..."
          />
          <label className="checkbox-objetivos">
            <input
              type="checkbox"
              checked={criarObjetivos}
              onChange={() => setCriarObjetivos(!criarObjetivos)}
            />
            Criar objetivos a partir da ata?
          </label>
        </div>

        {criarObjetivos && (
          <div className="ata-section">
            <div className="ata-objectives">
              {objetivosList.map((o, i) => (
                <div key={i} className="objetivo-item">
                  <input
                    type="checkbox"
                    checked={objetivosConcluidos.includes(i)}
                    onChange={() => toggleObjetivo(i)}
                  />
                  <span>{o.texto}</span>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="@Responsável"
                      value={o.responsavelNome || ""}
                      onChange={e => handleResponsavelChange(e, i)}
                    />
                    {sugestoesResponsavel[i]?.length > 0 && (
                      <div className="sugestoes-list" style={{ position: "absolute", zIndex: 10 }}>
                        {sugestoesResponsavel[i].map(item => (
                          <div key={item.id} className="sugestao-item" onClick={() => selecionarResponsavel(item, i)}>
                            <span>@{item.nome}</span>
                            <span className="sugestao-funcao">{item.funcao}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="date"
                    value={o.dataEntrega || ""}
                    onChange={e => {
                      const novos = [...objetivosList];
                      novos[i].dataEntrega = e.target.value;
                      setObjetivosList(novos);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progressoPercent}%` }}></div>
              <span className="progress-percent">{progressoPercent}%</span>
            </div>
          </div>
        )}

        <div className="ata-section proxima-reuniao-container">
          <div className="proxima-reuniao-linha">
            <label>Próxima reunião em:</label>
            <input
              type="date"
              value={proxima}
              onChange={e => setProxima(e.target.value)}
              className="proxima-data-input"
            />
          </div>
          <button className="btn-salvar-ata" onClick={salvarAta}>Salvar</button>
          <div className="ata-autor">
            <p>Ata redigida por <strong>{autorNome || "Usuário desconhecido"}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}