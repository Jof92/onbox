// src/components/Agenda.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Agenda.css";

const Agenda = ({ user, onClose }) => {
  const [objetivosCompletos, setObjetivosCompletos] = useState(null);
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
        // 1. Buscar IDs dos objetivos onde o usuário é responsável
        const {  data: responsaveis, error: err1 } = await supabase
          .from("ata_objetivos_responsaveis_enriquecidos")
          .select("ata_objetivo_id")
          .eq("usuario_id", user.id);

        if (err1) throw err1;
        if (!responsaveis || !Array.isArray(responsaveis)) {
          setObjetivosCompletos([]);
          setLoading(false);
          return;
        }

        const objetivoIds = responsaveis
          .map(r => r.ata_objetivo_id)
          .filter(id => id != null);

        if (objetivoIds.length === 0) {
          setObjetivosCompletos([]);
          setLoading(false);
          return;
        }

        // 2. Buscar os objetivos reais
        const {  data: objetivos, error: err2 } = await supabase
          .from("ata_objetivos")
          .select("id, texto, data_entrega, ata_id, concluido")
          .in("id", objetivoIds)
          .order("data_entrega", { ascending: true });

        if (err2) throw err2;
        if (!objetivos || !Array.isArray(objetivos)) {
          setObjetivosCompletos([]);
          setLoading(false);
          return;
        }

        // 3. Buscar atas para obter pilha (UUID), nota e projeto_id
        const ataIds = [...new Set(objetivos.map(o => o.ata_id).filter(id => id != null))];
        if (ataIds.length === 0) {
          setObjetivosCompletos(objetivos.map(o => ({ ...o, nomeNota: "", nomePilha: "–", nomeProjeto: "–" })));
          setLoading(false);
          return;
        }

        const {  data: atas, error: err3 } = await supabase
          .from("atas")
          .select("id, pilha, nota, projeto_id")
          .in("id", ataIds);

        if (err3) throw err3;
        const validAtas = Array.isArray(atas) ? atas : [];

        // Extrair IDs únicos para pilhas e projetos
        const pilhaIds = new Set();
        const projetoIds = new Set();
        const atasMap = {};

        validAtas.forEach(ata => {
          atasMap[ata.id] = {
            nota: ata.nota || "Sem nota",
            pilha_id: ata.pilha,        // agora é UUID
            projeto_id: ata.projeto_id,
          };
          if (ata.pilha) pilhaIds.add(ata.pilha);
          if (ata.projeto_id) projetoIds.add(ata.projeto_id);
        });

        // 4. Buscar nomes das pilhas (pilhas.title)
        let pilhasMap = {};
        if (pilhaIds.size > 0) {
          const {  data: pilhas, error: err4 } = await supabase
            .from("pilhas")
            .select("id, title")
            .in("id", Array.from(pilhaIds));

          if (!err4 && Array.isArray(pilhas)) {
            pilhasMap = Object.fromEntries(pilhas.map(p => [p.id, p.title]));
          }
        }

        // 5. Buscar nomes dos projetos (projects.name)
        let projetosMap = {};
        if (projetoIds.size > 0) {
          const {  data: projects, error: err5 } = await supabase
            .from("projects")
            .select("id, name")
            .in("id", Array.from(projetoIds));

          if (!err5 && Array.isArray(projects)) {
            projetosMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
          }
        }

        // 6. Montar resultado final com nomes
        const resultado = objetivos.map(obj => {
          const ata = atasMap[obj.ata_id] || {};
          return {
            ...obj,
            nomeNota: ata.nota,
            nomePilha: ata.pilha_id ? pilhasMap[ata.pilha_id] || "Pilha não encontrada" : "–",
            nomeProjeto: ata.projeto_id ? projetosMap[ata.projeto_id] || "Projeto não encontrado" : "–",
          };
        });

        setObjetivosCompletos(resultado);
        setError(null);
      } catch (err) {
        console.error("Erro ao carregar agenda:", err);
        setError({
          message: err.message || "Erro desconhecido",
          details: err.details,
          code: err.code,
        });
        setObjetivosCompletos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

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

          {objetivosCompletos && (
            <div>
              {objetivosCompletos.length === 0 ? (
                <p>Você não tem objetivos com data atribuídos.</p>
              ) : (
                objetivosCompletos.map((obj) => (
                  <div
                    key={obj.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "16px",
                      marginBottom: "16px",
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <div><strong>Projeto:</strong> <span style={{ color: "#2b6cb0", fontWeight: "bold" }}>{obj.nomeProjeto}</span></div>
                    <div><strong>Pilha:</strong> {obj.nomePilha}</div>
                    <div><strong>Nota:</strong> {obj.nomeNota}</div>
                    <div style={{ marginTop: "8px", fontWeight: "bold" }}>{obj.texto}</div>
                    <div style={{ marginTop: "6px", fontSize: "0.9em", color: "#4a5568" }}>
                      <strong>Data:</strong> {obj.data_entrega || "–"} •{" "}
                      <strong>Status:</strong> {obj.concluido ? "Concluído" : "Pendente"}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agenda;