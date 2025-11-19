// src/components/Agenda.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Agenda.css";

const Agenda = ({ user, onClose }) => {
  const [objetivosCompletos, setObjetivosCompletos] = useState(null);
  const [comentariosAgendados, setComentariosAgendados] = useState(null); // ✅ Novo estado
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
        // ========== PARTE 1: Carregar objetivos (original) ==========
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
                };
              });
            }
          }
        }

        // ========== PARTE 2: Carregar comentários agendados ==========
        const { data: comentarios, error: errComentarios } = await supabase
          .from("comentarios")
          .select("id, conteudo, created_at, nota_id, user_id")
          .eq("agendado_por", user.id)
          .order("created_at", { ascending: false });

        if (errComentarios) {
          console.warn("Erro ao carregar comentários agendados:", errComentarios);
          // Não falha totalmente, só ignora
        }

        let comentariosCompletos = [];
        if (comentarios && Array.isArray(comentarios) && comentarios.length > 0) {
          const userIdsAutores = [...new Set(comentarios.map(c => c.user_id).filter(id => id))];
          const notaIds = [...new Set(comentarios.map(c => c.nota_id).filter(id => id))];

          // Carregar perfis dos autores
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

          // Carregar notas para obter projeto_id e nome
          let notasMap = {};
          const projetoIdsNotas = new Set();
          if (notaIds.length > 0) {
            const { data: notas, error: errNotas } = await supabase
              .from("notas")
              .select("id, nome, projeto_id")
              .in("id", notaIds);
            if (!errNotas && Array.isArray(notas)) {
              notas.forEach(nota => {
                notasMap[nota.id] = {
                  nome: nota.nome || "Sem título",
                  projeto_id: nota.projeto_id
                };
                if (nota.projeto_id) projetoIdsNotas.add(nota.projeto_id);
              });
            }
          }

          // Carregar projetos das notas
          let projetosNotasMap = {};
          if (projetoIdsNotas.size > 0) {
            const { data: projetosNotas, error: errProjetos } = await supabase
              .from("projects")
              .select("id, name")
              .in("id", Array.from(projetoIdsNotas));
            if (!errProjetos && Array.isArray(projetosNotas)) {
              projetosNotasMap = Object.fromEntries(
                projetosNotas.map(p => [p.id, p.name || "Projeto sem nome"])
              );
            }
          }

          // Montar lista completa
          comentariosCompletos = comentarios.map(com => ({
            ...com,
            nomeAutor: autoresMap[com.user_id] || "Usuário",
            nomeNota: (notasMap[com.nota_id]?.nome) || "Nota não encontrada",
            nomeProjeto: notasMap[com.nota_id]?.projeto_id
              ? projetosNotasMap[notasMap[com.nota_id].projeto_id] || "Projeto não encontrado"
              : "Sem projeto",
          }));
        }

        // Atualizar estados
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

  // Formata data de comentário
  const formatarDataComentario = (dateString) => {
    const date = new Date(dateString);
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);
    const isSameDay = (d1, d2) =>
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
    const hora = date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (isSameDay(date, hoje)) return `Hoje às ${hora}`;
    if (isSameDay(date, ontem)) return `Ontem às ${hora}`;
    return `em ${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()} às ${hora}`;
  };

  return (
    <div className="agenda-modal-overlay" onClick={onClose}>
      <div className="agenda-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agenda-header">
          <h2>📅 Minha Agenda</h2>
          <button className="agenda-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="agenda-content" style={{ padding: "20px" }}>
          {loading && <p>Carregando sua agenda...</p>}

          {error && (
            <div style={{ color: "#e53e3e", whiteSpace: "pre-wrap" }}>
              <strong>Erro:</strong> {error.message}
              {error.details && <div><strong>Detalhes:</strong> {error.details}</div>}
              {error.code && <div><strong>Código:</strong> {error.code}</div>}
            </div>
          )}

          {!loading && !error && (
            <div>
              {/* Seção: Objetivos */}
              {objetivosCompletos && objetivosCompletos.length > 0 && (
                <>
                  <h3 style={{ marginTop: "0", color: "#2d3748" }}>📌 Meus Objetivos</h3>
                  {objetivosCompletos.map((obj) => (
                    <div
                      key={`objetivo-${obj.id}`}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "16px",
                        marginBottom: "16px",
                        backgroundColor: "#f8fafc",
                      }}
                    >
                      <div><strong>Container:</strong> <span style={{ color: "#7e22ce", fontWeight: "bold" }}>{obj.nomeContainer}</span></div>
                      <div><strong>Dono:</strong> {obj.nomeDono}</div>
                      <div><strong>Projeto:</strong> <span style={{ color: "#2b6cb0", fontWeight: "bold" }}>{obj.nomeProjeto}</span></div>
                      <div><strong>Pilha:</strong> {obj.nomePilha}</div>
                      <div><strong>Nota:</strong> {obj.nomeNota}</div>
                      <div style={{ marginTop: "8px", fontWeight: "bold" }}>{obj.texto}</div>
                      <div style={{ marginTop: "6px", fontSize: "0.9em", color: "#4a5568" }}>
                        <strong>Data:</strong> {obj.data_entrega || "–"} •{" "}
                        <strong>Status:</strong> {obj.concluido ? "Concluído" : "Pendente"}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Seção: Comentários Agendados */}
              {comentariosAgendados && comentariosAgendados.length > 0 && (
                <>
                  <h3 style={{ color: "#2d3748", marginTop: "24px" }}>💬 Comentários Agendados</h3>
                  {comentariosAgendados.map((com) => (
                    <div
                      key={`comentario-${com.id}`}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "16px",
                        marginBottom: "16px",
                        backgroundColor: "#f0fdf4",
                      }}
                    >
                      <div><strong>Projeto:</strong> <span style={{ color: "#2b6cb0" }}>{com.nomeProjeto}</span></div>
                      <div><strong>Nota:</strong> {com.nomeNota}</div>
                      <div><strong>Autor:</strong> {com.nomeAutor}</div>
                      <div style={{ marginTop: "8px", fontStyle: "italic", color: "#4a5568" }}>
                        "{com.conteudo}"
                      </div>
                      <div style={{ marginTop: "6px", fontSize: "0.9em", color: "#718096" }}>
                        {formatarDataComentario(com.created_at)}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Mensagem se nada for encontrado */}
              {(!objetivosCompletos || objetivosCompletos.length === 0) &&
               (!comentariosAgendados || comentariosAgendados.length === 0) && (
                <p>Você não tem itens na agenda.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agenda;