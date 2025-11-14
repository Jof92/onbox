// AtaCard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import Check from "./Check";
import "./loader.css";
import "./AtaCard.css";

const VERBOS = [
  "verificar", "quantificar", "viabilizar", "cobrar", "fechar", "iniciar", "definir", "reduzir", "alcançar", "acompanhar", "implementar", "analisar",
  "finalizar", "revisar", "enviar", "agendar", "checar", "executar", "conferir", "monitorar", "organizar", "planejar",
  "solicitar", "providenciar", "designar", "repassar", "avaliar", "confirmar", "documentar", "registrar", "controlar",
  "inspecionar", "medir", "orçar", "nivelar", "concretar", "dimensionar", "instalar", "regularizar", "liberar", "aprovar",
  "adequar", "corrigir", "homologar", "cotar", "negociar", "comprar", "requisitar", "receber", "armazenar", "devolver",
  "auditar", "contratar", "renovar", "pesquisar", "padronizar", "emitir", "rastrear", "autorizar", "buscar", "coletar", "atualizar", "minutar", "montar", "elaborar", "fazer",
  "validar", "orientar", "supervisionar", "delegar", "capacitar", "reportar", "alocar", "resolver", "implantar", "alinhar"
].map(v => v.toLowerCase());

const segmentarPorDelimitadores = (texto) => {
  const partes = texto.split(/([,.])/);
  const segmentos = [];
  let acumulador = "";

  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];
    if (parte === "," || parte === ".") {
      acumulador += parte;
      segmentos.push(acumulador.trim());
      acumulador = "";
    } else {
      acumulador += parte;
    }
  }
  if (acumulador.trim()) {
    segmentos.push(acumulador.trim());
  }
  return segmentos;
};

