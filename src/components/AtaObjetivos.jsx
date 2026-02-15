import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserPlus, faCalendar, faShareFromSquare } from "@fortawesome/free-solid-svg-icons";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const VERBOS = [
  "verificar", "quantificar", "viabilizar", "cobrar", "fechar", "iniciar", "definir", "reduzir", "alcançar", "acompanhar", "implementar", "analisar",
  "finalizar", "revisar", "enviar", "agendar", "checar", "executar", "conferir", "monitorar", "organizar", "planejar", "informar",
  "solicitar", "providenciar", "designar", "repassar", "avaliar", "confirmar", "documentar", "registrar", "controlar",
  "inspecionar", "medir", "orçar", "nivelar", "concretar", "dimensionar", "instalar", "regularizar", "liberar", "aprovar",
  "adequar", "corrigir", "homologar", "cotar", "negociar", "comprar", "requisitar", "receber", "armazenar", "devolver",
  "auditar", "contratar", "renovar", "pesquisar", "padronizar", "emitir", "rastrear", "autorizar", "buscar", "coletar", "atualizar", "minutar", "montar", "elaborar", "fazer",
  "validar", "orientar", "supervisionar", "delegar", "capacitar", "reportar", "alocar", "resolver", "implantar", "alinhar", "mandar", "reunir", "criar"
].map(v => v.toLowerCase());

const PREFIXO_EXCLUIDO = "[EXCLUIDO]";

const extrairObjetivosValidos = (texto) => {
  if (!texto?.trim()) return [];
  
  const regex = /'([^']+)'/g;
  const matches = [];
  let match;
  
  while ((match = regex.exec(texto)) !== null) {
    const objetivo = match[1].trim();
    if (objetivo) {
      matches.push(objetivo);
    }
  }
  
  return matches;
};

const ComentarioIcon = ({ onClick, title }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ cursor: 'pointer' }} onClick={onClick} title={title}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const podeDesmarcarConclusao = (concluidoEm) => {
  if (!concluidoEm) return true;
  const agora = new Date();
  const diffMs = agora - new Date(concluidoEm);
  const diffHoras = diffMs / (1000 * 60 * 60);
  return diffHoras < 24;
};

const ChipResponsavel = ({ responsavel, onRemove, disabled }) => {
  const nomeExibicao = responsavel.nome_exibicao || "Usuário";
  const isExterno = !responsavel.usuario_id;

  const gerarAbreviacao = (nome) => {
    if (!nome) return "U";
    
    if (nome.includes('_')) {
      const partes = nome.split('_');
      return partes.map(p => p.charAt(0).toUpperCase()).join('_');
    }
    
    if (nome.includes(' ')) {
      const partes = nome.split(' ').filter(p => p.length > 0);
      return partes.map(p => p.charAt(0).toUpperCase()).join('');
    }
    
    return nome.substring(0, 2).charAt(0).toUpperCase() + nome.substring(1, 2).toLowerCase();
  };

  const abreviacao = gerarAbreviacao(nomeExibicao);

  return (
    <span 
      className={`chip-responsavel ${isExterno ? 'chip-externo' : ''}`}
      title={nomeExibicao}
    >
      {abreviacao}
      {!disabled && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove(responsavel);
          }}
          className="chip-remove"
        >
          ×
        </span>
      )}
    </span>
  );
};

