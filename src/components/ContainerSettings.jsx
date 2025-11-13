// src/components/ContainerSettings.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { FaSave } from "react-icons/fa";
import Loading from "./Loading";
import "./ContainerSettings.css";

export default function ContainerSettings({ onClose, containerId, user }) {
  const [dono, setDono] = useState("");
  const [nomeContainer, setNomeContainer] = useState(""); // ← nome do container = nome do dono
  const [projetos, setProjetos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailGerenteContainer, setEmailGerenteContainer] = useState("");
  const [emailsGerentesCaixa, setEmailsGerentesCaixa] = useState({});

  useEffect(() => {
    if (!containerId) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        // 1. Dono + gerente_container_id
        const { data: perfil, error: donoError } = await supabase
          .from("profiles")
          .select("nome, gerente_container_id")
          .eq("id", containerId)
          .single();
        if (donoError) throw donoError;

        const nomeDono = perfil?.nome || "Desconhecido";
        setDono(nomeDono);
        setNomeContainer(nomeDono); // o "nome do container" é o nome do dono

        // 2. Colaboradores (convites aceitos)
        const { data: convites, error: convitesError } = await supabase
          .from("convites")
          .select("email")
          .eq("remetente_id", containerId)
          .eq("status", "aceito");
        if (convitesError) throw convitesError;

        const emails = convites.map(c => c.email);
        const { data: perfis, error: perfisError } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("email", emails);
        if (perfisError) throw perfisError;
        setColaboradores(perfis || []);

        // 3. Projetos
        const { data: proj, error: projError } = await supabase
          .from("projects")
          .select("id, name, gerente_caixa_id")
          .eq("user_id", containerId);
        if (projError) console.warn("Erro projetos:", projError);
        setProjetos(proj || []);

        // 4. Setores
        const { data: set, error: setError } = await supabase
          .from("setores")
          .select("id, name, gerente_caixa_id")
          .eq("user_id", containerId);
        if (setError) console.warn("Erro setores:", setError);
        setSetores(set || []);

        // Preenche gerente de container
        if (perfil?.gerente_container_id) {
          const gerente = perfis.find(p => p.id === perfil.gerente_container_id);
          setEmailGerenteContainer(gerente?.email || "");
        }

        // Preenche gerentes de caixa (projetos + setores)
        const initialEmails = {};
        [...proj, ...set].forEach(item => {
          if (item.gerente_caixa_id) {
            const gerente = perfis.find(p => p.id === item.gerente_caixa_id);
            initialEmails[item.id] = gerente?.email || "";
          }
        });
        setEmailsGerentesCaixa(initialEmails);
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
        alert("Erro ao carregar configurações do container.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [containerId]);

  const adicionarGerenteContainer = async () => {
    const colab = colaboradores.find(c => c.email === emailGerenteContainer);
    if (!colab) return alert("E-mail não é de um colaborador aceito.");

    // Atualiza o gerente_container_id
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ gerente_container_id: colab.id })
      .eq("id", containerId);

    if (updateError) {
      console.error("Erro ao atualizar gerente de container:", updateError);
      return alert("Erro ao salvar gerente de container.");
    }

    // Cria notificação
    const mensagem = `${dono} nomeou você gerente do container ${nomeContainer}.`;

    const { error: notifError } = await supabase
      .from("notificacoes")
      .insert([
        {
          user_id: colab.id,
          remetente_id: containerId,
          mensagem: mensagem,
          lido: false,
          created_at: new Date().toISOString(),
          tipo: "gerente_container",
        }
      ]);

    if (notifError) {
      console.warn("Notificação não enviada:", notifError);
      // Mesmo sem notificação, o gerente foi salvo
    }

    alert("Gerente de container salvo!");
  };

  const adicionarGerenteCaixa = async (tabela, id, email) => {
    const colab = colaboradores.find(c => c.email === email);
    if (!colab) return alert("E-mail não é de um colaborador aceito.");

    const { error } = await supabase
      .from(tabela)
      .update({ gerente_caixa_id: colab.id })
      .eq("id", id);

    if (error) {
      console.error("Erro ao salvar gerente de caixa:", error);
      return alert("Erro ao salvar gerente.");
    }

    setEmailsGerentesCaixa(prev => ({ ...prev, [id]: email }));
    alert("Gerente salvo!");
  };

  if (loading) {
    return <Loading size={120} />;
  }

  return (
    <div className="container-settings-overlay">
      <div className="container-settings-modal">
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
        <div className="settings-header">
          <h2>Configurações</h2>
        </div>

        {/* Administrador */}
        <div className="perm-section">
          <h3>Administrador</h3>
          <div className="admin-nome">{dono}</div>
        </div>

        {/* Gerente de Container */}
        <div className="perm-section">
          <h3>Gerente de Container</h3>
          <div className="input-group">
            <select
              value={emailGerenteContainer}
              onChange={(e) => setEmailGerenteContainer(e.target.value)}
              className="gerente-select"
            >
              <option value="">Selecione um colaborador</option>
              {colaboradores.map((colab) => (
                <option key={colab.id} value={colab.email}>
                  {colab.nome}
                </option>
              ))}
            </select>
            <button className="save-btn" onClick={adicionarGerenteContainer}>
              <FaSave />
            </button>
          </div>
        </div>

        {/* Projetos */}
        <div className="perm-section">
          <h3>Gerentes de Caixas — Projetos</h3>
          {projetos.length === 0 ? (
            <p>Nenhum projeto</p>
          ) : (
            <div className="caixas-grid">
              {projetos.map((p) => (
                <div key={p.id} className="caixa-card">
                  <div className="caixa-nome">{p.name}</div>
                  <div className="input-group">
                    <select
                      value={emailsGerentesCaixa[p.id] || ""}
                      onChange={(e) =>
                        setEmailsGerentesCaixa((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      className="gerente-select"
                    >
                      <option value="">Selecione</option>
                      {colaboradores.map((colab) => (
                        <option key={colab.id} value={colab.email}>
                          {colab.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      className="save-btn"
                      onClick={() =>
                        adicionarGerenteCaixa("projects", p.id, emailsGerentesCaixa[p.id])
                      }
                    >
                      <FaSave />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Setores */}
        <div className="perm-section">
          <h3>Gerentes de Caixas — Setores</h3>
          {setores.length === 0 ? (
            <p>Nenhum setor</p>
          ) : (
            <div className="caixas-grid">
              {setores.map((s) => (
                <div key={s.id} className="caixa-card">
                  <div className="caixa-nome">{s.name}</div>
                  <div className="input-group">
                    <select
                      value={emailsGerentesCaixa[s.id] || ""}
                      onChange={(e) =>
                        setEmailsGerentesCaixa((prev) => ({
                          ...prev,
                          [s.id]: e.target.value,
                        }))
                      }
                      className="gerente-select"
                    >
                      <option value="">Selecione</option>
                      {colaboradores.map((colab) => (
                        <option key={colab.id} value={colab.email}>
                          {colab.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      className="save-btn"
                      onClick={() =>
                        adicionarGerenteCaixa("setores", s.id, emailsGerentesCaixa[s.id])
                      }
                    >
                      <FaSave />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}