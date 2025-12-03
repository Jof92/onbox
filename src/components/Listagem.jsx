// src/components/Listagem.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import "./loader.css";
import { FaPlus, FaTimes, FaPaperPlane } from "react-icons/fa";
import Check from "./Check";
import Loading from "./Loading";

export default function Listagem({ projetoAtual, notaAtual, containerAtual }) {
  const [rows, setRows] = useState([]);
  const [ultimaAlteracao, setUltimaAlteracao] = useState("");
  const [locacoes, setLocacoes] = useState([]);
  const [eaps, setEaps] = useState([]);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState([]);
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("Usuário");
  const [codigoErro, setCodigoErro] = useState(new Set());
  const [setoresContainer, setSetoresContainer] = useState([]);
  const [setorSelecionado, setSetorSelecionado] = useState("");
  const [userIdLogado, setUserIdLogado] = useState("");
  const [statusEnvio, setStatusEnvio] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carrega perfil do usuário logado
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

  // Carrega setores do container atual
  useEffect(() => {
    if (!containerAtual?.id) {
      setSetoresContainer([]);
      return;
    }

    const carregarSetores = async () => {
      try {
        const { data } = await supabase
          .from("setores")
          .select("id, name, nickname")
          .eq("user_id", containerAtual.id)
          .order("nickname");

        setSetoresContainer(data || []);
      } catch (err) {
        console.error("Erro ao carregar setores do container:", err);
        setSetoresContainer([]);
      }
    };

    carregarSetores();
  }, [containerAtual?.id]);

  const registrarAlteracao = (autor = nomeUsuarioLogado) => {
    const agora = new Date();
    setUltimaAlteracao(`${autor} alterou em ${agora.toLocaleDateString()} ${agora.toLocaleTimeString()}`);
  };

  const carregarDadosDoBanco = async () => {
    try {
      if (!projetoAtual?.id || !notaAtual?.id) {
        setRows([{
          codigo: "",
          descricao: "",
          unidade: "",
          quantidade: "",
          locacao: "",
          eap: "",
          fornecedor: "",
          ordem: 1,
        }]);
        return;
      }

      const [{ data: pavimentosData }, { data: eapsData }, { data: unidadesData }, { data: itensSalvos, error: itensErr }] = await Promise.all([
        supabase.from("pavimentos").select("name").eq("project_id", projetoAtual.id),
        supabase.from("eap").select("name").eq("project_id", projetoAtual.id),
        supabase.from("itens").select("unidade"),
        supabase.from("planilha_itens").select("*").eq("nota_id", notaAtual.id).order("ordem", { ascending: true })
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
          enviado_por: item.enviado_por || "Usuário",
          ordem: item.ordem || 0,
        }));
        setRows(mapped);
      } else {
        setRows([{
          codigo: "",
          descricao: "",
          unidade: "",
          quantidade: "",
          locacao: "",
          eap: "",
          fornecedor: "",
          ordem: 1,
        }]);
      }

      registrarAlteracao();
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      alert("Erro ao carregar os dados da lista.");
    }
  };

  // ✅ Carrega rascunho do localStorage ou do banco
  useEffect(() => {
    const carregarRascunhoOuBanco = async () => {
      setLoading(true);

      // Caso não haja nota/projeto, inicializa vazio
      if (!projetoAtual?.id || !notaAtual?.id) {
        setRows([{
          codigo: "",
          descricao: "",
          unidade: "",
          quantidade: "",
          locacao: "",
          eap: "",
          fornecedor: "",
          ordem: 1,
        }]);
        setLoading(false);
        return;
      }

      const draftKey = `listagem_draft_${notaAtual.id}`;
      const draftStr = localStorage.getItem(draftKey);

      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          // Opcional: só restaura se for recente (< 7 dias)
          if (draft.rows && draft.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) {
            setRows(draft.rows);
            setUltimaAlteracao(draft.ultimaAlteracao || "");
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Rascunho inválido, ignorando.");
        }
      }

      // Caso contrário, carrega do banco
      await carregarDadosDoBanco();
      setLoading(false);
    };

    carregarRascunhoOuBanco();
  }, [projetoAtual, notaAtual]);

  // ✅ Salva rascunho no localStorage a cada alteração
  useEffect(() => {
    if (notaAtual?.id && rows.length > 0) {
      const draft = {
        rows,
        ultimaAlteracao,
        timestamp: Date.now(),
      };
      localStorage.setItem(`listagem_draft_${notaAtual.id}`, JSON.stringify(draft));
    }
  }, [rows, ultimaAlteracao, notaAtual?.id]);

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
    const ultimaOrdem = rows.length > 0
      ? Math.max(...rows.map(r => r.ordem || 0))
      : 0;

    const novaLinha = {
      codigo: "",
      descricao: "",
      unidade: "",
      quantidade: "",
      locacao: "",
      eap: "",
      fornecedor: "",
      criado_em: new Date().toISOString(),
      ordem: ultimaOrdem + 1,
    };

    setRows(prev => [...prev, novaLinha]);
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
        await carregarDadosDoBanco();
      }
    }
  };

  const handleSetorChange = (e) => {
    setSetorSelecionado(e.target.value);
  };

  const handleSave = async () => {
    if (!notaAtual?.id || !projetoAtual?.id || !setorSelecionado) {
      alert("Selecione um setor para enviar a listagem.");
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
      const setoresParaEnvio = [setorSelecionado];

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
            direcionar_para: JSON.stringify(setoresParaEnvio),
            ordem: it.ordem,
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
          direcionar_para: JSON.stringify(setoresParaEnvio),
          grupo_envio: grupoEnvio,
          data_envio: dataEnvio,
          enviado_por: remetente,
          criado_em: new Date().toISOString(),
          ordem: it.ordem,
        }));
        const { error } = await supabase.from("planilha_itens").insert(inserts);
        if (error) throw error;
      }

      // ===== NOTIFICAÇÕES =====
      const notificacoesParaInserir = setoresParaEnvio.map(setorId => ({
        user_id: userIdLogado,
        remetente_id: userIdLogado,
        mensagem: `${remetente} enviou a listagem da nota "${notaAtual.nome}"`,
        projeto_id: projetoAtual.id,
        nota_id: notaAtual.id,
        lido: false,
        created_at: new Date().toISOString(),
        tipo: "listagem_enviada"
      }));

      if (notificacoesParaInserir.length > 0) {
        const { error: notifError } = await supabase.from("notificacoes").insert(notificacoesParaInserir);
        if (notifError) {
          console.warn("Erro ao enviar notificações:", notifError);
        }
      }

      // ===== CRIA PILHA "RECEBIDOS" E NOTA ESPELHO =====
      const setorId = setorSelecionado;
      const { data: pilhasRecebidos } = await supabase
        .from("pilhas")
        .select("id")
        .eq("setor_id", setorId)
        .eq("title", "Recebidos")
        .limit(1);

      let pilhaRecebidosId;
      if (!pilhasRecebidos || pilhasRecebidos.length === 0) {
        const { data: novaPilha } = await supabase
          .from("pilhas")
          .insert({ title: "Recebidos", setor_id: setorId })
          .select("id")
          .single();
        pilhaRecebidosId = novaPilha.id;
      } else {
        pilhaRecebidosId = pilhasRecebidos[0].id;
      }

      const { data: notaExistente } = await supabase
        .from("notas")
        .select("id")
        .eq("nome", notaAtual.nome)
        .eq("pilha_id", pilhaRecebidosId)
        .single();

      let notaEspelhoId;
      if (notaExistente) {
        notaEspelhoId = notaExistente.id;
        await supabase
          .from("notas")
          .update({
            projeto_origem_id: projetoAtual.id,
            nota_original_id: notaAtual.id
          })
          .eq("id", notaEspelhoId);
      } else {
        const { data: novaNota } = await supabase
          .from("notas")
          .insert({
            nome: notaAtual.nome,
            tipo: "Lista",
            pilha_id: pilhaRecebidosId,
            projeto_origem_id: projetoAtual.id,
            nota_original_id: notaAtual.id
          })
          .select("id")
          .single();
        notaEspelhoId = novaNota.id;
      }

      const { data: itensOriginais } = await supabase
        .from("planilha_itens")
        .select("*")
        .eq("nota_id", notaAtual.id)
        .order("ordem", { ascending: true });

      if (itensOriginais?.length > 0) {
        await supabase.from("planilha_itens").delete().eq("nota_id", notaEspelhoId);

        const itensParaInserir = itensOriginais.map(item => ({
          projeto_id: projetoAtual.id,
          nota_id: notaEspelhoId,
          pilha_id: pilhaRecebidosId,
          codigo: item.codigo,
          descricao: item.descricao,
          unidade: item.unidade,
          quantidade: item.quantidade,
          locacao: item.locacao,
          eap: item.eap,
          fornecedor: item.fornecedor,
          direcionar_para: item.direcionar_para,
          criado_em: new Date().toISOString(),
          grupo_envio: item.grupo_envio,
          data_envio: item.data_envio,
          enviado_por: item.enviado_por,
          ordem: item.ordem,
        }));

        await supabase.from("planilha_itens").insert(itensParaInserir);
      }

      // ✅ Limpa rascunho após salvar com sucesso
      localStorage.removeItem(`listagem_draft_${notaAtual.id}`);

      setCodigoErro(new Set());
      setSetorSelecionado("");
      await carregarDadosDoBanco();

      setStatusEnvio("sucesso");
      setTimeout(() => setStatusEnvio(null), 2000);
      registrarAlteracao();
    } catch (err) {
      console.error("Erro ao salvar listagem:", err);
      alert("Erro ao salvar lista.");
      setStatusEnvio(null);
    }
  };

  if (loading) {
    return (
      <div className="listagem-card">
        <Loading />
      </div>
    );
  }

  // Inverte apenas para exibição
  const rowsParaExibir = [...rows].reverse();

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
          <select
            value={setorSelecionado}
            onChange={handleSetorChange}
            className="direcionar-para-input"
            style={{ height: "auto", minHeight: "40px" }}
          >
            <option value="">Selecione um setor</option>
            {setoresContainer.map((setor) => (
              <option key={setor.id} value={setor.id}>
                {setor.nickname || setor.name}
              </option>
            ))}
          </select>
        </div>

        <div className="send-action-wrapper">
          <button
            className="send-btn"
            onClick={handleSave}
            disabled={statusEnvio === "enviando" || !setorSelecionado}
          >
            <FaPaperPlane style={{ marginRight: 6 }} /> Enviar
          </button>
          {statusEnvio === "enviando" && <span className="loader-inline"></span>}
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
            {rowsParaExibir.map((row, visualIdx) => {
              const isCriar = row.codigo?.toLowerCase() === "criar";
              const isEditavel = !row.id || (row.data_envio && (Date.now() - new Date(row.data_envio).getTime()) < 60 * 60 * 1000);
              const isLinhaCongelada = !isEditavel;
              const nextRow = rowsParaExibir[visualIdx + 1];
              const isLastInGroup = !nextRow || nextRow.grupo_envio !== row.grupo_envio;

              const indexOriginal = rows.findIndex(r => r.ordem === row.ordem);

              return (
                <React.Fragment key={row.id ?? visualIdx}>
                  <tr className={isLinhaCongelada ? "linha-congelada" : ""}>
                    <td>{row.ordem}</td>
                    <td>
                      <input
                        type="text"
                        value={row.codigo}
                        onChange={(e) => {
                          handleInputChange(indexOriginal, "codigo", e.target.value);
                          if (codigoErro.has(indexOriginal)) {
                            setCodigoErro(prev => {
                              const novo = new Set(prev);
                              novo.delete(indexOriginal);
                              return novo;
                            });
                          }
                        }}
                        onBlur={() => buscarItemPorCodigo(indexOriginal, row.codigo)}
                        onKeyPress={(e) => handleCodigoEnter(e, indexOriginal, row.codigo)}
                        placeholder="Código"
                        disabled={isLinhaCongelada}
                        className={codigoErro.has(indexOriginal) ? "codigo-invalido" : ""}
                      />
                    </td>
                    <td>
                      {isCriar && isEditavel ? (
                        <input
                          type="text"
                          value={row.descricao || ""}
                          onChange={(e) => handleInputChange(indexOriginal, "descricao", e.target.value)}
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
                          onChange={(e) => handleInputChange(indexOriginal, "unidade", e.target.value)}
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
                        onChange={(e) => handleInputChange(indexOriginal, "quantidade", e.target.value)}
                        min="0"
                        step="any"
                        disabled={isLinhaCongelada}
                      />
                    </td>
                    <td>
                      {isEditavel ? (
                        <select
                          value={row.locacao || ""}
                          onChange={(e) => handleInputChange(indexOriginal, "locacao", e.target.value)}
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
                          onChange={(e) => handleInputChange(indexOriginal, "eap", e.target.value)}
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
                            className="remove-btn"
                            onClick={() => removeRow(indexOriginal)}
                          >
                            <FaTimes />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isLastInGroup && visualIdx < rowsParaExibir.length - 1 && (
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