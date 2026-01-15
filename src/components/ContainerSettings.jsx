// src/components/ContainerSettings.jsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { FaSave, FaTimes } from "react-icons/fa";
import Loading from "./Loading";
import "./ContainerSettings.css";

export default function ContainerSettings({ onClose, containerId, user }) {
  const [dono, setDono] = useState("");
  const [nomeContainer, setNomeContainer] = useState("");
  const [projetos, setProjetos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailGerenteContainer, setEmailGerenteContainer] = useState("");
  const [emailsGerentesCaixa, setEmailsGerentesCaixa] = useState({});
  const [permissoes, setPermissoes] = useState({});
  const [modalPermissoesAberto, setModalPermissoesAberto] = useState(null);

  // ✅ Fechar com ESC ou clique fora
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (e.target.classList.contains("container-settings-overlay")) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

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
        setNomeContainer(nomeDono);

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

        // Preenche gerentes de caixa
        const initialEmails = {};
        [...proj, ...set].forEach(item => {
          if (item.gerente_caixa_id) {
            const gerente = perfis.find(p => p.id === item.gerente_caixa_id);
            initialEmails[item.id] = gerente?.email || "";
          }
        });
        setEmailsGerentesCaixa(initialEmails);

        // 5. Carregar permissões dos colaboradores
        const permissoesIniciais = {};
        for (const colab of perfis) {
          const { data: permData, error: permError } = await supabase
            .from("permissoes_colaboradores")
            .select("projeto_id, setor_id")
            .eq("colaborador_id", colab.id)
            .eq("container_id", containerId);
          
          if (permError) console.warn("Erro ao carregar permissões:", permError);
          
          permissoesIniciais[colab.id] = {
            projetos: permData?.filter(p => p.projeto_id).map(p => p.projeto_id) || [],
            setores: permData?.filter(p => p.setor_id).map(p => p.setor_id) || []
          };
        }
        setPermissoes(permissoesIniciais);
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

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ gerente_container_id: colab.id })
      .eq("id", containerId);

    if (updateError) {
      console.error("Erro ao atualizar gerente de container:", updateError);
      return alert("Erro ao salvar gerente de container.");
    }

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

  const salvarPermissoes = async (colaboradorId) => {
    try {
      // Remove permissões antigas
      await supabase
        .from("permissoes_colaboradores")
        .delete()
        .eq("colaborador_id", colaboradorId)
        .eq("container_id", containerId);

      // Insere novas permissões
      const novasPermissoes = [];
      
      permissoes[colaboradorId]?.projetos?.forEach(projetoId => {
        novasPermissoes.push({
          colaborador_id: colaboradorId,
          container_id: containerId,
          projeto_id: projetoId,
          setor_id: null
        });
      });

      permissoes[colaboradorId]?.setores?.forEach(setorId => {
        novasPermissoes.push({
          colaborador_id: colaboradorId,
          container_id: containerId,
          projeto_id: null,
          setor_id: setorId
        });
      });

      if (novasPermissoes.length > 0) {
        const { error } = await supabase
          .from("permissoes_colaboradores")
          .insert(novasPermissoes);
        
        if (error) throw error;
      }

      alert("Permissões salvas com sucesso!");
      setModalPermissoesAberto(null);
    } catch (error) {
      console.error("Erro ao salvar permissões:", error);
      alert("Erro ao salvar permissões.");
    }
  };

  const togglePermissao = (colaboradorId, tipo, id) => {
    setPermissoes(prev => {
      const atual = prev[colaboradorId] || { projetos: [], setores: [] };
      const lista = atual[tipo] || [];
      
      const novaLista = lista.includes(id)
        ? lista.filter(item => item !== id)
        : [...lista, id];
      
      return {
        ...prev,
        [colaboradorId]: {
          ...atual,
          [tipo]: novaLista
        }
      };
    });
  };

  if (loading) {
    return <Loading size={120} />;
  }

  return (
    <div className="container-settings-overlay">
      <div className="container-settings-modal">
        <div className="settings-header">
          <h2>Configurações</h2>
          <button
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <FaTimes />
          </button>
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

        {/* Permissões dos Colaboradores */}
        <div className="perm-section">
          <h3>Permissões dos Colaboradores</h3>
          {colaboradores.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666' }}>Nenhum colaborador</p>
          ) : (
            <div className="colaboradores-list">
              {colaboradores.map((colab) => (
                <div key={colab.id} className="colaborador-item">
                  <div className="colaborador-info">
                    <div className="colaborador-avatar">
                      {colab.nome.charAt(0).toUpperCase()}
                    </div>
                    <span className="colaborador-nome">{colab.nome}</span>
                  </div>
                  <button
                    className="permissoes-btn"
                    onClick={() => setModalPermissoesAberto(colab.id)}
                  >
                    Selecionar Permissões
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Permissões Flutuante */}
        {modalPermissoesAberto && (
          <div className="permissoes-modal-overlay" onClick={() => setModalPermissoesAberto(null)}>
            <div className="permissoes-modal" onClick={(e) => e.stopPropagation()}>
              <div className="permissoes-modal-header">
                <h4>Selecionar Permissões</h4>
                <button
                  className="modal-close-btn"
                  onClick={() => setModalPermissoesAberto(null)}
                >
                  <FaTimes />
                </button>
              </div>

              <div className="permissoes-content">
                {/* Projetos */}
                <div className="permissoes-section">
                  <h5>Projetos</h5>
                  {projetos.length === 0 ? (
                    <p className="empty-msg">Nenhum projeto disponível</p>
                  ) : (
                    <div className="checkbox-list">
                      {projetos.map((proj) => (
                        <label key={proj.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={permissoes[modalPermissoesAberto]?.projetos?.includes(proj.id) || false}
                            onChange={() => togglePermissao(modalPermissoesAberto, 'projetos', proj.id)}
                          />
                          <span>{proj.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Setores */}
                <div className="permissoes-section">
                  <h5>Setores</h5>
                  {setores.length === 0 ? (
                    <p className="empty-msg">Nenhum setor disponível</p>
                  ) : (
                    <div className="checkbox-list">
                      {setores.map((setor) => (
                        <label key={setor.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={permissoes[modalPermissoesAberto]?.setores?.includes(setor.id) || false}
                            onChange={() => togglePermissao(modalPermissoesAberto, 'setores', setor.id)}
                          />
                          <span>{setor.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="permissoes-modal-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setModalPermissoesAberto(null)}
                >
                  Cancelar
                </button>
                <button
                  className="save-permissions-btn"
                  onClick={() => salvarPermissoes(modalPermissoesAberto)}
                >
                  <FaSave /> Salvar Permissões
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}