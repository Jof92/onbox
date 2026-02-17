// src/components/Listagem.jsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./Listagem.css";
import "./loader.css";
import { FaTrash, FaPaperPlane, FaComment, FaTimes, FaFilter } from "react-icons/fa";
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

  // ✅ Informações de geração e envio da listagem (da nota)
  const [infoGerador, setInfoGerador] = useState(null);   // { nome, data }
  const [infoEnvio, setInfoEnvio] = useState(null);       // { nome, data }
  const [infoRespondido, setInfoRespondido] = useState(null); // { nome }
  const [listagemEnviada, setListagemEnviada] = useState(false);

  const [buscaInsumoAberta, setBuscaInsumoAberta] = useState(false);
  const [linhaBuscaAtiva, setLinhaBuscaAtiva] = useState(null);

  // Estado para dropdown de edição
  const [dropdownAberto, setDropdownAberto] = useState(null);
  const dropdownRef = useRef(null);

  // ✅ Estado para tooltip de visualização (pós-envio)
  const [tooltipVisualizacao, setTooltipVisualizacao] = useState(null);
  const tooltipRef = useRef(null);

  // ✅ Filtros
  const [filtros, setFiltros] = useState({ locacao: "", eap: "" });
  const [filtroAbertoCol, setFiltroAbertoCol] = useState(null); // "quantidade" | "locacao" | "eap"
  const filtroRef = useRef(null);

  const cardRef = useRef(null);
  const notaCarregadaRef = useRef(null); // 🔒 Evita recarregar a mesma nota
  const [forcarAtualizacao, setForcarAtualizacao] = useState(0);

  // 🔑 Função auxiliar para chave única de rascunho
  const getRascunhoKey = () => `rascunho_listagem_${projetoAtual?.id}_${notaAtual?.id}`;

  // Fechar dropdown de locação ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAberto(null);
      }
    };
    if (dropdownAberto !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownAberto]);

  // Fechar tooltip de visualização ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setTooltipVisualizacao(null);
      }
    };
    if (tooltipVisualizacao !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [tooltipVisualizacao]);

  // Fechar painel de filtro ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filtroRef.current && !filtroRef.current.contains(e.target)) {
        setFiltroAbertoCol(null);
      }
    };
    if (filtroAbertoCol !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [filtroAbertoCol]);

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
          locacao: [],
          eap: "",
          observacao: "",
          comentario: "",
          ordem: 1,
        }]);
        return;
      }

      // ✅ Carregar dados da nota (gerador + envio + respondido)
      const { data: notaData } = await supabase
        .from("notas")
        .select("enviada, data_envio, enviado_por_nome, created_at, created_by, respondida, respondido_por_nome")
        .eq("id", notaAtual.id)
        .single();

      if (notaData) {
        setListagemEnviada(!!notaData.enviada);

        // Buscar nome do criador via profiles
        let nomeGerador = null;
        if (notaData.created_by) {
          const { data: perfilCriador } = await supabase
            .from("profiles")
            .select("nome")
            .eq("id", notaData.created_by)
            .single();
          nomeGerador = perfilCriador?.nome || null;
        }

        setInfoGerador(nomeGerador
          ? { nome: nomeGerador, data: notaData.created_at }
          : null
        );
        setInfoEnvio(notaData.enviada && notaData.enviado_por_nome
          ? { nome: notaData.enviado_por_nome, data: notaData.data_envio }
          : null
        );
        setInfoRespondido(notaData.respondida && notaData.respondido_por_nome
          ? { nome: notaData.respondido_por_nome }
          : null
        );
      }

      const { data: itensRes, error: itensError } = await supabase
        .from("planilha_itens")
        .select("*")
        .eq("nota_id", notaAtual.id)
        .order("ordem", { ascending: true });

      if (itensError) throw itensError;

      if (itensRes?.length) {
        const mapped = itensRes.map(item => {
          let locacaoArray = [];
          try {
            if (typeof item.locacao === 'string') {
              const parsed = JSON.parse(item.locacao);
              if (Array.isArray(parsed)) {
                locacaoArray = parsed;
              } else {
                locacaoArray = item.locacao ? [item.locacao] : [];
              }
            } else if (Array.isArray(item.locacao)) {
              locacaoArray = item.locacao;
            } else if (item.locacao != null) {
              locacaoArray = [String(item.locacao)];
            }
          } catch (e) {
            locacaoArray = item.locacao ? [String(item.locacao)] : [];
          }

          return {
            id: item.id,
            codigo: item.codigo || "",
            descricao: item.descricao || "",
            unidade: item.unidade || "",
            quantidade: item.quantidade || "",
            locacao: locacaoArray,
            eap: item.eap || "",
            observacao: item.observacao || "",
            comentario: item.comentario || "",
            criado_em: item.criado_em || null,
            grupo_envio: item.grupo_envio || "antigo",
            data_envio: item.data_envio || item.criado_em,
            enviado_por: item.enviado_por || "Usuário",
            ordem: item.ordem || 0,
          };
        });
        setRows(mapped);
      } else {
        setRows([{
          codigo: "",
          descricao: "",
          unidade: "",
          quantidade: "",
          locacao: [],
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

  // ✅ SALVAR RASCUNHO AUTOMATICAMENTE
  useEffect(() => {
    if (!projetoAtual?.id || !notaAtual?.id || loading || listagemEnviada) return;

    const key = getRascunhoKey();
    const rascunho = rows.filter(r =>
      r.codigo?.trim() || r.descricao?.trim() || (r.quantidade && r.quantidade.toString().trim())
    );
    if (rascunho.length > 0) {
      localStorage.setItem(key, JSON.stringify(rascunho));
    } else {
      localStorage.removeItem(key);
    }
  }, [rows, projetoAtual?.id, notaAtual?.id, loading, listagemEnviada]);

  // ✅ CARREGAR RASCUNHO OU DO BANCO
  useEffect(() => {
    const carregarRascunhoOuBanco = async () => {
      // 🔒 Se a nota já foi carregada e não foi forçada atualização, não recarrega
      const chaveAtual = `${projetoAtual?.id}_${notaAtual?.id}`;
      if (notaCarregadaRef.current === chaveAtual && forcarAtualizacao === 0) return;

      setLoading(true);

      if (!projetoAtual?.id || !notaAtual?.id) {
        setRows([{
          codigo: "",
          descricao: "",
          unidade: "",
          quantidade: "",
          locacao: [],
          eap: "",
          observacao: "",
          comentario: "",
          ordem: 1,
        }]);
        setLoading(false);
        return;
      }

      // Verificar se já foi enviada antes de checar rascunho
      const { data: notaCheck } = await supabase
        .from("notas")
        .select("enviada")
        .eq("id", notaAtual.id)
        .single();

      if (notaCheck?.enviada) {
        // Se enviada, nunca usar rascunho — carregar direto do banco
        await carregarDadosDoBanco();
        notaCarregadaRef.current = `${projetoAtual?.id}_${notaAtual?.id}`;
        setLoading(false);
        return;
      }

      const key = getRascunhoKey();
      const rascunhoSalvo = localStorage.getItem(key);

      if (rascunhoSalvo) {
        try {
          const parsed = JSON.parse(rascunhoSalvo);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const withArrayLocacao = parsed.map(r => ({
              ...r,
              locacao: Array.isArray(r.locacao) ? r.locacao : (r.locacao ? [r.locacao] : []),
            }));
            setRows(withArrayLocacao);
            registrarAlteracao("Rascunho local");
            notaCarregadaRef.current = `${projetoAtual?.id}_${notaAtual?.id}`;
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Rascunho corrompido, ignorando.", e);
          localStorage.removeItem(key);
        }
      }

      await carregarDadosDoBanco();
      notaCarregadaRef.current = `${projetoAtual?.id}_${notaAtual?.id}`;
      setLoading(false);
    };

    carregarRascunhoOuBanco();
  }, [projetoAtual?.id, notaAtual?.id, forcarAtualizacao]);

  // 🔁 POLLING: sincroniza com banco a cada 3s
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
            let locacaoArray = [];
            try {
              if (typeof itemAtualizado.locacao === 'string') {
                const parsed = JSON.parse(itemAtualizado.locacao);
                if (Array.isArray(parsed)) {
                  locacaoArray = parsed;
                } else {
                  locacaoArray = itemAtualizado.locacao ? [itemAtualizado.locacao] : [];
                }
              } else if (Array.isArray(itemAtualizado.locacao)) {
                locacaoArray = itemAtualizado.locacao;
              } else if (itemAtualizado.locacao != null) {
                locacaoArray = [String(itemAtualizado.locacao)];
              }
            } catch (e) {
              locacaoArray = itemAtualizado.locacao ? [String(itemAtualizado.locacao)] : [];
            }

            return {
              ...r,
              codigo: itemAtualizado.codigo,
              descricao: itemAtualizado.descricao,
              comentario: itemAtualizado.comentario,
              observacao: itemAtualizado.observacao,
              quantidade: itemAtualizado.quantidade,
              unidade: itemAtualizado.unidade,
              locacao: locacaoArray,
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

  const handleLocacaoChange = (index, valor, checked) => {
    const novas = [...rows];
    const locacoesAtuais = [...novas[index].locacao];

    if (checked) {
      if (!locacoesAtuais.includes(valor)) {
        locacoesAtuais.push(valor);
      }
    } else {
      const idx = locacoesAtuais.indexOf(valor);
      if (idx !== -1) {
        locacoesAtuais.splice(idx, 1);
      }
    }

    novas[index].locacao = locacoesAtuais;
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
    if (listagemEnviada) return;

    const ultimaOrdem = rows.length > 0
      ? Math.max(...rows.map(r => r.ordem || 0))
      : 0;

    const novaLinha = {
      codigo: "",
      descricao: "",
      unidade: "",
      quantidade: "",
      locacao: [],
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
    if (listagemEnviada) return;

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
            locacao: it.locacao && it.locacao.length > 0 ? JSON.stringify(it.locacao) : null,
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
          locacao: it.locacao && it.locacao.length > 0 ? JSON.stringify(it.locacao) : null,
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
          .insert({
            title: "Recebidos",
            setor_id: setorId,
            ordem: 0
          })
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
            nota_original_id: notaAtual.id,
            data_envio: dataEnvio,
            enviado_por_id: userIdLogado,
            enviado_por_nome: remetente,
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
            data_envio: dataEnvio,
            enviado_por_id: userIdLogado,
            enviado_por_nome: remetente,
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

        const itensParaInserir = itensOriginais.map(item => {
          let locacaoArray = [];
          try {
            if (typeof item.locacao === 'string') {
              const parsed = JSON.parse(item.locacao);
              if (Array.isArray(parsed)) locacaoArray = parsed;
              else locacaoArray = item.locacao ? [item.locacao] : [];
            } else if (Array.isArray(item.locacao)) {
              locacaoArray = item.locacao;
            } else if (item.locacao != null) {
              locacaoArray = [String(item.locacao)];
            }
          } catch (e) {
            locacaoArray = item.locacao ? [String(item.locacao)] : [];
          }

          return {
            projeto_id: projetoAtual.id,
            nota_id: notaEspelhoId,
            pilha_id: pilhaRecebidosId,
            codigo: item.codigo,
            descricao: item.descricao,
            unidade: item.unidade,
            quantidade: item.quantidade,
            locacao: locacaoArray.length > 0 ? JSON.stringify(locacaoArray) : null,
            eap: item.eap,
            observacao: item.observacao,
            comentario: item.comentario,
            direcionar_para: item.direcionar_para,
            criado_em: new Date().toISOString(),
            grupo_envio: item.grupo_envio,
            data_envio: item.data_envio,
            enviado_por: item.enviado_por,
            item_original_id: item.id,
            ordem: item.ordem,
          };
        });

        const { error: insertItensError } = await supabase
          .from("planilha_itens")
          .insert(itensParaInserir)
          .select("id, ordem");

        if (insertItensError) throw insertItensError;
      }

      // Marcar nota original como enviada + gravar enviado_por_nome e data_envio
      await supabase
        .from("notas")
        .update({
          enviada: true,
          enviado_por_nome: remetente,
          enviado_por_id: userIdLogado,
          data_envio: dataEnvio,
        })
        .eq("id", notaAtual.id);

      if (onStatusUpdate) {
        onStatusUpdate(notaAtual.id, { enviada: true, respondida: false });
      }

      // ✅ Atualizar estado local de envio
      setListagemEnviada(true);
      setInfoEnvio({ nome: remetente, data: dataEnvio });

      setCodigoErro(new Set());
      setSetorSelecionado("");

      localStorage.removeItem(getRascunhoKey());

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

  // ✅ Formata data para exibição
  const formatarData = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ✅ Valores únicos para filtros
  const valoresUnicos = (campo) => {
    const set = new Set();
    rows.forEach(r => {
      if (campo === "locacao") {
        (r.locacao || []).forEach(l => l && set.add(l));
      } else if (campo === "eap") {
        if (r.eap) set.add(r.eap);
      } else if (campo === "quantidade") {
        if (r.quantidade !== "" && r.quantidade != null) set.add(String(r.quantidade));
      }
    });
    return [...set].sort();
  };

  // ✅ Aplicar filtros nas linhas
  const rowsFiltradas = rows.filter(r => {
    if (filtros.locacao && !(r.locacao || []).includes(filtros.locacao)) return false;
    if (filtros.eap && r.eap !== filtros.eap) return false;
    return true;
  });

  const temFiltroAtivo = filtros.locacao || filtros.eap;

  if (loading) {
    return (
      <div className="listagem-card" ref={cardRef}>
        <Loading />
      </div>
    );
  }

  const rowsParaExibir = [...rowsFiltradas].reverse();

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

      {/* ✅ Barra de info: gerador, envio e respondido */}
      <div className="listagem-info-bar">
        {(infoGerador || infoEnvio) ? (
          <span>
            {infoGerador && (
              <>Gerado por <strong>{infoGerador.nome}</strong></>
            )}
            {infoEnvio && (
              <> e enviado por <strong>{infoEnvio.nome}</strong> em {formatarData(infoEnvio.data)}</>
            )}
            {infoRespondido && (
              <> — Respondido por <strong>{infoRespondido.nome}</strong></>
            )}
          </span>
        ) : null}
      </div>

      {/* ✅ Botões de ação — ocultos se enviada */}
      {!listagemEnviada && (
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
      )}

      {/* ✅ Filtros ativos */}
      {temFiltroAtivo && (
        <div className="filtros-ativos-bar">
        {filtros.locacao && (
            <span className="filtro-tag">
              Locação: {filtros.locacao}
              <button onClick={() => setFiltros(f => ({ ...f, locacao: "" }))}>×</button>
            </span>
          )}
          {filtros.eap && (
            <span className="filtro-tag">
              EAP: {filtros.eap}
              <button onClick={() => setFiltros(f => ({ ...f, eap: "" }))}>×</button>
            </span>
          )}
          <button
            className="filtro-limpar-todos"
            onClick={() => setFiltros({ locacao: "", eap: "" })}
          >
            Limpar filtros
          </button>
        </div>
      )}

      <div className="listagem-table-wrapper">
        <table className="listagem-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Unidade</th>

              <th className="quantidade-pavimento-header">Qnt/pav</th>

              {/* ✅ Locação com filtro */}
              <th className="th-filtro">
                <span>Locação</span>
                <button
                  className={`filtro-icone-btn ${filtros.locacao ? "filtro-ativo" : ""}`}
                  onClick={() => setFiltroAbertoCol(filtroAbertoCol === "locacao" ? null : "locacao")}
                  title="Filtrar locação"
                >
                  <FaFilter size={10} />
                </button>
                {filtroAbertoCol === "locacao" && (
                  <div ref={filtroRef} className="filtro-dropdown">
                    <div
                      className={`filtro-option ${filtros.locacao === "" ? "filtro-option-selected" : ""}`}
                      onClick={() => { setFiltros(f => ({ ...f, locacao: "" })); setFiltroAbertoCol(null); }}
                    >
                      Todos
                    </div>
                    {valoresUnicos("locacao").map(v => (
                      <div
                        key={v}
                        className={`filtro-option ${filtros.locacao === v ? "filtro-option-selected" : ""}`}
                        onClick={() => { setFiltros(f => ({ ...f, locacao: v })); setFiltroAbertoCol(null); }}
                      >
                        {v}
                      </div>
                    ))}
                  </div>
                )}
              </th>

              {/* ✅ EAP com filtro */}
              <th className="th-filtro">
                <span>EAP</span>
                <button
                  className={`filtro-icone-btn ${filtros.eap ? "filtro-ativo" : ""}`}
                  onClick={() => setFiltroAbertoCol(filtroAbertoCol === "eap" ? null : "eap")}
                  title="Filtrar EAP"
                >
                  <FaFilter size={10} />
                </button>
                {filtroAbertoCol === "eap" && (
                  <div ref={filtroRef} className="filtro-dropdown">
                    <div
                      className={`filtro-option ${filtros.eap === "" ? "filtro-option-selected" : ""}`}
                      onClick={() => { setFiltros(f => ({ ...f, eap: "" })); setFiltroAbertoCol(null); }}
                    >
                      Todos
                    </div>
                    {valoresUnicos("eap").map(v => (
                      <div
                        key={v}
                        className={`filtro-option ${filtros.eap === v ? "filtro-option-selected" : ""}`}
                        onClick={() => { setFiltros(f => ({ ...f, eap: v })); setFiltroAbertoCol(null); }}
                      >
                        {v}
                      </div>
                    ))}
                  </div>
                )}
              </th>

              <th>Observação</th>
              <th>Comentário</th>
              {!listagemEnviada && <th style={{ width: '40px' }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {rowsParaExibir.map((row, visualIdx) => {
              const isCriar = row.codigo?.toLowerCase() === "criar";
              const foiEnviada = listagemEnviada;
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
                        <>
                          <div
                            className="locacao-trigger"
                            onClick={() => setDropdownAberto(indexOriginal)}
                          >
                            {row.locacao?.length === 0
                              ? "Selecionar"
                              : row.locacao.length === 1
                                ? row.locacao[0]
                                : `${row.locacao[0]} +`}
                          </div>

                          {dropdownAberto === indexOriginal && (
                            <div ref={dropdownRef} className="locacao-dropdown">
                              {locacoes.map((loc) => (
                                <label key={loc} className="locacao-option">
                                  <input
                                    type="checkbox"
                                    checked={row.locacao?.includes(loc) || false}
                                    onChange={(e) =>
                                      handleLocacaoChange(indexOriginal, loc, e.target.checked)
                                    }
                                  />
                                  <span>{loc}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div
                            className={`locacao-resumo ${row.locacao?.length > 1 ? 'locacao-resumo-clickable' : ''}`}
                            onClick={() => {
                              if (row.locacao?.length > 1) {
                                setTooltipVisualizacao(row.id);
                              }
                            }}
                          >
                            {row.locacao?.length === 0
                              ? "–"
                              : row.locacao.length === 1
                                ? row.locacao[0]
                                : `${row.locacao[0]} +`}
                          </div>

                          {tooltipVisualizacao === row.id && (
                            <div ref={tooltipRef} className="locacao-tooltip">
                              {row.locacao.map((loc, i) => (
                                <div key={i} className="locacao-tooltip-item">
                                  • {loc}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
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
                    {!listagemEnviada && (
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
                    )}
                  </tr>
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