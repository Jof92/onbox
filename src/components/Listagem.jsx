// src/components/Listagem.jsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import "./loader.css";
import { FaTrash, FaPaperPlane, FaComment, FaTimes } from "react-icons/fa";
import { FaMagnifyingGlass } from "react-icons/fa6";
import Check from "./Check";
import Loading from "./Loading";
import BuscaInsumo from "./BuscaInsumo";

export default function Listagem({ projetoAtual, notaAtual, containerAtual, onStatusUpdate, onClose }) {
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

  const [buscaInsumoAberta, setBuscaInsumoAberta] = useState(false);
  const [linhaBuscaAtiva, setLinhaBuscaAtiva] = useState(null);

  const cardRef = useRef(null);
  const [forcarAtualizacao, setForcarAtualizacao] = useState(0);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (onClose && cardRef.current && !cardRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (onClose) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [onClose]);

  // Carrega perfil do usuário logado
  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return;

      const user = data.user;
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("nome, id")
          .eq("id", user.id)
          .single();

        if (profileError) {
          setNomeUsuarioLogado(user.email?.split("@")[0] || "Usuário");
          setUserIdLogado("");
        } else {
          setNomeUsuarioLogado(profile?.nome || user.email?.split("@")[0] || "Usuário");
          setUserIdLogado(profile?.id || "");
        }
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
        const { data, error } = await supabase
          .from("setores")
          .select("id, name, nickname")
          .eq("user_id", containerAtual.id)
          .order("nickname");

        if (error) throw error;
        setSetoresContainer(data || []);
      } catch (err) {
        console.error("Erro ao carregar setores do container:", err);
        setSetoresContainer([]);
      }
    };

    carregarSetores();
  }, [containerAtual?.id]);

  // Carrega locações, EAPs e unidades
  useEffect(() => {
    if (!projetoAtual?.id) {
      setLocacoes([]);
      setEaps([]);
      setUnidadesDisponiveis([]);
      return;
    }

    const carregarReferenciasDoProjeto = async () => {
      try {
        const [pavimentosRes, eapsRes, unidadesRes] = await Promise.all([
          supabase.from("pavimentos").select("name").eq("project_id", projetoAtual.id),
          supabase.from("eap").select("name").eq("project_id", projetoAtual.id),
          supabase.from("itens").select("unidade"),
        ]);

        setLocacoes(pavimentosRes.data?.map(p => p.name) || []);
        setEaps(eapsRes.data?.map(e => e.name) || []);
        setUnidadesDisponiveis([
          ...new Set(unidadesRes.data?.map(u => u.unidade).filter(Boolean) || [])
        ]);
      } catch (err) {
        console.error("Erro ao carregar referências do projeto:", err);
        setLocacoes([]);
        setEaps([]);
        setUnidadesDisponiveis([]);
      }
    };

    carregarReferenciasDoProjeto();
  }, [projetoAtual?.id]);

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
          observacao: "",
          comentario: "",
          ordem: 1,
        }]);
        return;
      }

      const { data: itensRes, error: itensError } = await supabase
        .from("planilha_itens")
        .select("*")
        .eq("nota_id", notaAtual.id)
        .order("ordem", { ascending: true });

      if (itensError) throw itensError;

      if (itensRes?.length) {
        const mapped = itensRes.map(item => ({
          id: item.id,
          codigo: item.codigo || "",
          descricao: item.descricao || "",
          unidade: item.unidade || "",
          quantidade: item.quantidade || "",
          locacao: item.locacao || "",
          eap: item.eap || "",
          observacao: item.observacao || "",
          comentario: item.comentario || "",
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
          observacao: "",
          comentario: "",
          ordem: 1,
        }]);
      }

      registrarAlteracao();
    } catch (err) {
      console.error("Erro ao carregar dados da nota:", err);
      alert("Erro ao carregar os dados da lista.");
    }
  };

  useEffect(() => {
    const carregarRascunhoOuBanco = async () => {
      setLoading(true);

      if (!projetoAtual?.id || !notaAtual?.id) {
        setRows([{
          codigo: "",
          descricao: "",
          unidade: "",
          quantidade: "",
          locacao: "",
          eap: "",
          observacao: "",
          comentario: "",
          ordem: 1,
        }]);
        setLoading(false);
        return;
      }

      await carregarDadosDoBanco();
      setLoading(false);
    };

    carregarRascunhoOuBanco();
  }, [projetoAtual, notaAtual, forcarAtualizacao]);

  // 🔁 POLLING: sincroniza com banco a cada 3s (já funcionará corretamente após correção)
  useEffect(() => {
    if (!notaAtual?.id) return;

    const verificarAtualizacoes = async () => {
      try {
        const { data, error } = await supabase
          .from("planilha_itens")
          .select("id, codigo, descricao, comentario, observacao, quantidade, unidade, locacao, eap")
          .eq("nota_id", notaAtual.id);

        if (error) throw error;

        setRows(prev => prev.map(r => {
          const itemAtualizado = data.find(i => i.id === r.id);
          if (itemAtualizado) {
            return {
              ...r,
              codigo: itemAtualizado.codigo,
              descricao: itemAtualizado.descricao,
              comentario: itemAtualizado.comentario,
              observacao: itemAtualizado.observacao,
              quantidade: itemAtualizado.quantidade,
              unidade: itemAtualizado.unidade,
              locacao: itemAtualizado.locacao,
              eap: itemAtualizado.eap,
            };
          }
          return r;
        }));
      } catch (err) {
        console.error('Erro ao verificar atualizações:', err);
      }
    };

    const interval = setInterval(verificarAtualizacoes, 3000);
    return () => clearInterval(interval);
  }, [notaAtual?.id]);

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
      const { data, error } = await supabase
        .from("itens")
        .select("descricao, unidade")
        .eq("codigo", codigo)
        .maybeSingle();

      if (error) throw error;

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

  const handleObservacaoBlur = (index, valor) => {
    const novas = [...rows];
    novas[index].observacao = valor;
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
      observacao: "",
      comentario: "",
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

      // Atualizar existentes
      if (existentes.length) {
        await Promise.all(existentes.map(async (it) => {
          const { error } = await supabase.from("planilha_itens").update({
            codigo: it.codigo?.trim() || null,
            descricao: it.descricao || null,
            unidade: it.unidade || null,
            quantidade: it.quantidade ? Number(it.quantidade) : null,
            locacao: it.locacao || null,
            eap: it.eap || null,
            observacao: it.observacao || null,
            comentario: it.comentario || null,
            direcionar_para: JSON.stringify(setoresParaEnvio),
            ordem: it.ordem,
          }).eq("id", it.id);
          if (error) throw error;
        }));
      }

      // Inserir novos
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
          observacao: it.observacao || null,
          comentario: it.comentario || null,
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

      // Notificação e pilha "Recebidos"
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

      const setorId = setorSelecionado;
      const { data: pilhasRecebidos, error: pilhasError } = await supabase
        .from("pilhas")
        .select("id")
        .eq("setor_id", setorId)
        .eq("title", "Recebidos")
        .limit(1);

      if (pilhasError) throw pilhasError;

      let pilhaRecebidosId;
      if (!pilhasRecebidos || pilhasRecebidos.length === 0) {
        const { data: novaPilha, error: insertError } = await supabase
          .from("pilhas")
          .insert({ title: "Recebidos", setor_id: setorId })
          .select("id")
          .single();
        if (insertError) throw insertError;
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
        const { data: novaNota, error: notaError } = await supabase
          .from("notas")
          .insert({
            nome: notaAtual.nome,
            tipo: "Lista",
            pilha_id: pilhaRecebidosId,
            projeto_origem_id: projetoAtual.id,
            nota_original_id: notaAtual.id,
            enviada: true,
          })
          .select("id")
          .single();
        if (notaError) throw notaError;
        notaEspelhoId = novaNota.id;
      }

      // Clonar itens para o espelho
      const { data: itensOriginais, error: itensError } = await supabase
        .from("planilha_itens")
        .select("*")
        .eq("nota_id", notaAtual.id)
        .order("ordem", { ascending: true });

      if (itensError) throw itensError;

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
          observacao: item.observacao,
          comentario: item.comentario,
          direcionar_para: item.direcionar_para,
          criado_em: new Date().toISOString(),
          grupo_envio: item.grupo_envio,
          data_envio: item.data_envio,
          enviado_por: item.enviado_por,
          item_original_id: item.id, // ✅ VÍNCULO DIRETO NO BANCO
          ordem: item.ordem,
        }));

        const { data: itensInseridos, error: insertItensError } = await supabase
          .from("planilha_itens")
          .insert(itensParaInserir)
          .select("id, ordem");

        if (insertItensError) throw insertItensError;

        // ✅ NÃO USAMOS MAIS localStorage — vínculo já está no banco
      }

      // Marcar nota original como enviada
      await supabase
        .from("notas")
        .update({ enviada: true })
        .eq("id", notaAtual.id);

      if (onStatusUpdate) {
        onStatusUpdate(notaAtual.id, { enviada: true, respondida: false });
      }

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
      <div className="listagem-card" ref={cardRef}>
        <Loading />
      </div>
    );
  }

  const rowsParaExibir = [...rows].reverse();

  return (
    <div className="listagem-card" ref={cardRef}>
      <div className="listagem-header-container">
        <div className="listagem-header-titles">
          <span className="project-name">{projetoAtual?.name || "Sem projeto"}</span>
          <div className="sub-info"><span className="nota-name">{notaAtual?.nome || "Sem nota"}</span></div>
        </div>
        {onClose && (
          <button
            className="listagem-close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <FaTimes />
          </button>
        )}
      </div>

      <div className="action-buttons">
        <button className="add-row-btn" onClick={addRow}>Nova linha</button>

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
              <th>Unidade</th>
              <th>Quantidade</th>
              <th>Locação</th>
              <th>EAP</th>
              <th>Observação</th>
              <th>Comentário</th>
              <th style={{ width: '40px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rowsParaExibir.map((row, visualIdx) => {
              const isCriar = row.codigo?.toLowerCase() === "criar";
              const foiEnviada = !!row.id && !!row.data_envio;
              const isLinhaCongelada = foiEnviada;
              const podeEditarCodigo = !row.id && !isLinhaCongelada;
              const podeEditarDescricao = isCriar && !isLinhaCongelada;
              const podeEditarDemais = !row.id && !isLinhaCongelada;

              const nextRow = rowsParaExibir[visualIdx + 1];
              const isLastInGroup = !nextRow || nextRow.grupo_envio !== row.grupo_envio;
              const indexOriginal = rows.findIndex(r => r.ordem === row.ordem);

              return (
                <React.Fragment key={row.id ?? visualIdx}>
                  <tr className={isLinhaCongelada ? "linha-congelada" : ""}>
                    <td>{row.ordem}</td>
                    <td>
                      {podeEditarCodigo ? (
                        <div className="codigo-com-lupa">
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
                            onBlur={() => !isCriar && buscarItemPorCodigo(indexOriginal, row.codigo)}
                            onKeyPress={(e) => !isCriar && handleCodigoEnter(e, indexOriginal, row.codigo)}
                            placeholder="Código"
                            className={codigoErro.has(indexOriginal) ? "codigo-invalido" : ""}
                          />
                          <button
                            type="button"
                            className="lupa-busca-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLinhaBuscaAtiva(indexOriginal);
                              setBuscaInsumoAberta(true);
                            }}
                            title="Buscar insumo"
                          >
                            <FaMagnifyingGlass />
                          </button>
                        </div>
                      ) : (
                        <span>{row.codigo || ""}</span>
                      )}
                    </td>
                    <td>
                      {podeEditarDescricao ? (
                        <input className="descri"
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
                      {podeEditarDemais && isCriar ? (
                        <select
                          value={row.unidade || ""}
                          onChange={(e) => handleInputChange(indexOriginal, "unidade", e.target.value)}
                        >
                          <option value=""></option>
                          {unidadesDisponiveis.map((un, i) => (
                            <option key={i} value={un}>{un}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.unidade || ""}</span>
                      )}
                    </td>
                    <td>
                      {podeEditarDemais ? (
                        <input
                          type="number"
                          value={row.quantidade ?? ""}
                          onChange={(e) => handleInputChange(indexOriginal, "quantidade", e.target.value)}
                          min="0"
                          step="any"
                        />
                      ) : (
                        <span>{row.quantidade || ""}</span>
                      )}
                    </td>
                    <td>
                      {podeEditarDemais ? (
                        <select
                          value={row.locacao || ""}
                          onChange={(e) => handleInputChange(indexOriginal, "locacao", e.target.value)}
                        >
                          <option value=""></option>
                          {locacoes.map((loc, i) => (
                            <option key={i} value={loc}>{loc}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.locacao || ""}</span>
                      )}
                    </td>
                    <td>
                      {podeEditarDemais ? (
                        <select
                          value={row.eap || ""}
                          onChange={(e) => handleInputChange(indexOriginal, "eap", e.target.value)}
                        >
                          <option value=""></option>
                          {eaps.map((eap, i) => (
                            <option key={i} value={eap}>{eap}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{row.eap || ""}</span>
                      )}
                    </td>
                    <td>
                      {podeEditarDemais ? (
                        <textarea
                          value={row.observacao || ""}
                          onChange={(e) => {
                            const novas = [...rows];
                            novas[indexOriginal].observacao = e.target.value;
                            setRows(novas);
                          }}
                          onBlur={(e) => handleObservacaoBlur(indexOriginal, e.target.value)}
                          className="observacao-textarea"
                          rows="1"
                        />
                      ) : (
                        <div className="observacao-rendered">
                          {row.observacao || ""}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="observacao-rendered">
                        {row.comentario || ""}
                      </div>
                    </td>
                    <td>
                      <div className="button-group">
                        {podeEditarDemais && (
                          <FaTrash
                            className="delete-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRow(indexOriginal);
                            }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>

                  {isLastInGroup && visualIdx < rowsParaExibir.length - 1 && (
                    <tr className="delimiter-row">
                      <td colSpan="10">
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

      <BuscaInsumo
        isOpen={buscaInsumoAberta}
        onClose={() => {
          setBuscaInsumoAberta(false);
          setLinhaBuscaAtiva(null);
        }}
        onSelect={(codigo) => {
          if (linhaBuscaAtiva !== null) {
            handleInputChange(linhaBuscaAtiva, "codigo", codigo);
            buscarItemPorCodigo(linhaBuscaAtiva, codigo);
          }
          setBuscaInsumoAberta(false);
          setLinhaBuscaAtiva(null);
        }}
      />
    </div>
  );
}