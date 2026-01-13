// src/components/AtaObjetivos.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserPlus, faCalendar } from "@fortawesome/free-solid-svg-icons";

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

const extrairObjetivosValidos = (texto, verbosSet) => {
  if (!texto?.trim()) return [];
  const partes = texto.split(/([,.])/);
  const segmentos = [];
  let acumulador = "";
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    if (p === "," || p === ".") {
      acumulador += p;
      segmentos.push(acumulador.trim());
      acumulador = "";
    } else {
      acumulador += p;
    }
  }
  if (acumulador.trim()) segmentos.push(acumulador.trim());
  return segmentos
    .map(seg => seg.replace(/[,.]+$/, "").trim())
    .filter(seg => {
      if (!seg) return false;
      const primeiraPalavra = seg.split(/\s+/)[0].toLowerCase().replace(/[^\wÀ-ÿ]/g, "");
      return verbosSet.has(primeiraPalavra);
    });
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

  return (
    <span className={`chip-responsavel ${isExterno ? 'chip-externo' : ''}`}>
      {nomeExibicao}
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
  const verbosSet = React.useMemo(() => new Set(VERBOS), []);
  const isSaving = useRef(false);

  useEffect(() => {
    const fetchMeuNome = async () => {
      if (!usuarioId) return;
      const { data } = await supabase.from("profiles").select("nome").eq("id", usuarioId).single();
      if (data?.nome) setMeuNome(data.nome);
    };
    fetchMeuNome();
  }, [usuarioId]);

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
      .map(o => ({
        id: o.id,
        texto: o.texto || "",
        responsaveis: respPorObj[o.id] || [],
        dataEntrega: o.data_entrega,
        concluido: o.concluido || false,
        concluidoEm: o.concluido_em ? new Date(o.concluido_em) : null,
        comentario: o.comentario || "",
      }));

    setObjetivosList(objetivos);
    setCriarObjetivos(objetivos.length > 0);
  }, [ataId]);

  useEffect(() => {
    carregarObjetivos();
  }, [carregarObjetivos]);

  useEffect(() => {
    if (!criarObjetivos) return;

    const validos = extrairObjetivosValidos(texto, verbosSet);
    const novosObjetivos = validos.map(txt => {
      const existente = objetivosList.find(o => o.texto === txt && o.id && !String(o.id).startsWith('temp'));
      if (existente) return existente;
      const tempExistente = objetivosList.find(o => o.texto === txt && String(o.id).startsWith('temp'));
      return tempExistente || {
        id: `temp-${Date.now()}-${Math.random()}`,
        texto: txt,
        responsaveis: [],
        dataEntrega: null,
        concluido: false,
        concluidoEm: null,
        comentario: "",
      };
    });

    const textosAtuais = objetivosList.map(o => o.texto).sort();
    const textosNovos = novosObjetivos.map(o => o.texto).sort();
    if (JSON.stringify(textosAtuais) !== JSON.stringify(textosNovos)) {
      setObjetivosList(novosObjetivos);
    }

    if (validos.length > 0) {
      setCriarObjetivos(true);
    }
  }, [texto, criarObjetivos, verbosSet, objetivosList]);

  useEffect(() => {
    if (!ataId || !criarObjetivos) return;

    const timer = setTimeout(async () => {
      if (isSaving.current) return;
      isSaving.current = true;

      try {
        const validos = extrairObjetivosValidos(texto, verbosSet);
        const salvos = new Set(objetivosList
          .filter(o => o.id && !String(o.id).startsWith('temp'))
          .map(o => o.texto));

        const paraInserir = validos.filter(txt => !salvos.has(txt));
        if (paraInserir.length > 0) {
          const inserts = paraInserir.map(txt => ({
            ata_id: ataId,
            texto: txt,
            concluido: false,
            comentario: "",
            data_entrega: null,
            concluido_em: null,
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
                  o.texto === txt && String(o.id).startsWith('temp')
                );
                if (tempIndex !== -1) {
                  atualizado[tempIndex] = { ...atualizado[tempIndex], id: novo.id };
                }
              });
              return atualizado;
            });
          }
        }

        const paraExcluir = objetivosList.filter(o => 
          o.id && !String(o.id).startsWith('temp') && !validos.includes(o.texto)
        );
        for (const o of paraExcluir) {
          await supabase
            .from("ata_objetivos")
            .update({ texto: `${PREFIXO_EXCLUIDO} ${o.texto}` })
            .eq("id", o.id);
        }

      } finally {
        isSaving.current = false;
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [texto, ataId, criarObjetivos, objetivosList, verbosSet]);

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
          <div className="ata-objectives">
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
                <div
                  key={o.id}
                  className={`objetivo-item ${isConcluido ? 'objetivo-concluido' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isConcluido}
                    onChange={() => toggleObjetivo(i)}
                    disabled={isConcluido && !podeDesmarcar}
                  />
                  <span><strong>{numeroObjetivo}</strong> {textoCapitalizado}</span>

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
                        onClick={() => {
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
                      <label
                        className="objetivo-data-entrega"
                        style={{ 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          position: 'relative'
                        }}
                      >
                        {o.dataEntrega ? (
                          <>
                            {new Date(o.dataEntrega).toLocaleDateString('pt-BR')}
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
                        onClick={() => removerObjetivo(i)}
                      >
                        ×
                      </span>
                    )}
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
    </>
  );
}