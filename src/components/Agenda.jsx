// src/components/Agenda.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Agenda.css";

const Agenda = ({ user, onClose }) => {
  const [objetivosCompletos, setObjetivosCompletos] = useState(null);
  const [comentariosAgendados, setComentariosAgendados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) {
        setError("Usuário não autenticado.");
        setLoading(false);
        return;
      }

      try {
        // ========== PARTE 1: Carregar objetivos (INALTERADA) ==========
        const { data: responsaveis, error: err1 } = await supabase
          .from("ata_objetivos_responsaveis_enriquecidos")
          .select("ata_objetivo_id")
          .eq("usuario_id", user.id);

        if (err1) throw err1;

        let objetivosCompletos = [];
        if (responsaveis && Array.isArray(responsaveis)) {
          const objetivoIds = responsaveis
            .map(r => r.ata_objetivo_id)
            .filter(id => id != null);

          if (objetivoIds.length > 0) {
            const { data: objetivos, error: err2 } = await supabase
              .from("ata_objetivos")
              .select("id, texto, data_entrega, ata_id, concluido")
              .in("id", objetivoIds)
              .order("data_entrega", { ascending: true });

            if (err2) throw err2;

            if (objetivos && Array.isArray(objetivos)) {
              const ataIds = [...new Set(objetivos.map(o => o.ata_id).filter(id => id != null))];
              let atasMap = {};
              const projetoIds = new Set();
              const pilhaIds = new Set();

              if (ataIds.length > 0) {
                const { data: atas, error: err3 } = await supabase
                  .from("atas")
                  .select("id, pilha, nota, projeto_id")
                  .in("id", ataIds);

                if (err3) throw err3;
                if (Array.isArray(atas)) {
                  atas.forEach(ata => {
                    atasMap[ata.id] = {
                      nota: ata.nota || "Sem nota",
                      pilha_id: ata.pilha,
                      projeto_id: ata.projeto_id,
                    };
                    if (ata.pilha) pilhaIds.add(ata.pilha);
                    if (ata.projeto_id) projetoIds.add(ata.projeto_id);
                  });
                }
              }

              let pilhasMap = {};
              if (pilhaIds.size > 0) {
                const { data: pilhas, error: err4 } = await supabase
                  .from("pilhas")
                  .select("id, title")
                  .in("id", Array.from(pilhaIds));
                if (!err4 && Array.isArray(pilhas)) {
                  pilhasMap = Object.fromEntries(pilhas.map(p => [p.id, p.title]));
                }
              }

              let projetosMap = {};
              const userIdsDonos = new Set();
              if (projetoIds.size > 0) {
                const { data: projects, error: err5 } = await supabase
                  .from("projects")
                  .select("id, name, user_id")
                  .in("id", Array.from(projetoIds));
                if (!err5 && Array.isArray(projects)) {
                  projects.forEach(proj => {
                    projetosMap[proj.id] = {
                      nome: proj.name || "Projeto sem nome",
                      user_id: proj.user_id
                    };
                    if (proj.user_id) userIdsDonos.add(proj.user_id);
                  });
                }
              }

              let donosMap = {};
              if (userIdsDonos.size > 0) {
                const { data: profiles, error: err6 } = await supabase
                  .from("profiles")
                  .select("id, nome, container")
                  .in("id", Array.from(userIdsDonos));
                if (!err6 && Array.isArray(profiles)) {
                  donosMap = Object.fromEntries(
                    profiles.map(p => [p.id, {
                      nomeDono: p.nome || "Usuário",
                      nomeContainer: p.container || p.nome || "Container sem nome"
                    }])
                  );
                }
              }

              objetivosCompletos = objetivos.map(obj => {
                const ata = atasMap[obj.ata_id] || {};
                const projeto = ata.projeto_id ? projetosMap[ata.projeto_id] : null;
                const dono = projeto?.user_id ? donosMap[projeto.user_id] : null;

                return {
                  ...obj,
                  nomeNota: ata.nota,
                  nomePilha: ata.pilha_id ? pilhasMap[ata.pilha_id] || "Pilha não encontrada" : "–",
                  nomeProjeto: projeto ? projeto.nome : "–",
                  nomeDono: dono ? dono.nomeDono : "Sem dono",
                  nomeContainer: dono ? dono.nomeContainer : "Sem container",
                  _chaveNota: obj.ata_id,
                };
              });
            }
          }
        }

        // ========== PARTE 2: Carregar comentários agendados (INALTERADA) ==========
        const { data: comentarios, error: errComentarios } = await supabase
          .from("comentarios")
          .select("id, conteudo, created_at, nota_id, user_id")
          .eq("agendado_por", user.id)
          .order("created_at", { ascending: false });

        if (errComentarios) {
          console.warn("Erro ao carregar comentários agendados:", errComentarios);
        }

        let comentariosCompletos = [];
        if (comentarios && Array.isArray(comentarios) && comentarios.length > 0) {
          const userIdsAutores = [...new Set(comentarios.map(c => c.user_id).filter(id => id))];
          const notaIds = [...new Set(comentarios.map(c => c.nota_id).filter(id => id != null))];

          let autoresMap = {};
          if (userIdsAutores.length > 0) {
            const { data: autores, error: errAutores } = await supabase
              .from("profiles")
              .select("id, nome, nickname")
              .in("id", userIdsAutores);
            if (!errAutores && Array.isArray(autores)) {
              autoresMap = Object.fromEntries(
                autores.map(a => [a.id, a.nickname || a.nome || "Usuário"])
              );
            }
          }

          let notasMap = {};
          const pilhaIdsNotas = new Set();
          if (notaIds.length > 0) {
            const { data: notas, error: errNotas } = await supabase
              .from("notas")
              .select("id, nome, pilha_id")
              .in("id", notaIds);
            if (!errNotas && Array.isArray(notas)) {
              notas.forEach(nota => {
                notasMap[nota.id] = {
                  nome: nota.nome || "Sem título",
                  pilha_id: nota.pilha_id
                };
                if (nota.pilha_id) pilhaIdsNotas.add(nota.pilha_id);
              });
            }
          }

          let pilhasNotasMap = {};
          const projetoIdsDasPilhas = new Set();
          if (pilhaIdsNotas.size > 0) {
            const { data: pilhas, error: errPilhas } = await supabase
              .from("pilhas")
              .select("id, title, project_id")
              .in("id", Array.from(pilhaIdsNotas));
            if (!errPilhas && Array.isArray(pilhas)) {
              pilhas.forEach(p => {
                pilhasNotasMap[p.id] = {
                  title: p.title || "Pilha sem nome",
                  project_id: p.project_id
                };
                if (p.project_id) projetoIdsDasPilhas.add(p.project_id);
              });
            }
          }

          let projetosNotasMap = {};
          if (projetoIdsDasPilhas.size > 0) {
            const { data: projetos, error: errProjetos } = await supabase
              .from("projects")
              .select("id, name")
              .in("id", Array.from(projetoIdsDasPilhas));
            if (!errProjetos && Array.isArray(projetos)) {
              projetosNotasMap = Object.fromEntries(
                projetos.map(p => [p.id, p.name || "Projeto sem nome"])
              );
            }
          }

          comentariosCompletos = comentarios.map(com => {
            const nota = notasMap[com.nota_id] || {};
            const pilha = nota.pilha_id ? pilhasNotasMap[nota.pilha_id] : null;

            return {
              ...com,
              nomeAutor: autoresMap[com.user_id] || "Usuário",
              nomeNota: nota.nome || (com.nota_id ? "Nota não encontrada" : "Sem nota"),
              nomeProjeto: pilha?.project_id
                ? projetosNotasMap[pilha.project_id] || "Projeto não encontrado"
                : "Sem projeto",
              nomePilha: pilha ? pilha.title : "Sem pilha",
              nomeDono: "Não informado",
              nomeContainer: "Não informado",
              _chaveNota: com.nota_id,
            };
          });
        }

        setObjetivosCompletos(objetivosCompletos);
        setComentariosAgendados(comentariosCompletos);
        setError(null);
      } catch (err) {
        console.error("Erro ao carregar agenda:", err);
        setError({
          message: err.message || "Erro desconhecido",
          details: err.details,
          code: err.code,
        });
        setObjetivosCompletos([]);
        setComentariosAgendados([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  };

  const getMonthName = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', { month: 'long' });
  };

  const calcularDiasRestantes = (dateStr) => {
    if (!dateStr) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataAlvo = new Date(dateStr);
    dataAlvo.setHours(0, 0, 0, 0);
    const diffTime = dataAlvo - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const todosItens = [];
  if (objetivosCompletos?.length > 0) {
    objetivosCompletos.forEach(obj => {
      if (obj.data_entrega) {
        todosItens.push({ ...obj, tipo: 'objetivo', data_ref: obj.data_entrega });
      }
    });
  }
  if (comentariosAgendados?.length > 0) {
    comentariosAgendados.forEach(com => {
      if (com.created_at) {
        todosItens.push({ ...com, tipo: 'comentario', data_ref: com.created_at });
      }
    });
  }

  if (todosItens.length === 0 && !loading && !error) {
    return (
      <div className="agenda-modal-overlay" onClick={onClose}>
        <div className="agenda-modal" onClick={(e) => e.stopPropagation()}>
          <div className="agenda-header">
            <h2>📅 Minha Agenda</h2>
            <button className="agenda-close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="agenda-content">
            <p className="agenda-empty">Você não tem itens na agenda.</p>
          </div>
        </div>
      </div>
    );
  }

  todosItens.sort((a, b) => new Date(a.data_ref) - new Date(b.data_ref));

  const itensPorData = {};
  todosItens.forEach(item => {
    const key = normalizeDate(item.data_ref);
    if (!itensPorData[key]) itensPorData[key] = [];
    itensPorData[key].push(item);
  });

  const datasOrdenadas = Object.keys(itensPorData).sort((a, b) => new Date(a) - new Date(b));

  return (
    <div className="agenda-modal-overlay" onClick={onClose}>
      <div className="agenda-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agenda-header">
          <h2>📅 Minha Agenda</h2>
          <button className="agenda-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="agenda-content">
          {loading && <p className="agenda-loading">Carregando sua agenda...</p>}
          {error && (
            <div className="agenda-error">
              <strong>Erro:</strong> {error.message}
              {error.details && <div><strong>Detalhes:</strong> {error.details}</div>}
              {error.code && <div><strong>Código:</strong> {error.code}</div>}
            </div>
          )}

          {!loading && !error && (
            <div>
              {datasOrdenadas.map((dateKey, idx) => {
                const itens = itensPorData[dateKey];
                const data = new Date(dateKey);
                const dia = data.getDate();
                const mesAnterior = idx > 0 ? new Date(datasOrdenadas[idx - 1]) : null;
                const novoMes = !mesAnterior || mesAnterior.getMonth() !== data.getMonth();

                const gruposPorNota = {};
                itens.forEach(item => {
                  const chave = item._chaveNota || `sem_nota_${item.id}`;
                  if (!gruposPorNota[chave]) gruposPorNota[chave] = [];
                  gruposPorNota[chave].push(item);
                });

                return (
                  <div key={dateKey} className="agenda-dia-secao">
                    {novoMes && (
                      <h3 className="agenda-mes-titulo">{getMonthName(dateKey)}</h3>
                    )}
                    <div className="agenda-dia-bloco">
                      <h4 className="agenda-dia-titulo">Dia {dia}</h4>

                      {Object.entries(gruposPorNota).map(([chaveNota, grupo]) => {
                        const itemRef = grupo[0];
                        return (
                          <div key={chaveNota} className="agenda-nota-grupo">
                            <div className="agenda-nota-cabecalho">
                              {itemRef.nomeNota}
                            </div>
                            <div className="agenda-nota-detalhes">
                              {itemRef.nomePilha} • {itemRef.nomeProjeto}{" "}
                              <span>({itemRef.nomeDono} • {itemRef.nomeContainer})</span>
                            </div>

                            {grupo.map(item => {
                              const prazo = item.tipo === 'objetivo' 
                                ? item.data_entrega 
                                : item.created_at;
                              const prazoFormatado = prazo 
                                ? new Date(prazo).toLocaleDateString('pt-BR') 
                                : '–';
                              const diasRestantes = item.tipo === 'objetivo' 
                                ? calcularDiasRestantes(item.data_entrega) 
                                : null;

                              let diasClasse = '';
                              if (diasRestantes !== null) {
                                if (diasRestantes < 0) diasClasse = 'atrasado';
                                else if (diasRestantes === 0) diasClasse = 'hoje';
                                else diasClasse = 'futuro';
                              }

                              return (
                                <div key={`${item.tipo}-${item.id}`} className="agenda-item">
                                  <div className="agenda-item-linha">
                                    <div className="agenda-item-check-wrapper">
                                      <input
                                        type="checkbox"
                                        checked={item.concluido || false}
                                        readOnly
                                        className="agenda-item-check"
                                      />
                                    </div>
                                    <div className={`agenda-item-conteudo ${item.tipo === 'comentario' ? 'comentario' : ''}`}>
                                      {item.tipo === 'objetivo' ? item.texto : `"${item.conteudo}"`}
                                    </div>
                                    <div className="agenda-item-prazo">
                                      {prazoFormatado}
                                      {diasRestantes !== null && (
                                        <span className={`dias-restantes ${diasClasse}`}>
                                          {diasRestantes > 0
                                            ? `+${diasRestantes}d`
                                            : diasRestantes === 0
                                            ? "hoje"
                                            : `${diasRestantes}d`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agenda;