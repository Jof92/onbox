// src/components/Listagem.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import "./loader.css";
import { FaPlus, FaTimes, FaPaperPlane } from "react-icons/fa";
import Check from "./Check";
import Loading from "./Loading"; // Apenas para carregamento inicial

export default function Listagem({ projetoAtual, notaAtual }) {
  const [rows, setRows] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [ultimaAlteracao, setUltimaAlteracao] = useState("");
  const [locacoes, setLocacoes] = useState([]);
  const [eaps, setEaps] = useState([]);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState([]);
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("Usuário");
  const [codigoErro, setCodigoErro] = useState(new Set());
  const [textoAtual, setTextoAtual] = useState("");
  const [sugestoes, setSugestoes] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [posicaoCaret, setPosicaoCaret] = useState(0);
  const [userIdLogado, setUserIdLogado] = useState("");
  const [statusEnvio, setStatusEnvio] = useState(null); // 'enviando', 'sucesso'
  const [loading, setLoading] = useState(true); // Apenas para carregamento inicial

  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome, id")
          .eq("id", user.id)
          .single();

        setNomeUsuarioLogado(profile?.nome || user.email?.split("@")[0] || "Usuário");
        setUserIdLogado(profile?.id || "");
      }
    };
    fetchUserProfile();
  }, []);

  const registrarAlteracao = (autor = nomeUsuarioLogado) => {
    const agora = new Date();
    setUltimaAlteracao(`${autor} alterou em ${agora.toLocaleDateString()} ${agora.toLocaleTimeString()}`);
  };

  const sortRowsByCreatedDesc = (arr) =>
    [...arr].sort((a, b) => {
      const ta = a?.criado_em ? new Date(a.criado_em).getTime() : 0;
      const tb = b?.criado_em ? new Date(b.criado_em).getTime() : 0;
      return tb - ta;
    });

  const carregarDados = async () => {
    setLoading(true);
    try {
      if (!projetoAtual?.id || !notaAtual?.id) {
        setRows(Array.from({ length: 10 }, () => ({
          codigo: "", descricao: "", unidade: "", quantidade: "", locacao: "", eap: "", fornecedor: ""
        })));
        return;
      }

      const [{ data: pavimentosData }, { data: eapsData }, { data: unidadesData }, { data: itensSalvos, error: itensErr }] = await Promise.all([
        supabase.from("pavimentos").select("name").eq("project_id", projetoAtual.id),
        supabase.from("eap").select("name").eq("project_id", projetoAtual.id),
        supabase.from("itens").select("unidade"),
        supabase.from("planilha_itens").select("*").eq("nota_id", notaAtual.id).order("criado_em", { ascending: false })
      ]);

      if (itensErr) throw itensErr;

      setLocacoes(pavimentosData?.map(p => p.name) || []);
      setEaps(eapsData?.map(e => e.name) || []);
      setUnidadesDisponiveis([...new Set(unidadesData?.map(u => u.unidade).filter(Boolean) || [])]);

      if (itensSalvos?.length) {
        const mapped = itensSalvos.map(item => ({
          id: item.id,
          codigo: item.codigo || "",
          descricao: item.descricao || "",
          unidade: item.unidade || "",
          quantidade: item.quantidade || "",
          locacao: item.locacao || "",
          eap: item.eap || "",
          fornecedor: item.fornecedor || "",
          criado_em: item.criado_em || null,
          grupo_envio: item.grupo_envio || "antigo",
          data_envio: item.data_envio || item.criado_em,
          enviado_por: item.enviado_por || "Usuário"
        }));
        setRows(sortRowsByCreatedDesc(mapped));
      } else {
        setRows(Array.from({ length: 10 }, () => ({
          codigo: "", descricao: "", unidade: "", quantidade: "", locacao: "", eap: "", fornecedor: ""
        })));
      }

      registrarAlteracao();
    } catch (err) {
      alert("Erro ao carregar os dados da lista.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoAtual, notaAtual]);

  const buscarItemPorCodigo = async (index, codigo) => {
    if (!codigo?.trim() || codigo.toLowerCase() === "criar") {
      setCodigoErro(prev => {
        const novo = new Set(prev);
        novo.delete(index);
        return novo;
      });
      return;
    }

    try {
      const { data } = await supabase
        .from("itens")
        .select("descricao, unidade")
        .eq("codigo", codigo)
        .maybeSingle();

      const novas = [...rows];
      if (data) {
        novas[index] = { ...novas[index], descricao: data.descricao || "", unidade: data.unidade || "" };
        setCodigoErro(prev => {
          const novo = new Set(prev);
          novo.delete(index);
          return novo;
        });
      } else {
        setCodigoErro(prev => new Set(prev).add(index));
        novas[index] = { ...novas[index], descricao: "", unidade: "" };
      }
      setRows(novas);
      registrarAlteracao();
    } catch (err) {
      setCodigoErro(prev => new Set(prev).add(index));
    }
  };

  const handleInputChange = (index, campo, valor) => {
    const novas = [...rows];
    novas[index][campo] = valor;
    setRows(novas);
    registrarAlteracao();
  };

  const handleCodigoEnter = (e, index, codigo) => {
    if (e.key === "Enter") buscarItemPorCodigo(index, codigo);
  };

  const addRow = () => {
    const novaLinha = { codigo: "", descricao: "", unidade: "", quantidade: "", locacao: "", eap: "", fornecedor: "", criado_em: new Date().toISOString() };
    setRows(prev => sortRowsByCreatedDesc([...prev, novaLinha]));
    registrarAlteracao();
  };

  const removeRow = async (index) => {
    const linha = rows[index];
    setRows(prev => prev.filter((_, i) => i !== index));
    registrarAlteracao();

    if (linha?.id) {
      try {
        const { error } = await supabase.from("planilha_itens").delete().eq("id", linha.id);
        if (error) throw error;
      } catch (err) {
        alert("Erro ao excluir item: " + (err.message || "Erro desconhecido"));
        await carregarDados();
      }
    }
  };

  const extrairMencaoNicknames = (texto) => [...new Set([...texto.matchAll(/@([^\s@]+)/g)].map(m => m[1]))];

  const buscarSugestoes = async (termo) => {
    if (!termo.trim() || !userIdLogado) {
      setSugestoes([]);
      return;
    }

    try {
      const todasSugestoes = [];

      const { data: convites } = await supabase
        .from("convites")
        .select("remetente_id")
        .eq("user_id", userIdLogado)
        .eq("status", "aceito");

      if (convites?.length) {
        const remetenteIds = convites.map(c => c.remetente_id);
        const { data: perfis } = await supabase
          .from("profiles")
          .select("id, nome, nickname")
          .in("id", remetenteIds)
          .ilike("nickname", `%${termo}%`)
          .limit(3);

        todasSugestoes.push(...(perfis?.map(p => ({ id: p.id, tipo: "perfil", display: p.nickname || p.nome })) || []));
      }

      const { data: projetos } = await supabase
        .from("projects")
        .select("id, name, nickname")
        .eq("user_id", userIdLogado)
        .ilike("nickname", `%${termo}%`)
        .limit(3);
      todasSugestoes.push(...(projetos?.map(p => ({ id: p.id, tipo: "projeto", display: p.nickname || p.name })) || []));

      const { data: setores } = await supabase
        .from("setores")
        .select("id, name, nickname")
        .eq("user_id", userIdLogado)
        .ilike("nickname", `%${termo}%`)
        .limit(3);
      todasSugestoes.push(...(setores?.map(s => ({ id: s.id, tipo: "setor", display: s.nickname || s.name })) || []));

      setSugestoes(todasSugestoes);
    } catch (err) {
      setSugestoes([]);
    }
  };

  const inserirMencoes = (sugestao) => {
    const prefixo = textoAtual.substring(0, posicaoCaret);
    const sufixo = textoAtual.substring(posicaoCaret);
    const ultimaArroba = prefixo.lastIndexOf("@");

    if (ultimaArroba === -1) return;

    const novoTexto = prefixo.substring(0, ultimaArroba + 1) + sugestao.display + " " + sufixo;
    setTextoAtual(novoTexto);
    setMostrarSugestoes(false);
    setSugestoes([]);

    setTimeout(() => {
      const input = document.querySelector('.direcionar-para-input');
      if (input) {
        input.focus();
        input.setSelectionRange(novoTexto.length, novoTexto.length);
      }
    }, 0);
  };

  const handleDirecionarParaChange = (e) => {
    const valor = e.target.value;
    setTextoAtual(valor);

    const posicaoCursor = e.target.selectionStart;
    const textoAntesCursor = valor.substring(0, posicaoCursor);
    const ultimaArroba = textoAntesCursor.lastIndexOf("@");

    if (ultimaArroba !== -1) {
      const termo = textoAntesCursor.substring(ultimaArroba + 1).trim();
      if (termo) {
        setPosicaoCaret(posicaoCursor);
        setMostrarSugestoes(true);
        buscarSugestoes(termo);
      } else {
        setMostrarSugestoes(false);
        setSugestoes([]);
      }
    } else {
      setMostrarSugestoes(false);
      setSugestoes([]);
    }
  };

  const handleSave = async () => {
    if (!notaAtual?.id || !projetoAtual?.id) {
      alert("Projeto ou nota não selecionados. Não é possível salvar.");
      return;
    }

    setStatusEnvio("enviando");
    try {
      const grupoEnvio = `envio_${Date.now()}`;
      const dataEnvio = new Date().toISOString();
      const remetente = nomeUsuarioLogado;

      const linhasValidas = rows.filter(r => r.codigo?.trim() || r.descricao?.trim() || r.quantidade);
      const existentes = linhasValidas.filter(r => r.id);
      const novos = linhasValidas.filter(r => !r.id);

      if (existentes.length) {
        await Promise.all(existentes.map(async (it) => {
          const { error } = await supabase.from("planilha_itens").update({
            codigo: it.codigo?.trim() || null,
            descricao: it.descricao || null,
            unidade: it.unidade || null,
            quantidade: it.quantidade ? Number(it.quantidade) : null,
            locacao: it.locacao || null,
            eap: it.eap || null,
            fornecedor: it.fornecedor || null,
            direcionar_para: textoAtual
          }).eq("id", it.id);
          if (error) throw error;
        }));
      }

      if (novos.length) {
        const inserts = novos.map(it => ({
          projeto_id: projetoAtual.id,
          nota_id: notaAtual.id,
          codigo: it.codigo?.trim() || null,
          descricao: it.descricao || null,
          unidade: it.unidade || null,
          quantidade: it.quantidade ? Number(it.quantidade) : null,
          locacao: it.locacao || null,
          eap: it.eap || null,
          fornecedor: it.fornecedor || null,
          direcionar_para: textoAtual,
          grupo_envio: grupoEnvio,
          data_envio: dataEnvio,
          enviado_por: remetente,
          criado_em: new Date().toISOString()
        }));
        const { error } = await supabase.from("planilha_itens").insert(inserts);
        if (error) throw error;
      }

      let notificacoesParaInserir = [];
      if (textoAtual.trim()) {
        const nicknamesMencionados = extrairMencaoNicknames(textoAtual);
        if (nicknamesMencionados.length > 0) {
          const { data: perfis } = await supabase
            .from("profiles")
            .select("id, nickname")
            .in("nickname", nicknamesMencionados);

          if (perfis?.length) {
            const { data: convitesAceitos } = await supabase
              .from("convites")
              .select("remetente_id")
              .eq("user_id", userIdLogado)
              .eq("status", "aceito");

            const remetenteIdsValidos = convitesAceitos?.map(c => c.remetente_id) || [];
            const destinatariosValidos = perfis.filter(p => remetenteIdsValidos.includes(p.id));

            if (destinatariosValidos.length > 0) {
              const mensagemBase = `${remetente} enviou uma atualização da listagem da nota "${notaAtual.nome}" do projeto "${projetoAtual.name}"`;
              notificacoesParaInserir = destinatariosValidos.map(dest => ({
                user_id: dest.id,
                remetente_id: userIdLogado,
                mensagem: mensagemBase,
                projeto_id: projetoAtual.id,
                nota_id: notaAtual.id,
                lido: false,
                created_at: new Date().toISOString(),
                tipo: "menção"
              }));
            }
          }
        }
      }

      if (notificacoesParaInserir.length > 0) {
        const { error: notifError } = await supabase.from("notificacoes").insert(notificacoesParaInserir);
        if (notifError) {
          console.warn("Erro ao enviar notificações:", notifError);
        }
      }

      setCodigoErro(new Set());
      setTextoAtual("");
      await carregarDados();

      setStatusEnvio("sucesso");
      setTimeout(() => setStatusEnvio(null), 2000);

      registrarAlteracao();
    } catch (err) {
      alert("Erro ao salvar lista.");
      setStatusEnvio(null);
    }
  };

  // ✅ Exibe Loading apenas no carregamento inicial
  if (loading) {
    return (
      <div className="listagem-card">
        <Loading />
      </div>
    );
  }

  return (
    <div className="listagem-card">
      <div className="listagem-header-container">
        <div className="listagem-header-titles">
          <span className="project-name">{projetoAtual?.name || "Sem projeto"}</span>
          <div className="sub-info"><span className="nota-name">{notaAtual?.nome || "Sem nota"}</span></div>
        </div>
      </div>

      <div className="action-buttons">
        <button className="add-row-btn" onClick={addRow}><FaPlus /> Adicionar linha</button>

        <div style={{ position: "relative", maxWidth: "300px" }}>
          <input
            type="text"
            className="direcionar-para-input"
            placeholder="Direcionar para (ex: @joao, @projeto_x)"
            value={textoAtual}
            onChange={handleDirecionarParaChange}
            onKeyPress={(e) => {
              if (e.key === "Enter" && mostrarSugestoes && sugestoes.length > 0) {
                e.preventDefault();
                inserirMencoes(sugestoes[0]);
              }
            }}
            onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
          />

          {mostrarSugestoes && sugestoes.length > 0 && (
            <div className="sugestoes-dropdown">
              {sugestoes.map((sug, idx) => (
                <div
                  key={idx}
                  className="sugestao-item"
                  onClick={() => inserirMencoes(sug)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span>{sug.display}</span>
                  <small>({sug.tipo})</small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="send-action-wrapper">
          <button
            className="send-btn"
            onClick={handleSave}
            disabled={statusEnvio === "enviando"}
          >
            <FaPaperPlane style={{ marginRight: 6 }} /> Enviar
          </button>
          {statusEnvio === "enviando" && (
            <span className="loader-inline"></span>
          )}
          {statusEnvio === "sucesso" && <Check />}
        </div>
      </div>

      <div className="listagem-table-wrapper">
        <table className="listagem-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Unid</th>
              <th>Qtd.</th>
              <th>Locação</th>
              <th>EAP</th>
              <th>Fornecedor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isCriar = row.codigo?.toLowerCase() === "criar";
              const isEditavel = !row.id || (row.data_envio && (Date.now() - new Date(row.data_envio).getTime()) < 60 * 60 * 1000);
              const isLinhaCongelada = !isEditavel;
              const currentGroup = row.grupo_envio;
              const nextRow = rows[idx + 1];
              const isLastInGroup = !nextRow || nextRow.grupo_envio !== currentGroup;

              return (
                <React.Fragment key={row.id ?? idx}>
                  <tr className={isLinhaCongelada ? "linha-congelada" : ""}>
                    <td>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        value={row.codigo}
                        onChange={(e) => {
                          handleInputChange(idx, "codigo", e.target.value);
                          if (codigoErro.has(idx)) {
                            setCodigoErro(prev => {
                              const novo = new Set(prev);
                              novo.delete(idx);
                              return novo;
                            });
                          }
                        }}
                        onBlur={() => buscarItemPorCodigo(idx, row.codigo)}
                        onKeyPress={(e) => handleCodigoEnter(e, idx, row.codigo)}
                        placeholder="Código"
                        disabled={isLinhaCongelada}
                        className={codigoErro.has(idx) ? "codigo-invalido" : ""}
                      />
                    </td>
                    <td>
                      {isCriar && isEditavel ? (
                        <input
                          type="text"
                          value={row.descricao || ""}
                          onChange={(e) => handleInputChange(idx, "descricao", e.target.value)}
                          placeholder="Descrição do novo item"
                        />
                      ) : (
                        <span>{row.descricao || ""}</span>
                      )}
                    </td>
                    <td>
                      {isCriar && isEditavel ? (
                        <select
                          value={row.unidade || ""}
                          onChange={(e) => handleInputChange(idx, "unidade", e.target.value)}
                        >
                          <option value="">(selecionar)</option>
                          {unidadesDisponiveis.map((un, i) => (
                            <option key={i} value={un}>{un}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.unidade || ""}</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.quantidade ?? ""}
                        onChange={(e) => handleInputChange(idx, "quantidade", e.target.value)}
                        min="0"
                        step="any"
                        disabled={isLinhaCongelada}
                      />
                    </td>
                    <td>
                      {isEditavel ? (
                        <select
                          value={row.locacao || ""}
                          onChange={(e) => handleInputChange(idx, "locacao", e.target.value)}
                        >
                          <option value="">(selecionar)</option>
                          {locacoes.map((loc, i) => (
                            <option key={i} value={loc}>{loc}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.locacao || ""}</span>
                      )}
                    </td>
                    <td>
                      {isEditavel ? (
                        <select
                          value={row.eap || ""}
                          onChange={(e) => handleInputChange(idx, "eap", e.target.value)}
                        >
                          <option value="">(selecionar)</option>
                          {eaps.map((eap, i) => (
                            <option key={i} value={eap}>{eap}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.eap || ""}</span>
                      )}
                    </td>
                    <td>{row.fornecedor || ""}</td>
                    <td>
                      <div className="button-group">
                        {isEditavel && (
                          <button
                            className="add-supabase-btn"
                            onClick={() => alert("Funcionalidade de adicionar insumo ainda em desenvolvimento")}
                          >
                            <FaPlus />
                          </button>
                        )}
                        {isEditavel && (
                          <button className="remove-btn" onClick={() => removeRow(idx)}>
                            <FaTimes />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isLastInGroup && idx < rows.length - 1 && (
                    <tr className="delimiter-row">
                      <td colSpan="9">
                        <div className="envio-delimiter">
                          Enviado por <strong>{row.enviado_por}</strong> em{" "}
                          {new Date(row.data_envio).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}