const extrairObjetivos = (txt, objetivosAnteriores = [], verbosSet) => {
  if (!txt) return [];

  const segmentos = segmentarPorDelimitadores(txt);
  const novosObjetivos = [];

  for (const seg of segmentos) {
    if (!seg) continue;

    const segLimpo = seg.replace(/[,.]$/, "").trim();
    if (!segLimpo) continue;

    const palavras = segLimpo.split(/\s+/);
    const primeiroVerbo = palavras[0]?.toLowerCase();

    if (verbosSet.has(primeiroVerbo)) {
      if (!novosObjetivos.some(o => o.texto === segLimpo)) {
        const objetivoExistente = objetivosAnteriores.find(o => o.texto === segLimpo);
        novosObjetivos.push({
          texto: segLimpo,
          responsavelId: objetivoExistente?.responsavelId || null,
          responsavelNome: objetivoExistente?.responsavelNome || "",
          dataEntrega: objetivoExistente?.dataEntrega || "",
        });
      }
    }
  }

  return novosObjetivos;
};

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
  const [autorNome, setAutorNome] = useState("Carregando...");
  const [usuarioId, setUsuarioId] = useState(null);
  const [ataId, setAtaId] = useState(null);
  const [editing, setEditing] = useState({ pauta: false, local: false });
  const [editingDataLocal, setEditingDataLocal] = useState(false);
  const [dataLocal, setDataLocal] = useState("");
  const [loading, setLoading] = useState(true);
  const [extIdCounter, setExtIdCounter] = useState(0);
  const [alteradoPorNome, setAlteradoPorNome] = useState("");
  const [alteradoEm, setAlteradoEm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const verbosSet = React.useMemo(() => new Set(VERBOS), []);

  const objetivosListRef = useRef(objetivosList);
  useEffect(() => {
    objetivosListRef.current = objetivosList;
  }, [objetivosList]);

  const fetchProjeto = useCallback(async () => {
    if (!projetoAtual?.id) return;
    const { data } = await supabase.from("projects").select("name").eq("id", projetoAtual.id).single();
    setProjetoNome(data?.name || "Projeto sem nome");
  }, [projetoAtual]);

  const fetchUsuarioLogado = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setUsuarioId(data?.user?.id || null);
  }, []);

  const fetchAta = useCallback(async () => {
    if (!notaAtual?.id) {
      setLoading(false);
      return;
    }

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
        setDataLocal("");
        setAlteradoPorNome("");
        setAlteradoEm("");
        setAutorNome("Ainda não redigida");
        setLoading(false);
        return;
      }

      setAtaId(ata.id);
      setPauta(ata.pauta || "");
      setLocal(ata.local || "");
      setTexto(ata.texto || "");
      setProxima(ata.proxima_reuniao || "");
      setDataLocal(ata.data_local || "");

      const { data: partData } = await supabase
        .from("ata_participantes")
        .select(`
          id,
          profile_id,
          nome_externo,
          funcao_externa,
          profiles(id, nome, funcao)
        `)
        .eq("ata_id", ata.id)
        .order("id", { ascending: true });

      const participantesCarregados = (partData || [])
        .map(p => {
          if (p.profile_id) {
            const perfilValido = p.profiles && typeof p.profiles === 'object' && p.profiles.nome;
            if (perfilValido) {
              return {
                id: p.profiles.id || p.profile_id,
                nome: (p.profiles.nome?.trim() || "Usuário sem nome"),
                funcao: (p.profiles.funcao?.trim() || "Membro")
              };
            } else {
              return {
                id: p.profile_id,
                nome: "Usuário excluído",
                funcao: "Membro"
              };
            }
          } else {
            return {
              id: `ext-${p.id}`,
              nome: (p.nome_externo?.trim() || "Convidado"),
              funcao: (p.funcao_externa?.trim() || "Externo")
            };
          }
        })
        .filter(p => p && p.id);

      setParticipantes(participantesCarregados);

      const { data: objData } = await supabase
        .from("ata_objetivos")
        .select(`
          *,
          profiles(id, nome)
        `)
        .eq("ata_id", ata.id)
        .order("id", { ascending: true });

      if (objData?.length > 0) {
        const objetivos = objData.map((o) => {
          let responsavelNome = "";
          if (o.nome_responsavel_externo) {
            responsavelNome = o.nome_responsavel_externo;
          } else if (o.responsavel_id && o.profiles?.nome) {
            responsavelNome = o.profiles.nome;
          }
          return {
            texto: o.texto,
            responsavelId: o.responsavel_id,
            responsavelNome,
            dataEntrega: o.data_entrega,
          };
        });
        setObjetivosList(objetivos);
        setObjetivosConcluidos(objData.filter((o) => o.concluido).map((_, i) => i));
        setCriarObjetivos(true);
      } else {
        setCriarObjetivos(false);
        setObjetivosList([]);
        setObjetivosConcluidos([]);
      }

      if (ata.redigido_por) {
        let nomeAutor = "Usuário desconhecido";
        const { data: perfil1 } = await supabase.from("profiles").select("nome").eq("id", ata.redigido_por).single();
        if (perfil1?.nome) {
          nomeAutor = perfil1.nome;
        } else {
          const { data: perfil2 } = await supabase.from("profiles").select("nome").eq("user_id", ata.redigido_por).single();
          nomeAutor = perfil2?.nome || "Usuário desconhecido";
        }
        setAutorNome(nomeAutor);
      } else {
        setAutorNome("Autor não registrado");
      }

      if (ata.alterado_por) {
        const { data: perfilAlterador } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", ata.alterado_por)
          .single();

        const nome = perfilAlterador?.nome ||
          (await supabase.from("profiles").select("nome").eq("user_id", ata.alterado_por).single())?.data?.nome ||
          "Usuário desconhecido";

        setAlteradoPorNome(nome);

        if (ata.alterado_em) {
          const data = new Date(ata.alterado_em);
          const dia = String(data.getDate()).padStart(2, '0');
          const mes = String(data.getMonth() + 1).padStart(2, '0');
          const ano = data.getFullYear();
          const horas = String(data.getHours()).padStart(2, '0');
          const minutos = String(data.getMinutes()).padStart(2, '0');
          setAlteradoEm(`${dia}/${mes}/${ano} às ${horas}:${minutos}`);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Erro ao carregar ata:", err);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notaAtual, projetoAtual]);

  useEffect(() => {
    fetchProjeto();
    fetchUsuarioLogado();
  }, [fetchProjeto, fetchUsuarioLogado]);

  useEffect(() => {
    if (projetoAtual?.id && notaAtual?.id) fetchAta();
  }, [projetoAtual?.id, notaAtual?.id, fetchAta]);

  useEffect(() => {
    if (criarObjetivos) {
      const novos = extrairObjetivos(texto, objetivosListRef.current, verbosSet);
      setObjetivosList(novos);
      setObjetivosConcluidos(prev => prev.filter(i => i < novos.length));
    }
  }, [texto, criarObjetivos, verbosSet]);

  const progressoPercent = objetivosList.length
    ? Math.round((objetivosConcluidos.length / objetivosList.length) * 100)
    : 0;

  useEffect(() => {
    if (typeof onProgressoChange === "function") onProgressoChange(progressoPercent);
  }, [progressoPercent, onProgressoChange]);

  const salvarAta = useCallback(async () => {
    if (!usuarioId || !notaAtual?.id || !projetoAtual?.id || !projetoAtual?.tipo) {
      alert("Dados insuficientes: verifique se 'projetoAtual' tem 'id' e 'tipo' válido ('projeto' ou 'setor').");
      return;
    }

    if (projetoAtual.tipo !== 'projeto' && projetoAtual.tipo !== 'setor') {
      alert("Tipo inválido. 'projetoAtual.tipo' deve ser 'projeto' ou 'setor'.");
      return;
    }

    setSalvando(true);
    setSalvoComSucesso(false);

    try {
      let savedAta;
      const agora = new Date().toISOString();

      const payloadBase = {
        nota_id: notaAtual.id,
        pauta,
        local,
        texto,
        proxima_reuniao: proxima || null,
        data_local: dataLocal,
        alterado_por: usuarioId,
        alterado_em: agora,
      };

      const payload = projetoAtual.tipo === 'projeto'
        ? { ...payloadBase, projeto_id: projetoAtual.id, setor_id: null }
        : { ...payloadBase, projeto_id: null, setor_id: projetoAtual.id };

      if (ataId) {
        const { data, error } = await supabase
          .from("atas")
          .update(payload)
          .eq("id", ataId)
          .select()
          .single();
        if (error) throw error;
        savedAta = data;
      } else {
        const payloadInserir = {
          ...payload,
          redigido_por: usuarioId,
          criado_em: agora,
        };
        const { data, error } = await supabase
          .from("atas")
          .insert([payloadInserir])
          .select()
          .single();
        if (error) throw error;
        savedAta = data;
        setAtaId(savedAta.id);
        setAutorNome("Carregando...");
      }

      await supabase.from("ata_participantes").delete().eq("ata_id", savedAta.id);
      const participantesInternos = [];
      for (const p of participantes) {
        if (p.id.toString().startsWith("ext")) {
          await supabase.from("ata_participantes").insert({
            ata_id: savedAta.id,
            nome_externo: p.nome,
            funcao_externa: p.funcao
          });
        } else {
          await supabase.from("ata_participantes").insert({
            ata_id: savedAta.id,
            profile_id: p.id
          });
          if (p.id !== usuarioId) {
            participantesInternos.push(p.id);
          }
        }
      }

      await supabase.from("ata_objetivos").delete().eq("ata_id", savedAta.id);
      const responsaveisInternos = new Set();
      for (const [i, o] of objetivosList.entries()) {
        const ehExterno = o.responsavelId == null;
        await supabase.from("ata_objetivos").insert({
          ata_id: savedAta.id,
          texto: o.texto,
          responsavel_id: ehExterno ? null : o.responsavelId,
          nome_responsavel_externo: o.responsavelNome || null,
          data_entrega: o.dataEntrega || null,
          concluido: objetivosConcluidos.includes(i),
        });

        if (!ehExterno && o.responsavelId && o.responsavelId !== usuarioId) {
          responsaveisInternos.add(o.responsavelId);
        }
      }

      const notificacoes = [];
      for (const userId of participantesInternos) {
        notificacoes.push({
          user_id: userId,
          remetente_id: usuarioId,
          projeto_id: projetoAtual.tipo === 'projeto' ? projetoAtual.id : null,
          nota_id: notaAtual.id,
          mensagem: `${autorNome} marcou você como participante da ata ${notaAtual.nome || 'sem nome'} ${projetoAtual.tipo === 'projeto' ? 'no projeto' : 'no setor'} ${projetoNome}`,
          tipo: 'menção',
          lido: false,
        });
      }

      for (const userId of responsaveisInternos) {
        notificacoes.push({
          user_id: userId,
          remetente_id: usuarioId,
          projeto_id: projetoAtual.tipo === 'projeto' ? projetoAtual.id : null,
          nota_id: notaAtual.id,
          mensagem: `Você tem objetivos a serem resolvidos na ata ${notaAtual.nome || 'sem nome'} ${projetoAtual.tipo === 'projeto' ? 'do projeto' : 'do setor'} ${projetoNome}`,
          tipo: 'menção',
          lido: false,
        });
      }

      if (notificacoes.length > 0) {
        const idsParaNotificar = notificacoes.map(n => n.user_id);
        const { data: notificacoesExistentes } = await supabase
          .from("notificacoes")
          .select("user_id")
          .in("user_id", idsParaNotificar)
          .eq("nota_id", notaAtual.id)
          .eq("tipo", "menção");

        const userIdsJaNotificados = new Set(notificacoesExistentes.map(n => n.user_id));
        const notificacoesUnicas = notificacoes.filter(n => !userIdsJaNotificados.has(n.user_id));

        if (notificacoesUnicas.length > 0) {
          await supabase.from("notificacoes").insert(notificacoesUnicas);
        }
      }

      await supabase.from("notas").update({ progresso: progressoPercent }).eq("id", notaAtual.id);

      setSalvoComSucesso(true);
      setTimeout(() => setSalvoComSucesso(false), 2000);
    } catch (e) {
      console.error(e);
      alert(`❌ Erro ao salvar ata: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  }, [
    ataId, usuarioId, notaAtual, projetoAtual, projetoNome,
    pauta, local, texto, proxima, dataLocal,
    participantes, objetivosList, objetivosConcluidos, progressoPercent,
    autorNome
  ]);

  const toggleObjetivo = (i) => {
    setObjetivosConcluidos(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  // 🔍 FUNÇÃO ATUALIZADA COM DEBUG
const handleParticipanteChange = (e) => {
  const v = e.target.value;
  setParticipanteInput(v);

  // Seu container_id é seu próprio user_id (como visto no log)
  const containerId = usuarioId;

  if (v.startsWith("@") && v.length > 1 && containerId) {
    const termo = v.slice(1).toLowerCase();

    supabase
      .from("convites")
      .select("user_id")
      .eq("container_id", containerId)
      .eq("status", "aceito")
      .then(async ({ data: convites, error }) => {
        if (error) {
          console.error("Erro ao buscar convites:", error);
          setSugestoesParticipantes([]);
          return;
        }

        if (!convites?.length) {
          setSugestoesParticipantes([]);
          return;
        }

        const userIds = convites.map(c => c.user_id);

        // ✅ CORREÇÃO AQUI: usar "id", não "user_id"
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nickname, nome, funcao")
          .in("id", userIds); // ← essa é a mudança

        if (profilesError) {
          console.error("Erro ao buscar profiles:", profilesError);
          setSugestoesParticipantes([]);
          return;
        }

        const filtrados = (profiles || [])
          .filter(p =>
            (p.nickname?.toLowerCase().includes(termo)) ||
            (p.nome?.toLowerCase().includes(termo))
          )
          .slice(0, 10);

        setSugestoesParticipantes(filtrados);
      })
      .catch(err => {
        console.error("Erro na cadeia de busca:", err);
        setSugestoesParticipantes([]);
      });
  } else {
    setSugestoesParticipantes([]);
  }
};

  const selecionarSugestao = (item) => {
    if (!participantes.some(p => p.id === item.id)) {
      setParticipantes([...participantes, {
        id: item.id,
        nome: item.nickname || item.nome,
        funcao: item.funcao || "Membro"
      }]);
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

  const containerId = usuarioId;

  if (v.startsWith("@") && v.length > 1 && containerId) {
    const termo = v.slice(1).toLowerCase();

    supabase
      .from("convites")
      .select("user_id")
      .eq("container_id", containerId)
      .eq("status", "aceito")
      .then(async ({ data: convites, error }) => {
        if (error || !convites?.length) {
          setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
          return;
        }

        const userIds = convites.map(c => c.user_id);

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nickname, nome, funcao")
          .in("id", userIds); // ← usa "id", não "user_id"

        if (profilesError) {
          console.error("Erro ao buscar responsáveis:", profilesError);
          setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
          return;
        }

        const filtrados = (profiles || [])
          .filter(p =>
            (p.nickname?.toLowerCase().includes(termo)) ||
            (p.nome?.toLowerCase().includes(termo))
          )
          .slice(0, 10);

        setSugestoesResponsavel(prev => ({ ...prev, [i]: filtrados }));
      })
      .catch(err => {
        console.error("Erro na busca de responsáveis:", err);
        setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
      });
  } else {
    setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
  }
};

const selecionarResponsavel = (item, i) => {
  const novos = [...objetivosList];
  novos[i].responsavelId = item.id;
  novos[i].responsavelNome = item.nickname || item.nome;
  setObjetivosList(novos);
  setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
};

  if (loading) return <div className="ata-card-loading"><Loading size={200} /></div>;

  return (
    <div className="ata-card">
      <div className="listagem-card">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{projetoNome}</span>
            <div className="sub-info">
              <span className="nota-name">{notaAtual?.nome || "Sem nota"}</span>
            </div>
          </div>
          <div className="alteracao-info">{ultimaAlteracao}</div>
        </div>
      </div>

      <div className="ata-body">
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

        <div className="ata-section">
          <input
            type="text"
            value={participanteInput}
            onChange={handleParticipanteChange}
            placeholder="Digite @nickname (membros do seu container) ou Nome (externo) + Enter"
            className="participante-input"
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (sugestoesParticipantes.length > 0) {
                  selecionarSugestao(sugestoesParticipantes[0]);
                } else if (participanteInput.trim()) {
                  setParticipantes(prev => [...prev, {
                    id: `ext-${extIdCounter}`,
                    nome: participanteInput.trim(),
                    funcao: "Externo"
                  }]);
                  setParticipanteInput("");
                  setExtIdCounter(prev => prev + 1);
                }
              }
            }}
          />
          {sugestoesParticipantes.length > 0 && (
            <div className="sugestoes-list">
              {sugestoesParticipantes.map(item => (
                <div key={item.id} className="sugestao-item" onClick={() => selecionarSugestao(item)}>
                  <span>@{item.nickname || item.nome}</span>
                  <span className="sugestao-funcao">{item.funcao}</span>
                </div>
              ))}
            </div>
          )}
          <div className="participantes-list">
            {participantes
              .filter(p => p && typeof p === 'object')
              .map(p => (
                <div key={p.id} className="participante-item">
                  <span>{p.nome || "Nome não informado"} ({p.funcao || "Função não informada"})</span>
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
            placeholder="Digite o texto da ata (use verbos no infinitivo: 'definir', 'acompanhar', etc.)"
          />
          <label className="checkbox-objetivos">
            <input
              type="checkbox"
              checked={criarObjetivos}
              onChange={(e) => {
                const ativar = e.target.checked;
                setCriarObjetivos(ativar);
                if (ativar) {
                  const novos = extrairObjetivos(texto, objetivosListRef.current, verbosSet);
                  setObjetivosList(novos);
                  setObjetivosConcluidos(prev => prev.filter(i => i < novos.length));
                } else {
                  setObjetivosList([]);
                  setObjetivosConcluidos([]);
                }
              }}
            />
            Criar objetivos a partir da ata?
          </label>
        </div>

        {criarObjetivos && (
          <div className="ata-section">
            <div className="ata-objectives">
              {objetivosList.map((o, i) => {
                const textoCapitalizado = o.texto.charAt(0).toUpperCase() + o.texto.slice(1);
                const numeroObjetivo = `${i + 1}.`;
                return (
                  <div key={i} className="objetivo-item">
                    <input type="checkbox" checked={objetivosConcluidos.includes(i)} onChange={() => toggleObjetivo(i)} />
                    <span><strong>{numeroObjetivo}</strong> {textoCapitalizado}</span>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder="@Responsável"
                        value={o.responsavelNome}
                        onChange={e => handleResponsavelChange(e, i)}
                      />
                      {sugestoesResponsavel[i]?.length > 0 && (
                        <div className="sugestoes-list" style={{ position: "absolute", zIndex: 10 }}>
                          {sugestoesResponsavel[i].map(item => (
                            <div key={item.id} className="sugestao-item" onClick={() => selecionarResponsavel(item, i)}>
                              <span>@{item.nome}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="date"
                        value={o.dataEntrega || ""}
                        onChange={e => {
                          const novos = [...objetivosList];
                          novos[i].dataEntrega = e.target.value;
                          setObjetivosList(novos);
                        }}
                      />
                      <span
                        style={{ cursor: "pointer", color: "red", fontWeight: "bold" }}
                        onClick={() => {
                          const novos = [...objetivosList];
                          novos.splice(i, 1);
                          setObjetivosList(novos);
                          setObjetivosConcluidos(prev => prev.filter(idx => idx !== i));
                        }}
                      >
                        ×
                      </span>
                    </div>
                  </div>
                );
              })}
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
            <input type="date" value={proxima} onChange={e => setProxima(e.target.value)} className="proxima-data-input" />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="btn-salvar-ata" onClick={salvarAta} disabled={salvando}>
              Salvar
            </button>
            {salvando && <div className="loader"></div>}
            {salvoComSucesso && <Check />}
          </div>

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
              <span
                className="data-local-text"
                onDoubleClick={() => setEditingDataLocal(true)}
                style={{ cursor: "pointer" }}
              >
                {dataLocal || "Clique duas vezes para inserir cidade e data"}
              </span>
            )}
          </div>

          <div className="ata-autor">
            {ataId && (
              <>
                <p>Ata redigida por <strong>{autorNome}</strong></p>
                {alteradoPorNome && alteradoEm && (
                  <p>Ata alterada por <strong>{alteradoPorNome}</strong> em <strong>{alteradoEm}</strong></p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}