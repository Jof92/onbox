// src/components/AtaObjetivos.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";

const VERBOS = [
  "verificar", "quantificar", "viabilizar", "cobrar", "fechar", "iniciar", "definir", "reduzir", "alcançar", "acompanhar", "implementar", "analisar",
  "finalizar", "revisar", "enviar", "agendar", "checar", "executar", "conferir", "monitorar", "organizar", "planejar",
  "solicitar", "providenciar", "designar", "repassar", "avaliar", "confirmar", "documentar", "registrar", "controlar",
  "inspecionar", "medir", "orçar", "nivelar", "concretar", "dimensionar", "instalar", "regularizar", "liberar", "aprovar",
  "adequar", "corrigir", "homologar", "cotar", "negociar", "comprar", "requisitar", "receber", "armazenar", "devolver",
  "auditar", "contratar", "renovar", "pesquisar", "padronizar", "emitir", "rastrear", "autorizar", "buscar", "coletar", "atualizar", "minutar", "montar", "elaborar", "fazer",
  "validar", "orientar", "supervisionar", "delegar", "capacitar", "reportar", "alocar", "resolver", "implantar", "alinhar"
].map(v => v.toLowerCase());

const PREFIXO_EXCLUIDO = "[EXCLUIDO]";

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

const ComentarioIcon = ({ onClick, title }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ cursor: 'pointer' }}
    onClick={onClick}
    title={title}
  >
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

