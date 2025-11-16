// AtaObjetivos.jsx
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
          id: objetivoExistente?.id || null,
          texto: segLimpo,
          responsavelId: objetivoExistente?.responsavelId || null,
          responsavelNome: objetivoExistente?.responsavelNome || "",
          dataEntrega: objetivoExistente?.dataEntrega || "",
          concluido: objetivoExistente?.concluido || false,
          comentario: objetivoExistente?.comentario || "",
        });
      }
    }
  }

  return novosObjetivos;
};

// ✅ Ícone SVG de comentário (balão de fala simples)
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
  const [meuNome, setMeuNome] = useState("Você"); // ✅ Novo: nome do usuário logado
  const objetivosListRef = useRef(objetivosList);
  const verbosSet = React.useMemo(() => new Set(VERBOS), []);

  useEffect(() => {
    objetivosListRef.current = objetivosList;
  }, [objetivosList]);

  // ✅ Buscar nome do usuário logado
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

    if (data?.length > 0) {
      const objetivos = data.map((o) => {
        let responsavelNome = "";
        if (o.nome_responsavel_externo) {
          responsavelNome = o.nome_responsavel_externo;
        } else if (o.responsavel_id && o.profiles?.nome) {
          responsavelNome = o.profiles.nome;
        }
        return {
          id: o.id,
          texto: o.texto,
          responsavelId: o.responsavel_id,
          responsavelNome,
          dataEntrega: o.data_entrega,
          concluido: o.concluido || false,
          comentario: o.comentario || "",
        };
      });
      setObjetivosList(objetivos);
      setCriarObjetivos(true);
    } else {
      setCriarObjetivos(false);
      setObjetivosList([]);
    }
  }, [ataId]);

  useEffect(() => {
    carregarObjetivos();
  }, [carregarObjetivos]);

  useEffect(() => {
    if (criarObjetivos) {
      const novos = extrairObjetivos(texto, objetivosListRef.current, verbosSet);
      setObjetivosList(novos);
    }
  }, [texto, criarObjetivos, verbosSet]);

  const progressoPercent = objetivosList.length
    ? Math.round((objetivosList.filter(o => o.concluido).length / objetivosList.length) * 100)
    : 0;

  useEffect(() => {
    if (typeof onProgressoChange === "function") onProgressoChange(progressoPercent);
  }, [progressoPercent, onProgressoChange]);

  const toggleObjetivo = async (i) => {
    const objetivo = objetivosList[i];
    if (!objetivo || !ataId) return;

    const novoConcluido = !objetivo.concluido;
    const novosObjetivos = [...objetivosList];
    novosObjetivos[i] = { ...objetivo, concluido: novoConcluido };
    setObjetivosList(novosObjetivos);

    try {
      const { error } = await supabase
        .from("ata_objetivos")
        .update({ concluido: novoConcluido })
        .eq("id", objetivo.id);

      if (error) throw error;

      const novoProgresso = Math.round((novosObjetivos.filter(o => o.concluido).length / novosObjetivos.length) * 100);
      if (typeof onProgressoChange === "function") {
        onProgressoChange(novoProgresso);
      }
      if (notaAtual?.id) {
        await supabase.from("notas").update({ progresso: novoProgresso }).eq("id", notaAtual.id);
      }
    } catch (err) {
      console.error("Erro ao salvar conclusão:", err);
      const revertidos = [...objetivosList];
      revertidos[i] = { ...objetivo, concluido: !novoConcluido };
      setObjetivosList(revertidos);
      alert("Erro ao salvar estado do objetivo.");
    }
  };

  const handleResponsavelChange = (e, i) => {
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
        .then(async ({  convites, error }) => {
          if (error || !convites?.length) {
            setSugestoesResponsavel(prev => ({ ...prev, [i]: [] }));
            return;
          }

          const userIds = convites.map(c => c.user_id);
          const {  profiles, error: profilesError } = await supabase
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
          console.error("Erro na busca:", err);
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

  const removerObjetivo = (i) => {
    const novos = [...objetivosList];
    novos.splice(i, 1);
    setObjetivosList(novos);
  };

  // ✅ Ao iniciar edição, remove o nome do final
  const iniciarEdicaoComentario = (i, comentarioAtual) => {
    let comentarioPuro = comentarioAtual || "";
    if (comentarioPuro.includes(" — ")) {
      const ultimaOcorrencia = comentarioPuro.lastIndexOf(" — ");
      comentarioPuro = comentarioPuro.substring(0, ultimaOcorrencia);
    }
    setEditandoComentario(prev => ({ ...prev, [i]: true }));
    setComentarioTemp(prev => ({ ...prev, [i]: comentarioPuro }));
  };

  // ✅ Ao salvar, adiciona o nome no final
  const salvarComentario = async (i) => {
    const comentario = comentarioTemp[i] || "";
    const objetivo = objetivosList[i];
    if (!objetivo?.id) return;

    const comentarioComAutor = comentario.includes(" — ")
      ? comentario
      : `${comentario} — ${meuNome}`;

    try {
      const { error } = await supabase
        .from("ata_objetivos")
        .update({ comentario: comentarioComAutor })
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
              if (ativar) {
                const novos = extrairObjetivos(texto, objetivosListRef.current, verbosSet);
                setObjetivosList(novos);
              } else {
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

              return (
                <div
                  key={o.id || i}
                  className={`objetivo-item ${isConcluido ? 'objetivo-concluido' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isConcluido}
                    onChange={() => toggleObjetivo(i)}
                  />
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

                    {/* ✅ Ícone SVG de comentário — só se concluído */}
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

                    {/* ✅ "×" só se NÃO concluído */}
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