export default function AtaObjetivos({
  ataId,
  texto,
  usuarioId,
  projetoAtual,
  notaAtual,
  projetoNome,
  autorNome,
  onProgressoChange,
  containerAtual
}) {
  const [criarObjetivos, setCriarObjetivos] = useState(false);
  const [objetivosList, setObjetivosList] = useState([]);
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState({});
  const [editandoComentario, setEditandoComentario] = useState({});
  const [comentarioTemp, setComentarioTemp] = useState({});
  const [meuNome, setMeuNome] = useState("Você");
  const [inputResponsavel, setInputResponsavel] = useState({});
  const [mostrarAtasDisponiveis, setMostrarAtasDisponiveis] = useState({});
  const [atasDisponiveis, setAtasDisponiveis] = useState([]);
  const [atasOrigemNomes, setAtasOrigemNomes] = useState({});
  const verbosSet = React.useMemo(() => new Set(VERBOS), []);
  const isSaving = useRef(false);
  const lastTextRef = useRef("");
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    const fetchMeuNome = async () => {
      if (!usuarioId) return;
      const { data } = await supabase.from("profiles").select("nome").eq("id", usuarioId).single();
      if (data?.nome) setMeuNome(data.nome);
    };
    fetchMeuNome();
  }, [usuarioId]);

  const sendNotification = useCallback(async (recipientUserId, message, type, objective) => {
    if (!recipientUserId || !usuarioId) return;

    const notificationData = {
      user_id: recipientUserId,
      remetente_id: usuarioId,
      mensagem: message,
      tipo: type,
      lido: false,
      created_at: new Date().toISOString(),
      nota_id: notaAtual?.id || null,
      projeto_id: projetoAtual?.id || null,
      container_id: containerAtual?.id || null,
      pilha_id: notaAtual?.pilha_id || null,
      setor_id: projetoAtual?.setor_id || null,
    };

    try {
      const { error } = await supabase.from("notificacoes").insert([notificationData]);
      if (error) console.error("Erro ao enviar notificação:", error);
    } catch (err) {
      console.error("Exceção ao enviar notificação:", err);
    }
  }, [usuarioId, notaAtual, projetoAtual, containerAtual]);

  const carregarObjetivos = useCallback(async () => {
    if (!ataId) {
      setObjetivosList([]);
      setCriarObjetivos(false);
      return;
    }

    const { data: objetivosData, error: ataError } = await supabase
      .from("ata_objetivos")
      .select(`*, profiles(id, nome)`)
      .eq("ata_id", ataId)
      .order("ordem", { ascending: true })
      .order("id", { ascending: true });

    if (ataError) {
      console.error("Erro ao carregar objetivos:", ataError);
      setObjetivosList([]);
      setCriarObjetivos(false);
      return;
    }

    const lista = Array.isArray(objetivosData) ? objetivosData : [];
    const objetivoIds = lista.map(o => o.id);
    let respPorObj = {};

    if (objetivoIds.length > 0) {
      const { data: respData, error: respErr } = await supabase
        .from("ata_objetivos_responsaveis_enriquecidos")
        .select("*")
        .in("ata_objetivo_id", objetivoIds);

      if (!respErr && Array.isArray(respData)) {
        respPorObj = respData.reduce((acc, r) => {
          if (!acc[r.ata_objetivo_id]) acc[r.ata_objetivo_id] = [];
          acc[r.ata_objetivo_id].push({
            id: r.id,
            usuario_id: r.usuario_id,
            nome_externo: r.nome_externo,
            nome_exibicao: r.nome_exibicao
          });
          return acc;
        }, {});
      }
    }

    const objetivos = lista
      .filter(o => !o.texto?.startsWith(PREFIXO_EXCLUIDO))
      .map(o => {
        // Detectar se foi enviado pelo padrão do comentário
        const foiEnviado = o.comentario?.startsWith('Objetivo enviado para:');
        const ataDestinoNome = foiEnviado 
          ? o.comentario.replace('Objetivo enviado para:', '').trim()
          : null;
        
        // Detectar se veio de outra ata pelo padrão [ORIGEM:id]
        const matchOrigem = o.comentario?.match(/\[ORIGEM:(\d+)\]/);
        const foiRecebido = matchOrigem !== null;
        const ataOrigemId = matchOrigem ? parseInt(matchOrigem[1]) : null;
        
        return {
          id: o.id,
          texto: o.texto || "",
          responsaveis: respPorObj[o.id] || [],
          dataEntrega: o.data_entrega,
          concluido: o.concluido || false,
          concluidoEm: o.concluido_em ? new Date(o.concluido_em) : null,
          comentario: o.comentario || "",
          enviado: foiEnviado,
          ataDestinoNome: ataDestinoNome,
          recebido: foiRecebido,
          ataOrigemId: ataOrigemId,
        };
      });

    setObjetivosList(objetivos);
    setCriarObjetivos(objetivos.length > 0);

    // Buscar nomes das atas de origem para objetivos recebidos
    const atasOrigemIds = [...new Set(objetivos
      .filter(o => o.recebido && o.ataOrigemId)
      .map(o => o.ataOrigemId))];

    if (atasOrigemIds.length > 0) {
      const { data: atasOrigem } = await supabase
        .from("atas")
        .select("id, nota_id")
        .in("id", atasOrigemIds);

      if (atasOrigem && atasOrigem.length > 0) {
        const notasIds = atasOrigem.map(a => a.nota_id);
        const { data: notas } = await supabase
          .from("notas")
          .select("id, nome")
          .in("id", notasIds);

        if (notas) {
          const nomesMap = {};
          atasOrigem.forEach(ata => {
            const nota = notas.find(n => n.id === ata.nota_id);
            if (nota) {
              nomesMap[ata.id] = nota.nome;
            }
          });
          setAtasOrigemNomes(nomesMap);
        }
      }
    }
  }, [ataId]);

  useEffect(() => {
    carregarObjetivos();
    lastTextRef.current = "";
  }, [carregarObjetivos]);

  useEffect(() => {
    if (!criarObjetivos || isUpdatingRef.current) return;

    const validos = extrairObjetivosValidos(texto);
    
    if (lastTextRef.current === texto) return;
    lastTextRef.current = texto;

    isUpdatingRef.current = true;

    const textosSalvos = new Map();
    objetivosList
      .filter(o => o.id && !String(o.id).startsWith('temp'))
      .forEach(o => {
        textosSalvos.set(o.texto.toLowerCase().trim(), o.id);
      });

    const novosObjetivos = validos.map(txt => {
      const txtNormalizado = txt.toLowerCase().trim();
      const idExistente = textosSalvos.get(txtNormalizado);
      
      if (idExistente) {
        return objetivosList.find(o => o.id === idExistente);
      }
      
      return {
        id: `temp-${Date.now()}-${Math.random()}`,
        texto: txt,
        responsaveis: [],
        dataEntrega: null,
        concluido: false,
        concluidoEm: null,
        comentario: "",
      };
    });

    setObjetivosList(novosObjetivos);

    if (validos.length > 0 || objetivosList.length > 0) {
      setCriarObjetivos(true);
    }

    isUpdatingRef.current = false;
  }, [texto, criarObjetivos]);

  useEffect(() => {
    if (!ataId || !criarObjetivos) return;

    const timer = setTimeout(async () => {
      if (isSaving.current) return;
      isSaving.current = true;

      try {
        const validos = extrairObjetivosValidos(texto);
        const salvos = new Map();
        
        objetivosList
          .filter(o => o.id && !String(o.id).startsWith('temp'))
          .forEach(o => {
            salvos.set(o.texto.toLowerCase().trim(), {
              id: o.id,
              texto: o.texto
            });
          });

        for (const obj of objetivosList) {
          if (obj.id && !String(obj.id).startsWith('temp') && salvos.has(obj.texto.toLowerCase().trim())) {
            const txtNormalizado = obj.texto.toLowerCase().trim();
            const salvo = salvos.get(txtNormalizado);
            if (salvo.texto !== obj.texto) {
              await supabase
                .from("ata_objetivos")
                .update({ texto: obj.texto })
                .eq("id", obj.id);
            }
          }
        }

        const paraInserir = validos.filter(txt => {
          const txtNormalizado = txt.toLowerCase().trim();
          return !salvos.has(txtNormalizado);
        });

        if (paraInserir.length > 0) {
          const inserts = paraInserir.map((txt, idx) => ({
            ata_id: ataId,
            texto: txt,
            concluido: false,
            comentario: "",
            data_entrega: null,
            concluido_em: null,
            ordem: objetivosList.length + idx,
          }));

          const { data: inseridos, error } = await supabase
            .from("ata_objetivos")
            .insert(inserts)
            .select();

          if (!error && inseridos) {
            setObjetivosList(prev => {
              const atualizado = [...prev];
              inseridos.forEach((novo, idx) => {
                const txt = paraInserir[idx];
                const tempIndex = atualizado.findIndex(o => 
                  o.texto.toLowerCase().trim() === txt.toLowerCase().trim() && 
                  String(o.id).startsWith('temp')
                );
                if (tempIndex !== -1) {
                  atualizado[tempIndex] = { ...atualizado[tempIndex], id: novo.id };
                }
              });
              return atualizado;
            });
          }
        }

      } finally {
        isSaving.current = false;
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [texto, ataId, criarObjetivos, objetivosList]);

  const progressoPercent = objetivosList.length
    ? Math.round((objetivosList.filter(o => o.concluido).length / objetivosList.length) * 100)
    : 0;

  useEffect(() => {
    if (typeof onProgressoChange === "function") {
      onProgressoChange(progressoPercent);
    }
  }, [progressoPercent, onProgressoChange]);

  const toggleObjetivo = async (i) => {
    const objetivo = objetivosList[i];
    if (!objetivo?.id || !ataId || String(objetivo.id).startsWith('temp')) return;

    const novoConcluido = !objetivo.concluido;
    if (!novoConcluido && !podeDesmarcarConclusao(objetivo.concluidoEm)) {
      alert("Não é possível desmarcar um objetivo concluído há mais de 24 horas.");
      return;
    }

    const agora = new Date();
    const novos = [...objetivosList];
    novos[i] = { ...objetivo, concluido: novoConcluido, concluidoEm: novoConcluido ? agora : null };
    setObjetivosList(novos);

    try {
      const { error } = await supabase
        .from("ata_objetivos")
        .update({
          concluido: novoConcluido,
          concluido_em: novoConcluido ? agora.toISOString() : null,
        })
        .eq("id", objetivo.id);

      if (error) throw error;

      const novoProgresso = Math.round((novos.filter(o => o.concluido).length / novos.length) * 100);
      if (typeof onProgressoChange === "function") onProgressoChange(novoProgresso);
      
      if (notaAtual?.id) {
        await supabase.from("notas").update({ progresso: novoProgresso }).eq("id", notaAtual.id);
      }

      if (novoConcluido) {
        for (const resp of objetivo.responsaveis) {
          if (resp.usuario_id) {
            await sendNotification(resp.usuario_id, `Objetivo concluído: ${objetivo.texto}`, "objetivo_concluido", objetivo);
          }
        }
      }

    } catch (err) {
      console.error("Erro ao salvar conclusão:", err);
      setObjetivosList([...objetivosList]);
      alert("Erro ao salvar estado do objetivo.");
    }
  };

  const handleResponsavelInputChange = (e, i) => {
    const valor = e.target.value;
    setInputResponsavel(prev => ({ ...prev, [i]: valor }));
    const objetivo = objetivosList[i];
    if (objetivo?.concluido) return;

    if (valor.startsWith("@") && valor.length > 1 && containerAtual?.id) {
      const termo = valor.slice(1).toLowerCase();

      supabase
        .from("convites")
        .select("user_id")
        .eq("container_id", containerAtual.id)
        .eq("status", "aceito")
        .then(async ({ data: convites, error: convitesError }) => {
          if (convitesError) {
            console.error("Erro ao buscar convites:", convitesError);
            setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
            return;
          }

          const userIds = convites
            .map(c => c.user_id)
            .filter(id => id);

          if (userIds.length === 0) {
            setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
            return;
          }

          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, nickname, nome, funcao")
            .in("id", userIds);

          if (profilesError) {
            console.error("Erro ao buscar perfis:", profilesError);
            setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
            return;
          }

          const sugestoes = profiles.filter(p =>
            (p.nickname?.toLowerCase().includes(termo)) ||
            (p.nome?.toLowerCase().includes(termo))
          );

          const seen = new Set();
          const unicos = sugestoes.filter(p => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });

          setSugestoesResponsavel(prev => ({ ...prev, [i]: unicos.slice(0, 10) }));
        })
        .catch(err => {
          console.error("Erro inesperado na busca de responsáveis:", err);
          setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
        });
    } else {
      setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
    }
  };

  const adicionarResponsavelExterno = async (nome, i) => {
    const objetivo = objetivosList[i];
    if (objetivo?.concluido) return;
    if (objetivo?.responsaveis.some(r => r.nome_externo === nome && !r.usuario_id)) return;

    const novos = [...objetivosList];
    const novoResp = {
      nome_externo: nome,
      usuario_id: null,
      nome_exibicao: nome,
      id: Date.now() + Math.random()
    };
    novos[i] = { ...novos[i], responsaveis: [...novos[i].responsaveis, novoResp] };
    setObjetivosList(novos);

    if (objetivo?.id && !String(objetivo.id).startsWith('temp')) {
      const { data, error } = await supabase
        .from("ata_objetivos_responsaveis")
        .insert({ ata_objetivo_id: objetivo.id, nome_externo: nome, usuario_id: null })
        .select('id');
      if (!error && data?.[0]?.id) {
        const idReal = data[0].id;
        setObjetivosList(prev => {
          const updated = [...prev];
          const idx = updated[i].responsaveis.findIndex(r => r.id === novoResp.id);
          if (idx !== -1) updated[i].responsaveis[idx] = { ...novoResp, id: idReal };
          return updated;
        });
      }
    }
  };

  const adicionarResponsavelInterno = async (item, i) => {
    const objetivo = objetivosList[i];
    if (objetivo?.concluido) return;
    if (objetivo?.responsaveis.some(r => r.usuario_id === item.id)) return;

    const novos = [...objetivosList];
    const novoResp = {
      id: Date.now() + Math.random(),
      usuario_id: item.id,
      nome: item.nome,
      nickname: item.nickname,
      nome_exibicao: item.nome,
    };
    novos[i] = { ...novos[i], responsaveis: [...novos[i].responsaveis, novoResp] };
    setObjetivosList(novos);
    setInputResponsavel(prev => ({ ...prev, [i]: "" }));
    setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));

    if (objetivo?.id && !String(objetivo.id).startsWith('temp')) {
      const { data, error } = await supabase
        .from("ata_objetivos_responsaveis")
        .insert({ ata_objetivo_id: objetivo.id, usuario_id: item.id, nome_externo: null })
        .select('id');
      if (!error && data?.[0]?.id) {
        const idReal = data[0].id;
        setObjetivosList(prev => {
          const updated = [...prev];
          const idx = updated[i].responsaveis.findIndex(r => r.id === novoResp.id);
          if (idx !== -1) updated[i].responsaveis[idx] = { ...novoResp, id: idReal };
          return updated;
        });
        await sendNotification(item.id, `Você foi designado responsável por: ${objetivo.texto}`, "objetivo_responsavel", objetivo);
      }
    }
  };

  const removerResponsavel = async (responsavel, i) => {
    const objetivo = objetivosList[i];
    if (objetivo?.concluido) return;

    const novos = [...objetivosList];
    novos[i] = { ...novos[i], responsaveis: novos[i].responsaveis.filter(r => r.id !== responsavel.id) };
    setObjetivosList(novos);

    if (objetivo?.id && responsavel.id && !String(objetivo.id).startsWith('temp')) {
      await supabase.from("ata_objetivos_responsaveis").delete().eq("id", responsavel.id);
    }
  };

  const removerObjetivo = async (i) => {
    const objetivo = objetivosList[i];
    if (objetivo?.concluido) {
      alert("Não é possível excluir um objetivo concluído.");
      return;
    }

    const novos = [...objetivosList];
    novos.splice(i, 1);
    setObjetivosList(novos);

    if (objetivo?.id && !String(objetivo.id).startsWith('temp')) {
      await supabase
        .from("ata_objetivos")
        .update({ texto: `${PREFIXO_EXCLUIDO} ${objetivo.texto}` })
        .eq("id", objetivo.id);
    }
  };

  const buscarAtasDisponiveis = useCallback(async (objetivoIndex) => {
    if (!ataId || !projetoAtual?.id) return;

    try {
      // 1. Buscar todas as pilhas do projeto/setor atual
      const campoPilha = projetoAtual.tipo === 'projeto' ? 'project_id' : 'setor_id';
      
      const { data: pilhas, error: erroPilhas } = await supabase
        .from("pilhas")
        .select("id")
        .eq(campoPilha, projetoAtual.id);

      if (erroPilhas) throw erroPilhas;
      
      if (!pilhas || pilhas.length === 0) {
        setAtasDisponiveis([]);
        alert("Não há pilhas disponíveis neste projeto/setor.");
        return;
      }

      const pilhaIds = pilhas.map(p => p.id);

      // 2. Buscar todas as notas do tipo "Atas" nessas pilhas
      const { data: notasAtas, error: erroNotas } = await supabase
        .from("notas")
        .select("id, nome, pilha_id, progresso")
        .eq("tipo", "Atas")
        .in("pilha_id", pilhaIds);

      if (erroNotas) throw erroNotas;

      // 3. Filtrar para excluir a nota atual E notas com 100% de progresso
      const notasDisponiveis = (notasAtas || [])
        .filter(n => 
          n.id !== notaAtual?.id && 
          (n.progresso === null || n.progresso === undefined || n.progresso < 100)
        );
      
      if (notasDisponiveis.length === 0) {
        setAtasDisponiveis([]);
        alert("Não há outras atas disponíveis neste projeto/setor (todas estão 100% concluídas ou não existem).");
        return;
      }

      const notasIds = notasDisponiveis.map(n => n.id);

      // 4. Buscar atas correspondentes
      const { data: atas, error: atasError } = await supabase
        .from("atas")
        .select("id, pauta, nota_id")
        .in("nota_id", notasIds);

      if (atasError) throw atasError;

      // 5. Combinar informações de notas e atas
      const atasComNome = (atas || []).map(ata => {
        const nota = notasDisponiveis.find(n => n.id === ata.nota_id);
        return {
          ataId: ata.id,
          notaId: ata.nota_id,
          nome: nota?.nome || "Ata sem nome",
          pauta: ata.pauta || "Sem pauta",
          progresso: nota?.progresso || 0,
        };
      });

      setAtasDisponiveis(atasComNome);
      setMostrarAtasDisponiveis(prev => ({ ...prev, [objetivoIndex]: true }));
    } catch (err) {
      console.error("Erro ao buscar atas disponíveis:", err);
      alert("Erro ao carregar atas disponíveis.");
    }
  }, [ataId, projetoAtual, notaAtual]);

  const realocarObjetivo = async (objetivoIndex, ataDestinoId, ataDestinoNome) => {
    const objetivo = objetivosList[objetivoIndex];
    if (!objetivo?.id || String(objetivo.id).startsWith('temp')) {
      alert("Não é possível realocar um objetivo não salvo.");
      return;
    }

    if (objetivo.concluido) {
      alert("Não é possível realocar um objetivo já concluído.");
      return;
    }

    try {
      // 1. Criar cópia do objetivo na ata de destino com marcação de origem
      const comentarioOrigem = `[ORIGEM:${ataId}]`; // Marca invisível da origem
      
      const novoObjetivo = {
        ata_id: ataDestinoId,
        texto: objetivo.texto,
        concluido: false,
        comentario: comentarioOrigem,
        data_entrega: objetivo.dataEntrega,
        concluido_em: null,
        ordem: 0, // Será inserido no início
      };

      const { data: objetivoInserido, error: erroInsert } = await supabase
        .from("ata_objetivos")
        .insert([novoObjetivo])
        .select()
        .single();

      if (erroInsert) throw erroInsert;

      // 2. Copiar responsáveis para o novo objetivo
      if (objetivo.responsaveis.length > 0) {
        const responsaveisParaInserir = objetivo.responsaveis.map(r => ({
          ata_objetivo_id: objetivoInserido.id,
          usuario_id: r.usuario_id || null,
          nome_externo: r.nome_externo || null,
        }));

        const { error: erroResp } = await supabase
          .from("ata_objetivos_responsaveis")
          .insert(responsaveisParaInserir);

        if (erroResp) console.error("Erro ao copiar responsáveis:", erroResp);
      }

      // 3. Marcar objetivo original como concluído/enviado
      const agora = new Date();
      const comentarioEnviado = `Objetivo enviado para: ${ataDestinoNome}`;
      
      const { error: erroUpdate } = await supabase
        .from("ata_objetivos")
        .update({ 
          concluido: true,
          concluido_em: agora.toISOString(),
          comentario: comentarioEnviado
        })
        .eq("id", objetivo.id);

      if (erroUpdate) throw erroUpdate;

      // 4. Atualizar na lista local
      const novosObjetivos = [...objetivosList];
      novosObjetivos[objetivoIndex] = {
        ...objetivo,
        concluido: true,
        concluidoEm: agora,
        comentario: comentarioEnviado,
        enviado: true,
        ataDestinoNome: ataDestinoNome
      };
      setObjetivosList(novosObjetivos);

      // 5. Atualizar progresso da ata
      const novoProgresso = Math.round(
        (novosObjetivos.filter(o => o.concluido).length / novosObjetivos.length) * 100
      );
      
      if (typeof onProgressoChange === "function") {
        onProgressoChange(novoProgresso);
      }
      
      if (notaAtual?.id) {
        await supabase.from("notas").update({ progresso: novoProgresso }).eq("id", notaAtual.id);
      }

      // 6. Fechar menu
      setMostrarAtasDisponiveis(prev => ({ ...prev, [objetivoIndex]: false }));

      alert("Objetivo realocado com sucesso!");
    } catch (err) {
      console.error("Erro ao realocar objetivo:", err);
      alert("Erro ao realocar objetivo. Tente novamente.");
    }
  };

  const iniciarEdicaoComentario = (i, comentarioAtual) => {
    let comentarioPuro = comentarioAtual || "";
    if (comentarioPuro.includes(" — Comentário por ")) {
      const ultimaOcorrencia = comentarioPuro.lastIndexOf(" — Comentário por ");
      comentarioPuro = comentarioPuro.substring(0, ultimaOcorrencia);
    }
    setEditandoComentario(prev => ({ ...prev, [i]: true }));
    setComentarioTemp(prev => ({ ...prev, [i]: comentarioPuro }));
  };

  const salvarComentario = async (i) => {
    const comentario = comentarioTemp[i] || "";
    const objetivo = objetivosList[i];
    if (!objetivo?.id || !usuarioId || String(objetivo.id).startsWith('temp')) return;

    const comentarioComAutor = `${comentario} — Comentário por ${meuNome}`;
    try {
      const { error } = await supabase
        .from("ata_objetivos")
        .update({ comentario: comentarioComAutor, comentario_por: usuarioId })
        .eq("id", objetivo.id);
      if (error) throw error;
      
      const novos = [...objetivosList];
      novos[i].comentario = comentarioComAutor;
      setObjetivosList(novos);
      setEditandoComentario(prev => ({ ...prev, [i]: false }));

      for (const resp of objetivo.responsaveis) {
        if (resp.usuario_id) {
          await sendNotification(resp.usuario_id, `Novo comentário em objetivo: ${objetivo.texto}`, "objetivo_comentario", objetivo);
        }
      }

    } catch (err) {
      console.error("Erro ao salvar comentário:", err);
      alert("Erro ao salvar comentário.");
    }
  };

  const cancelarComentario = (i) => {
    setEditandoComentario(prev => ({ ...prev, [i]: false }));
  };

  const handleCriarObjetivosChange = (e) => {
    const novaEscolha = e.target.checked;
    const temObjetivosSalvos = objetivosList.some(o => o.id && !String(o.id).startsWith('temp'));
    if (!novaEscolha && temObjetivosSalvos) {
      alert("Você não pode desativar esta opção enquanto houver objetivos salvos. Exclua todos os objetivos primeiro.");
      return;
    }
    setCriarObjetivos(novaEscolha);
    if (!novaEscolha) {
      setObjetivosList([]);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    const novosObjetivos = Array.from(objetivosList);
    const [moved] = novosObjetivos.splice(sourceIndex, 1);
    novosObjetivos.splice(destIndex, 0, moved);
    
    setObjetivosList(novosObjetivos);
    
    try {
      for (let i = 0; i < novosObjetivos.length; i++) {
        const objetivo = novosObjetivos[i];
        if (objetivo.id && !String(objetivo.id).startsWith('temp')) {
          await supabase
            .from("ata_objetivos")
            .update({ ordem: i })
            .eq("id", objetivo.id);
        }
      }
    } catch (err) {
      console.error("Erro ao salvar ordem dos objetivos:", err);
    }
  };

  return (
    <>
      <div className="ata-section">
        <label className="checkbox-objetivos">
          <input
            type="checkbox"
            checked={criarObjetivos}
            onChange={handleCriarObjetivosChange}
          />
          Criar objetivos a partir da ata?
        </label>
      </div>

      {criarObjetivos && (
        <div className="ata-section">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="objetivos-list">
              {(provided) => (
                <div 
                  className="ata-objectives"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {objetivosList.map((o, i) => {
                    const textoCapitalizado = o.texto.charAt(0).toUpperCase() + o.texto.slice(1);
                    const numeroObjetivo = `${i + 1}.`;
                    const isEditing = editandoComentario[i];
                    const isConcluido = o.concluido;
                    const podeDesmarcar = podeDesmarcarConclusao(o.concluidoEm);
                    const comentarioPreview = comentarioTemp[i] || "";
                    const comentarioComAutorPreview = comentarioPreview
                      ? `${comentarioPreview} — Comentário feito por ${meuNome}`
                      : "";

                    return (
                      <Draggable 
                        key={String(o.id)} 
                        draggableId={String(o.id)} 
                        index={i}
                        isDragDisabled={isConcluido}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`objetivo-item ${
                              isConcluido 
                                ? (o.enviado ? 'objetivo-enviado' : 'objetivo-concluido')
                                : (o.recebido ? 'objetivo-recebido' : '')
                            } ${snapshot.isDragging ? 'objetivo-dragging' : ''}`}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.85 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isConcluido}
                              onChange={() => toggleObjetivo(i)}
                              disabled={isConcluido && !podeDesmarcar}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span>
                              <strong>{numeroObjetivo}</strong> {textoCapitalizado}
                              {o.enviado && o.ataDestinoNome && (
                                <div style={{
                                  fontSize: '12px',
                                  color: '#f59e0b',
                                  fontStyle: 'italic',
                                  marginTop: '4px',
                                  fontWeight: '500'
                                }}>
                                  📤 Objetivo enviado para: {o.ataDestinoNome}
                                </div>
                              )}
                              {o.recebido && o.ataOrigemId && atasOrigemNomes[o.ataOrigemId] && (
                                <div style={{
                                  fontSize: '12px',
                                  color: '#3b82f6',
                                  fontStyle: 'italic',
                                  marginTop: '4px',
                                  fontWeight: '500'
                                }}>
                                  📥 Vindo da ata: {atasOrigemNomes[o.ataOrigemId]}
                                </div>
                              )}
                            </span>

                            <div className="objetivo-responsaveis-chips">
                              {o.responsaveis.map(resp => (
                                <ChipResponsavel
                                  key={resp.id}
                                  responsavel={resp}
                                  onRemove={(r) => removerResponsavel(r, i)}
                                  disabled={isConcluido}
                                />
                              ))}
                            </div>

                            <div className="objetivo-acao-direita">
                              {!isConcluido && (
                                <span
                                  className="icone-add-resp"
                                  title="Adicionar responsável"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditandoComentario(prev => ({ ...prev, [`resp-${i}`]: true }));
                                  }}
                                >
                                  <FontAwesomeIcon icon={faUserPlus} />
                                </span>
                              )}

                              {editandoComentario[`resp-${i}`] && !isConcluido && (
                                <div className="input-responsavel-flutuante">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Nome ou @menção"
                                    value={inputResponsavel[i] || ""}
                                    onChange={(e) => handleResponsavelInputChange(e, i)}
                                    onBlur={() => {
                                      setTimeout(() => setEditandoComentario(prev => ({ ...prev, [`resp-${i}`]: false })), 200);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        const valor = inputResponsavel[i] || "";
                                        if (!valor.startsWith("@")) {
                                          adicionarResponsavelExterno(valor, i);
                                          setEditandoComentario(prev => ({ ...prev, [`resp-${i}`]: false }));
                                        }
                                      } else if (e.key === "Escape") {
                                        setEditandoComentario(prev => ({ ...prev, [`resp-${i}`]: false }));
                                      }
                                    }}
                                  />
                                  {sugestoesResponsavel[i]?.length > 0 && (
                                    <div className="sugestoes-list-flutuante">
                                      {sugestoesResponsavel[i].map(item => (
                                        <div
                                          key={item.id}
                                          className="sugestao-item"
                                          onClick={() => {
                                            adicionarResponsavelInterno(item, i);
                                            setEditandoComentario(prev => ({ ...prev, [`resp-${i}`]: false }));
                                          }}
                                        >
                                          @{item.nickname || item.nome}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="objetivo-acao">
                              {!isConcluido && (
                                <>
                                  <label
                                    className="objetivo-data-entrega"
                                    style={{ 
                                      cursor: 'pointer', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '4px',
                                      position: 'relative'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {o.dataEntrega ? (
                                      <>
                                        {o.dataEntrega.split('-').reverse().join('/')}
                                        <FontAwesomeIcon icon={faCalendar} style={{ fontSize: '12px', color: '#555' }} />
                                      </>
                                    ) : (
                                      <FontAwesomeIcon icon={faCalendar} style={{ fontSize: '14px', color: '#555' }} />
                                    )}
                                    <input
                                      type="date"
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        opacity: 0,
                                        cursor: 'pointer'
                                      }}
                                      value={o.dataEntrega || ''}
                                      onChange={async (e) => {
                                        const valorData = e.target.value || null;
                                        const novos = [...objetivosList];
                                        novos[i].dataEntrega = valorData;
                                        setObjetivosList(novos);
                                        if (o.id && !String(o.id).startsWith('temp')) {
                                          try {
                                            const { error } = await supabase
                                              .from("ata_objetivos")
                                              .update({ data_entrega: valorData })
                                              .eq("id", o.id);
                                            if (error) {
                                              console.error("Erro ao salvar data de entrega:", error);
                                            }
                                          } catch (err) {
                                            console.error("Erro inesperado ao salvar data de entrega:", err);
                                          }
                                        }
                                      }}
                                    />
                                  </label>
                                  
                                  {/* ✅ BOTÃO DE REALOCAR OBJETIVO */}
                                  <div style={{ position: 'relative' }}>
                                    <span
                                      className="icone-share"
                                      title="Realocar objetivo para outra ata"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        buscarAtasDisponiveis(i);
                                      }}
                                      style={{ 
                                        cursor: 'pointer', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                      }}
                                    >
                                      <FontAwesomeIcon icon={faShareFromSquare} style={{ fontSize: '14px', color: '#555' }} />
                                    </span>

                                    {/* Menu flutuante de atas disponíveis */}
                                    {mostrarAtasDisponiveis[i] && (
                                      <div 
                                        className="menu-atas-disponiveis"
                                        style={{
                                          position: 'absolute',
                                          top: '100%',
                                          right: 0,
                                          marginTop: '4px',
                                          background: 'white',
                                          border: '1px solid #ddd',
                                          borderRadius: '6px',
                                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                          minWidth: '220px',
                                          maxWidth: '300px',
                                          maxHeight: '300px',
                                          overflowY: 'auto',
                                          zIndex: 1000,
                                          padding: '8px',
                                        }}
                                      >
                                        <div style={{
                                          padding: '8px',
                                          borderBottom: '1px solid #eee',
                                          marginBottom: '4px',
                                          fontSize: '13px',
                                          fontWeight: '600',
                                          color: '#666',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center'
                                        }}>
                                          <span>Realocar para:</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setMostrarAtasDisponiveis(prev => ({ ...prev, [i]: false }));
                                            }}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              fontSize: '18px',
                                              color: '#999',
                                              padding: '0 4px'
                                            }}
                                          >
                                            ×
                                          </button>
                                        </div>
                                        
                                        {atasDisponiveis.length === 0 ? (
                                          <div style={{
                                            padding: '12px',
                                            textAlign: 'center',
                                            color: '#999',
                                            fontSize: '13px',
                                            fontStyle: 'italic'
                                          }}>
                                            Nenhuma outra ata disponível
                                          </div>
                                        ) : (
                                          atasDisponiveis.map(ata => (
                                            <div
                                              key={ata.ataId}
                                              className="item-ata-disponivel"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Realocar este objetivo para "${ata.nome}"?`)) {
                                                  realocarObjetivo(i, ata.ataId, ata.nome);
                                                }
                                              }}
                                              style={{
                                                padding: '10px',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                transition: 'background 0.2s',
                                                marginBottom: '4px',
                                                fontSize: '13px'
                                              }}
                                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                              <div style={{ fontWeight: '600', color: '#333', marginBottom: '2px' }}>
                                                {ata.nome}
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginBottom: '4px' }}>
                                                {ata.pauta}
                                              </div>
                                              {/* Barra de progresso */}
                                              <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '6px',
                                                marginTop: '6px'
                                              }}>
                                                <div style={{
                                                  flex: 1,
                                                  height: '6px',
                                                  background: '#e5e7eb',
                                                  borderRadius: '3px',
                                                  overflow: 'hidden'
                                                }}>
                                                  <div style={{
                                                    height: '100%',
                                                    width: `${ata.progresso || 0}%`,
                                                    background: ata.progresso >= 75 ? '#10b981' : ata.progresso >= 50 ? '#f59e0b' : '#3b82f6',
                                                    transition: 'width 0.3s ease'
                                                  }} />
                                                </div>
                                                <span style={{ 
                                                  fontSize: '11px', 
                                                  color: '#666',
                                                  minWidth: '35px',
                                                  textAlign: 'right'
                                                }}>
                                                  {ata.progresso || 0}%
                                                </span>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              {isConcluido && (
                                <div style={{ position: "relative" }}>
                                  {isEditing ? (
                                    <div className="comentario-editor">
                                      <textarea
                                        value={comentarioTemp[i] || ""}
                                        onChange={e => setComentarioTemp(prev => ({ ...prev, [i]: e.target.value }))}
                                        placeholder="Descreva como o objetivo foi concluído..."
                                        rows={2}
                                        className="comentario-textarea"
                                      />
                                      {comentarioTemp[i] && (
                                        <div className="comentario-preview">
                                          <small style={{ color: "#666", fontStyle: "italic" }}>
                                            {comentarioComAutorPreview}
                                          </small>
                                        </div>
                                      )}
                                      <div className="comentario-actions">
                                        <button onClick={() => salvarComentario(i)} className="btn-comentario-salvar">
                                          Salvar
                                        </button>
                                        <button onClick={() => cancelarComentario(i)} className="btn-comentario-cancelar">
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <ComentarioIcon
                                      onClick={() => iniciarEdicaoComentario(i, o.comentario)}
                                      title={o.comentario ? "Editar comentário" : "Adicionar comentário"}
                                    />
                                  )}
                                </div>
                              )}

                              {!isConcluido && (
                                <span
                                  className="botao-excluir"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removerObjetivo(i);
                                  }}
                                  style={{ marginLeft: '8px' }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progressoPercent}%` }}></div>
            <span className="progress-percent">{progressoPercent}%</span>
          </div>
        </div>
      )}
    </>
  );
}