export default function AtaObjetivos({
  ataId,
  texto,
  usuarioId,
  projetoAtual,
  notaAtual,
  projetoNome,
  autorNome,
  onProgressoChange
}) {
  const [criarObjetivos, setCriarObjetivos] = useState(false);
  const [objetivosList, setObjetivosList] = useState([]);
  const [sugestoesResponsavel, setSugestoesResponsavel] = useState({});
  const [editandoComentario, setEditandoComentario] = useState({});
  const [comentarioTemp, setComentarioTemp] = useState({});
  const [meuNome, setMeuNome] = useState("Você");
  const objetivosListRef = useRef(objetivosList);
  const verbosSet = React.useMemo(() => new Set(VERBOS), []);

  useEffect(() => {
    objetivosListRef.current = objetivosList;
  }, [objetivosList]);

  useEffect(() => {
    const fetchMeuNome = async () => {
      if (!usuarioId) return;
      const { data } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", usuarioId)
        .single();
      if (data?.nome) {
        setMeuNome(data.nome);
      }
    };
    fetchMeuNome();
  }, [usuarioId]);

  const carregarObjetivos = useCallback(async () => {
    if (!ataId) {
      setObjetivosList([]);
      return;
    }

    const { data, error } = await supabase
      .from("ata_objetivos")
      .select(`
        *,
        profiles(id, nome)
      `)
      .eq("ata_id", ataId)
      .order("id", { ascending: true });

    if (error) {
      console.error("Erro ao carregar objetivos:", error);
      return;
    }

    const objetivos = (data || []).map((o) => {
      let responsavelNome = o.nome_responsavel_externo || (o.profiles?.nome || "");
      return {
        id: o.id,
        texto: o.texto,
        responsavelId: o.responsavel_id,
        responsavelNome,
        dataEntrega: o.data_entrega,
        concluido: o.concluido || false,
        concluidoEm: o.concluido_em ? new Date(o.concluido_em) : null,
        comentario: o.comentario || "",
      };
    });

    // ✅ Filtra objetivos excluídos
    const ativos = objetivos.filter(o => !o.texto.startsWith(PREFIXO_EXCLUIDO));

    setObjetivosList(ativos);
    setCriarObjetivos(true);
  }, [ataId]);

  useEffect(() => {
    carregarObjetivos();
  }, [carregarObjetivos]);

  // ✅ Efeito corrigido — tratamento seguro de undefined
  useEffect(() => {
    if (!criarObjetivos || !ataId) return;

    const processarObjetivos = async () => {
      const { data: todosObjetivos, error: err } = await supabase
        .from("ata_objetivos")
        .select("texto")
        .eq("ata_id", ataId);

      if (err) {
        console.error("Erro ao buscar objetivos existentes:", err);
        return;
      }

      const textosExistentes = new Set(
        (todosObjetivos || []).map(o => 
          o.texto?.startsWith(PREFIXO_EXCLUIDO)
            ? o.texto.replace(PREFIXO_EXCLUIDO + " ", "")
            : o.texto
        ).filter(Boolean)
      );

      const segmentos = segmentarPorDelimitadores(texto);
      const candidatos = segmentos
        .map(seg => seg.replace(/[,.]$/, "").trim())
        .filter(seg => seg && verbosSet.has(seg.split(/\s+/)[0]?.toLowerCase()))
        .filter(seg => !textosExistentes.has(seg));

      if (candidatos.length === 0) {
        return;
      }

      const inserts = candidatos.map(textoObj => ({
        ata_id: ataId,
        texto: textoObj,
        concluido: false,
        comentario: "",
        data_entrega: null,
        responsavel_id: null,
        concluido_em: null,
      }));

      const {  inseridos, error } = await supabase
        .from("ata_objetivos")
        .insert(inserts)
        .select(`id, ata_id, texto, concluido, comentario, data_entrega, responsavel_id, concluido_em`);

      if (error) {
        console.error("Erro ao salvar novos objetivos:", error);
        return;
      }

      const novos = (inseridos || []).map(item => ({
        id: item.id,
        texto: item.texto,
        responsavelId: item.responsavel_id,
        responsavelNome: "",
        dataEntrega: item.data_entrega,
        concluido: item.concluido,
        concluidoEm: item.concluido_em ? new Date(item.concluido_em) : null,
        comentario: item.comentario,
      }));

      setObjetivosList(prev => [...prev, ...novos]);
    };

    const timer = setTimeout(processarObjetivos, 500);
    return () => clearTimeout(timer);
  }, [texto, criarObjetivos, verbosSet, ataId]);

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
    if (!objetivo?.id || !ataId) return;

    const novoConcluido = !objetivo.concluido;

    if (!novoConcluido && !podeDesmarcarConclusao(objetivo.concluidoEm)) {
      alert("Não é possível desmarcar um objetivo concluído há mais de 24 horas.");
      return;
    }

    const agora = new Date();
    const novosObjetivos = [...objetivosList];
    novosObjetivos[i] = {
      ...objetivo,
      concluido: novoConcluido,
      concluidoEm: novoConcluido ? agora : null,
    };
    setObjetivosList(novosObjetivos);

    try {
      const updateData = {
        concluido: novoConcluido,
        concluido_em: novoConcluido ? agora.toISOString() : null,
      };

      const { error } = await supabase
        .from("ata_objetivos")
        .update(updateData)
        .eq("id", objetivo.id);

      if (error) throw error;

      const novoProgresso = Math.round((novosObjetivos.filter(o => o.concluido).length / novosObjetivos.length) * 100);
      if (typeof onProgressoChange === "function") {
        onProgressoChange(novoProgresso);
      }
      if (notaAtual?.id) {
        const { error: notaError } = await supabase.from("notas").update({ progresso: novoProgresso }).eq("id", notaAtual.id);
        if (notaError) console.error("Erro ao atualizar progresso na nota:", notaError);
      }
    } catch (err) {
      console.error("Erro ao salvar conclusão:", err);
      const revertidos = [...objetivosList];
      revertidos[i] = { ...objetivo };
      setObjetivosList(revertidos);
      alert("Erro ao salvar estado do objetivo.");
    }
  };

  const handleResponsavelChange = (e, i) => {
    const objetivo = objetivosList[i];
    if (objetivo?.concluido) return;

    const v = e.target.value;
    const novos = [...objetivosList];
    novos[i].responsavelNome = v;
    novos[i].responsavelId = null;
    setObjetivosList(novos);

    if (v.startsWith("@") && v.length > 1 && usuarioId) {
      const termo = v.slice(1).toLowerCase();
      const containerId = usuarioId;

      supabase
        .from("convites")
        .select("user_id")
        .eq("container_id", containerId)
        .eq("status", "aceito")
        .then(async ({   convites, error }) => {
          if (error || !convites?.length) {
            setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
            return;
          }

          const userIds = convites.map(c => c.user_id);
          const {   profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, nickname, nome, funcao")
            .in("id", userIds);

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
    const objetivo = objetivosList[i];
    if (objetivo?.concluido) return;

    const novos = [...objetivosList];
    novos[i].responsavelId = item.id;
    novos[i].responsavelNome = item.nickname || item.nome;
    setObjetivosList(novos);
    setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));

    if (objetivo.id) {
      supabase
        .from("ata_objetivos")
        .update({ responsavel_id: item.id })
        .eq("id", objetivo.id)
        .then(({ error }) => {
          if (error) console.error("Erro ao salvar responsável:", error);
        });
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

    if (objetivo?.id) {
      // ✅ Marca como excluído alterando o texto
      const textoExcluido = `${PREFIXO_EXCLUIDO} ${objetivo.texto}`;
      const { error } = await supabase
        .from("ata_objetivos")
        .update({ texto: textoExcluido })
        .eq("id", objetivo.id);

      if (error) {
        console.error("Erro ao marcar objetivo como excluído:", error);
        setObjetivosList(prev => [...prev, objetivo]); // reverter
        alert("Erro ao excluir objetivo.");
      }
    }
  };

  // ✅ Funções de comentário atualizadas
  const iniciarEdicaoComentario = (i, comentarioAtual) => {
    let comentarioPuro = comentarioAtual || "";
    if (comentarioPuro.includes(" — Comentário feito por ")) {
      const ultimaOcorrencia = comentarioPuro.lastIndexOf(" — Comentário feito por ");
      comentarioPuro = comentarioPuro.substring(0, ultimaOcorrencia);
    }
    setEditandoComentario(prev => ({ ...prev, [i]: true }));
    setComentarioTemp(prev => ({ ...prev, [i]: comentarioPuro }));
  };

  const salvarComentario = async (i) => {
    const comentario = comentarioTemp[i] || "";
    const objetivo = objetivosList[i];
    if (!objetivo?.id || !usuarioId) return;

    const comentarioComAutor = `${comentario} — Comentário feito por ${meuNome}`;

    try {
      const { error } = await supabase
        .from("ata_objetivos")
        .update({ 
          comentario: comentarioComAutor,
          comentario_por: usuarioId
        })
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

  return (
    <>
      <div className="ata-section">
        <label className="checkbox-objetivos">
          <input
            type="checkbox"
            checked={criarObjetivos}
            onChange={(e) => {
              const ativar = e.target.checked;
              setCriarObjetivos(ativar);
              if (!ativar) {
                setObjetivosList([]);
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
              const isEditing = editandoComentario[i];
              const isConcluido = o.concluido;
              const podeDesmarcar = podeDesmarcarConclusao(o.concluidoEm);

              // ✅ Mostra "Comentário por [nome]" enquanto digita
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

                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="@Responsável"
                      value={o.responsavelNome}
                      onChange={e => handleResponsavelChange(e, i)}
                      disabled={isConcluido}
                    />
                    {sugestoesResponsavel[i]?.length > 0 && !isConcluido && (
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
                        if (isConcluido) return;
                        const novos = [...objetivosList];
                        novos[i].dataEntrega = e.target.value;
                        setObjetivosList(novos);

                        if (o.id) {
                          supabase
                            .from("ata_objetivos")
                            .update({ data_entrega: e.target.value })
                            .eq("id", o.id)
                            .then(({ error }) => {
                              if (error) console.error("Erro ao salvar ", error);
                            });
                        }
                      }}
                      disabled={isConcluido}
                    />

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
                            {/* ✅ Mostra preview em tempo real */}
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