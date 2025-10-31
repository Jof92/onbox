// src/components/ContainerSettings.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { FaSave } from "react-icons/fa";
import "./ContainerSettings.css";

export default function ContainerSettings({ onClose, containerId, user }) {
  const [dono, setDono] = useState("");
  const [projetos, setProjetos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailGerenteContainer, setEmailGerenteContainer] = useState("");
  const [emailsGerentesCaixa, setEmailsGerentesCaixa] = useState({});

  useEffect(() => {
    if (containerId) fetchAll();
  }, [containerId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1. Dono do container
      const { data: perfil, error: donoError } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", containerId)
        .single();
      if (donoError) throw donoError;
      setDono(perfil?.nome || "Desconhecido");

      // 2. Colaboradores
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

    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  };

  const adicionarGerenteContainer = async () => {
    const colab = colaboradores.find(c => c.email === emailGerenteContainer);
    if (!colab) return alert("E-mail não é de um colaborador.");
    await supabase
      .from("profiles")
      .update({ gerente_container_id: colab.id })
      .eq("id", containerId);
    setEmailGerenteContainer("");
    alert("Gerente de container salvo!");
  };

  const adicionarGerenteCaixa = async (tabela, id, email) => {
    const colab = colaboradores.find(c => c.email === email);
    if (!colab) return alert("E-mail não é de um colaborador.");
    await supabase
      .from(tabela)
      .update({ gerente_caixa_id: colab.id })
      .eq("id", id);
    setEmailsGerentesCaixa(prev => ({ ...prev, [id]: "" }));
    alert("Gerente salvo!");
  };

  if (loading) return (
    <div className="container-settings-overlay">
      <div className="container-settings-modal">Carregando...</div>
    </div>
  );

  return (
    <div className="container-settings-overlay">
      <div className="container-settings-modal">
        <div className="settings-header">
          <h2>Configurações</h2>
          <button className="close-btn" onClick={onClose}>×</button>
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
              onChange={e => setEmailGerenteContainer(e.target.value)}
              className="gerente-select"
            >
              <option value="">Selecione um colaborador</option>
              {colaboradores.map(colab => (
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
              {projetos.map(p => (
                <div key={p.id} className="caixa-card">
                  <div className="caixa-nome">{p.name}</div>
                  <div className="input-group">
                    <select
                      value={emailsGerentesCaixa[p.id] || ""}
                      onChange={e => setEmailsGerentesCaixa(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="gerente-select"
                    >
                      <option value="">Selecione</option>
                      {colaboradores.map(colab => (
                        <option key={colab.id} value={colab.email}>
                          {colab.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      className="save-btn"
                      onClick={() => adicionarGerenteCaixa("projects", p.id, emailsGerentesCaixa[p.id])}
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
              {setores.map(s => (
                <div key={s.id} className="caixa-card">
                  <div className="caixa-nome">{s.name}</div>
                  <div className="input-group">
                    <select
                      value={emailsGerentesCaixa[s.id] || ""}
                      onChange={e => setEmailsGerentesCaixa(prev => ({ ...prev, [s.id]: e.target.value }))}
                      className="gerente-select"
                    >
                      <option value="">Selecione</option>
                      {colaboradores.map(colab => (
                        <option key={colab.id} value={colab.email}>
                          {colab.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      className="save-btn"
                      onClick={() => adicionarGerenteCaixa("setores", s.id, emailsGerentesCaixa[s.id])}
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