import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import "./loader.css";
import "./AtaCard.css";
import AtaObjetivos from "./AtaObjetivos";
import AtaPdf from "./AtaPdf";
import { FaTimes, FaUserPlus } from "react-icons/fa";

// ✅ FUNÇÃO MOVIDA PARA FORA DO COMPONENTE
// Isso impede que ela seja recriada a cada render, estabilizando o useCallback do fetchAta
const formatarNomeExibicao = (nomeCompleto) => {
  if (!nomeCompleto || typeof nomeCompleto !== 'string') return "";
  const palavras = nomeCompleto.trim().split(/\s+/);
  const duasPrimeiras = palavras.slice(0, 2);
  return duasPrimeiras
    .map(palavra => 
      palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase()
    )
    .join(' ');
};

export default function AtaCard({ 
  projetoAtual, 
  notaAtual, 
  ultimaAlteracao, 
  onProgressoChange,
  containerAtual,
  onClose
}) {
  const [projetoNome, setProjetoNome] = useState("");
  const [pauta, setPauta] = useState("");
  const [local, setLocal] = useState("");
  const [texto, setTexto] = useState("");
  const [proxima, setProxima] = useState("");
  const [participantes, setParticipantes] = useState([]);
  const [participanteInput, setParticipanteInput] = useState("");
  const [sugestoesParticipantes, setSugestoesParticipantes] = useState([]);
  const [autorNome, setAutorNome] = useState("Carregando...");
  const [usuarioId, setUsuarioId] = useState(null);
  const [ataId, setAtaId] = useState(null);
  const [editing, setEditing] = useState({ pauta: false, local: false });
  const [editingDataLocal, setEditingDataLocal] = useState(false);
  const [dataLocal, setDataLocal] = useState("");
  const [loading, setLoading] = useState(true);
  const [extIdCounter, setExtIdCounter] = useState(0);
  const [alteradoPorNome, setAlteradoPorNome] = useState("");
  const [alteradoEm, setAlteradoEm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);
  const [showParticipanteInput, setShowParticipanteInput] = useState(false);

  const cardRef = useRef(null);
  const pdfDropdownRef = useRef(null);
  const participantesSectionRef = useRef(null);

  // Detecta se o usuário está editando algum campo de texto
  const isEditing = useMemo(() => {
    const active = document.activeElement;
    return active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA';
  }, [pauta, local, texto, participanteInput, dataLocal, proxima]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pdfDropdownRef.current && !pdfDropdownRef.current.contains(e.target)) {
        setPdfDropdownOpen(false);
      }
    };

    if (pdfDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [pdfDropdownOpen]);

  useEffect(() => {
    const handleClickOutsideParticipantes = (e) => {
      if (participantesSectionRef.current && !participantesSectionRef.current.contains(e.target)) {
        setShowParticipanteInput(false);
        setParticipanteInput("");
        setSugestoesParticipantes([]);
      }
    };

    if (showParticipanteInput) {
      document.addEventListener("mousedown", handleClickOutsideParticipantes);
      return () => document.removeEventListener("mousedown", handleClickOutsideParticipantes);
    }
  }, [showParticipanteInput]);

  const fetchProjeto = useCallback(async () => {
    if (!projetoAtual?.id) return;
    const { data } = await supabase.from("projects").select("name").eq("id", projetoAtual.id).single();
    setProjetoNome(data?.name || "Projeto sem nome");
  }, [projetoAtual]);

  const fetchUsuarioLogado = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setUsuarioId(data?.user?.id || null);
  }, []);

  const fetchAta = useCallback(async () => {
    // ✅ Protege contra sobrescrita enquanto o usuário digita
    if (isEditing) return;

    if (!notaAtual?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data: ata, error } = await supabase
        .from("atas")
        .select("*")
        .eq("nota_id", notaAtual.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar ata:", error);
        setLoading(false);
        return;
      }

      if (!ata) {
        // ✅ NÃO HÁ ATA SALVA - tentar carregar rascunho
        const key = `rascunho_ata_${notaAtual.id}`;
        const rascunhoSalvo = localStorage.getItem(key);
        
        if (rascunhoSalvo) {
          try {
            const rascunho = JSON.parse(rascunhoSalvo);
            
            const seteDias = 7 * 24 * 60 * 60 * 1000;
            const idadeRascunho = Date.now() - (rascunho.timestamp || 0);
            
            if (idadeRascunho < seteDias) {
              setAtaId(null);
              setPauta(rascunho.pauta || "");
              setLocal(rascunho.local || "");
              setTexto(rascunho.texto || "");
              setProxima(rascunho.proxima || "");
              setDataLocal(rascunho.dataLocal || "");
              setParticipantes(rascunho.participantes || []);
              setAlteradoPorNome("");
              setAlteradoEm("");
              setAutorNome("Rascunho local");
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn("Rascunho corrompido, ignorando", e);
            localStorage.removeItem(key);
          }
        }
        
        // Se não houver rascunho válido, inicia vazio
        setAtaId(null);
        setPauta("");
        setLocal("");
        setTexto("");
        setProxima("");
        setParticipantes([]);
        setDataLocal("");
        setAlteradoPorNome("");
        setAlteradoEm("");
        setAutorNome("Ainda não redigida");
        setLoading(false);
        return;
      }

      // ✅ ATA ENCONTRADA - carregar do banco (NÃO carregar rascunho)
      const key = `rascunho_ata_${notaAtual.id}`;
      localStorage.removeItem(key);

      setAtaId(ata.id);
      setPauta(ata.pauta || "");
      setLocal(ata.local || "");
      setTexto(ata.texto || "");
      setProxima(ata.proxima_reuniao || "");
      setDataLocal(ata.data_local || "");

      const { data: partData } = await supabase
        .from("ata_participantes")
        .select(`
          id,
          profile_id,
          nome_externo,
          funcao_externa,
          profiles(id, nome, funcao)
        `)
        .eq("ata_id", ata.id)
        .order("id", { ascending: true });

      const participantesCarregados = (partData || [])
        .map(p => {
          if (p.profile_id) {
            const perfilValido = p.profiles && typeof p.profiles === 'object' && p.profiles.nome;
            if (perfilValido) {
              return {
                id: p.profiles.id || p.profile_id,
                nome: formatarNomeExibicao(p.profiles.nome?.trim() || "Usuário sem nome"),
                funcao: (p.profiles.funcao?.trim() || "Membro")
              };
            } else {
              return {
                id: p.profile_id,
                nome: "Usuário excluído",
                funcao: "Membro"
              };
            }
          } else {
            return {
              id: `ext-${p.id}`,
              nome: formatarNomeExibicao(p.nome_externo?.trim() || "Convidado"),
              funcao: (p.funcao_externa?.trim() || "Externo")
            };
          }
        })
        .filter(p => p && p.id);

      setParticipantes(participantesCarregados);

      let nomeAutor = "Você";

      if (ata.redigido_por) {
        const { data: perfil1 } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", ata.redigido_por)
          .single();

        if (perfil1?.nome) {
          nomeAutor = formatarNomeExibicao(perfil1.nome);
        } else {
          const { data: perfil2 } = await supabase
            .from("profiles")
            .select("nome")
            .eq("user_id", ata.redigido_por)
            .single();
          if (perfil2?.nome) {
            nomeAutor = formatarNomeExibicao(perfil2.nome);
          } else if (usuarioId) {
            const { data: meuPerfil } = await supabase
              .from("profiles")
              .select("nome")
              .eq("id", usuarioId)
              .single();
            nomeAutor = formatarNomeExibicao(meuPerfil?.nome) || "Você";
          } else {
            nomeAutor = "Você";
          }
        }
      } else if (usuarioId && !ataId) {
        const { data: meuPerfil } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", usuarioId)
          .single();
        nomeAutor = formatarNomeExibicao(meuPerfil?.nome) || "Você";
      } else if (usuarioId) {
        const { data: meuPerfil } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", usuarioId)
          .single();
        nomeAutor = formatarNomeExibicao(meuPerfil?.nome) || "Você";
      }

      setAutorNome(nomeAutor);

      if (ata.alterado_por) {
        const { data: perfilAlterador } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", ata.alterado_por)
          .single();

        let nome = perfilAlterador?.nome ||
          (await supabase.from("profiles").select("nome").eq("user_id", ata.alterado_por).single())?.data?.nome ||
          "Usuário desconhecido";

        nome = formatarNomeExibicao(nome);
        setAlteradoPorNome(nome);

        if (ata.alterado_em) {
          const data = new Date(ata.alterado_em);
          const dia = String(data.getDate()).padStart(2, '0');
          const mes = String(data.getMonth() + 1).padStart(2, '0');
          const ano = data.getFullYear();
          const horas = String(data.getHours()).padStart(2, '0');
          const minutos = String(data.getMinutes()).padStart(2, '0');
          setAlteradoEm(`${dia}/${mes}/${ano} às ${horas}:${minutos}`);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Erro ao carregar ata:", err);
      setLoading(false);
    }
  }, [notaAtual?.id, usuarioId, isEditing]); // ✅ formatarNomeExibicao removida das dependências

  useEffect(() => {
    fetchProjeto();
    fetchUsuarioLogado();
  }, [fetchProjeto, fetchUsuarioLogado]);

  useEffect(() => {
    if (projetoAtual?.id && notaAtual?.id) {
      fetchAta();
    }
  }, [projetoAtual?.id, notaAtual?.id, fetchAta]);

  useEffect(() => {
    if (!notaAtual?.id) return;
    
    const key = `rascunho_ata_${notaAtual.id}`;
    
    const timer = setTimeout(() => {
      const rascunho = {
        pauta,
        local,
        texto,
        proxima,
        dataLocal,
        participantes,
        timestamp: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(rascunho));
    }, 500);
    
    return () => clearTimeout(timer);
  }, [pauta, local, texto, proxima, dataLocal, participantes, notaAtual?.id]);

  const handleParticipanteChange = async (e) => {
    const v = e.target.value;
    setParticipanteInput(v);

    if (v.startsWith("@") && v.length > 1 && containerAtual?.id) {
      const termo = v.slice(1).toLowerCase();

      try {
        const { data: convites, error: convitesError } = await supabase
          .from("convites")
          .select("user_id")
          .eq("container_id", containerAtual.id)
          .eq("status", "aceito");

        if (convitesError) {
          console.error("Erro ao buscar convites:", convitesError);
          setSugestoesParticipantes([]);
          return;
        }

        const userIds = convites
          .map(c => c.user_id)
          .filter(id => id);

        if (userIds.length === 0) {
          setSugestoesParticipantes([]);
          return;
        }

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nickname, nome, funcao")
          .in("id", userIds);

        if (profilesError) {
          console.error("Erro ao buscar perfis:", profilesError);
          setSugestoesParticipantes([]);
          return;
        }

        const sugestoes = profiles.filter(p =>
          (p.nickname?.toLowerCase().includes(termo)) ||
          (p.nome?.toLowerCase().includes(termo))
        );

        const seen = new Set();
        const unicos = sugestoes.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        setSugestoesParticipantes(unicos.slice(0, 10));
      } catch (err) {
        console.error("Erro inesperado ao buscar participantes:", err);
        setSugestoesParticipantes([]);
      }
    } else {
      setSugestoesParticipantes([]);
    }
  };

  const selecionarSugestao = (item) => {
    if (!participantes.some(p => p.id === item.id)) {
      setParticipantes([...participantes, {
        id: item.id,
        nome: formatarNomeExibicao(item.nome),
        funcao: item.funcao || "Membro"
      }]);
    }
    setParticipanteInput("");
    setSugestoesParticipantes([]);
    setShowParticipanteInput(false);
  };

  const adicionarParticipanteExterno = () => {
    if (participanteInput.trim()) {
      setParticipantes(prev => [...prev, {
        id: `ext-${extIdCounter}`,
        nome: formatarNomeExibicao(participanteInput.trim()),
        funcao: "Externo"
      }]);
      setParticipanteInput("");
      setExtIdCounter(prev => prev + 1);
      setShowParticipanteInput(false);
    }
  };

  const removerParticipante = (id) => setParticipantes(participantes.filter(p => p.id !== id));

  const exportarPdf = async (opcao) => {
    setPdfDropdownOpen(false);
    
    if (!projetoNome || !notaAtual?.nome) {
      alert("Não é possível exportar PDF: projeto ou nota não identificados.");
      return;
    }

    let objetivosAtuais = [];
    if (ataId && (opcao === 'objetivos' || opcao === 'completo')) {
      try {
        const { data: objetivosData } = await supabase
          .from("ata_objetivos")
          .select(`*, profiles(id, nome)`)
          .eq("ata_id", ataId)
          .order("ordem", { ascending: true })
          .order("id", { ascending: true });

        if (objetivosData?.length) {
          const objetivoIds = objetivosData.map(o => o.id);
          let respPorObj = {};

          if (objetivoIds.length > 0) {
            const { data: respData } = await supabase
              .from("ata_objetivos_responsaveis_enriquecidos")
              .select("*")
              .in("ata_objetivo_id", objetivoIds);

            if (respData?.length) {
              respPorObj = respData.reduce((acc, r) => {
                if (!acc[r.ata_objetivo_id]) acc[r.ata_objetivo_id] = [];
                acc[r.ata_objetivo_id].push({
                  id: r.id,
                  usuario_id: r.usuario_id,
                  nome_externo: r.nome_externo,
                  nome_exibicao: r.nome_exibicao
                });
                return acc;
              }, {});
            }
          }

          objetivosAtuais = objetivosData
            .filter(o => !o.texto?.startsWith('[EXCLUIDO]'))
            .map(o => ({
              id: o.id,
              texto: o.texto || "",
              responsaveis: respPorObj[o.id] || [],
              dataEntrega: o.data_entrega,
              concluido: o.concluido || false,
              concluidoEm: o.concluido_em ? new Date(o.concluido_em) : null,
              comentario: o.comentario || "",
            }));
        }
      } catch (err) {
        console.error("Erro ao buscar objetivos para PDF:", err);
        alert("Erro ao carregar objetivos para exportação. Continuando com texto apenas.");
      }
    }

    await AtaPdf.exportar(
      opcao,
      projetoNome,
      notaAtual.nome,
      dataLocal,
      pauta,
      local,
      texto,
      participantes,
      objetivosAtuais
    );
  };

  const salvarAta = useCallback(async () => {
    if (!usuarioId || !notaAtual?.id || !projetoAtual?.id || !projetoAtual?.tipo) {
      alert("Dados insuficientes: verifique se 'projetoAtual' tem 'id' e 'tipo' válido ('projeto' ou 'setor').");
      return;
    }

    if (projetoAtual.tipo !== 'projeto' && projetoAtual.tipo !== 'setor') {
      alert("Tipo inválido. 'projetoAtual.tipo' deve ser 'projeto' ou 'setor'.");
      return;
    }

    setSalvando(true);
    setSalvoComSucesso(false);

    try {
      const agora = new Date().toISOString();
      const payloadBase = {
        nota_id: notaAtual.id,
        pauta,
        local,
        texto,
        proxima_reuniao: proxima || null,
        data_local: dataLocal,
        alterado_por: usuarioId,
        alterado_em: agora,
      };

      const payload = projetoAtual.tipo === 'projeto'
        ? { ...payloadBase, projeto_id: projetoAtual.id, setor_id: null }
        : { ...payloadBase, projeto_id: null, setor_id: projetoAtual.id };

      let savedAta;
      if (ataId) {
        const { data, error } = await supabase
          .from("atas")
          .update(payload)
          .eq("id", ataId)
          .select()
          .single();
        if (error) throw error;
        savedAta = data;
      } else {
        const payloadInserir = {
          ...payload,
          redigido_por: usuarioId,
          criado_em: agora,
        };
        const { data, error } = await supabase
          .from("atas")
          .insert([payloadInserir])
          .select()
          .single();
        if (error) throw error;
        savedAta = data;
        setAtaId(savedAta.id);
        setAutorNome("Carregando...");
      }

      await supabase.from("ata_participantes").delete().eq("ata_id", savedAta.id);
      for (const p of participantes) {
        if (p.id.toString().startsWith("ext")) {
          await supabase.from("ata_participantes").insert({
            ata_id: savedAta.id,
            nome_externo: p.nome,
            funcao_externa: p.funcao
          });
        } else {
          await supabase.from("ata_participantes").insert({
            ata_id: savedAta.id,
            profile_id: p.id
          });
        }
      }

      setSalvoComSucesso(true);
      
      const key = `rascunho_ata_${notaAtual.id}`;
      localStorage.removeItem(key);
      
      setTimeout(() => setSalvoComSucesso(false), 2000);
    } catch (e) {
      console.error(e);
      alert(`❌ Erro ao salvar ata: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  }, [
    ataId, usuarioId, notaAtual, projetoAtual, pauta, local, texto, proxima, dataLocal, participantes
  ]);

  if (loading) {
    return (
      <div className="ata-card" ref={cardRef}>
        <div className="ata-card-loading">
          <Loading size={200} />
        </div>
      </div>
    );
  }

  return (
    <div className="ata-card" ref={cardRef}>
      <div className="listagem-card">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{projetoNome}</span>
            <div className="sub-info">
              <span className="nota-name">{notaAtual?.nome || "Sem nota"}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onClose && (
              <button
                className="listagem-close-btn"
                onClick={onClose}
                aria-label="Fechar"
              >
                <FaTimes />
              </button>
            )}
            <div className="alteracao-info">{ultimaAlteracao}</div>
          </div>
        </div>
      </div>

      <div className="ata-header">
        <div className="ata-header-left">
          <div className="ata-section pauta-section">
            {editing.pauta ? (
              <input
                className="pauta-input"
                value={pauta}
                onChange={e => setPauta(e.target.value)}
                onBlur={() => setEditing({ ...editing, pauta: false })}
                onKeyDown={e => e.key === "Enter" && setEditing({ ...editing, pauta: false })}
                autoFocus
              />
            ) : (
              <span
                className="pauta-text"
                onDoubleClick={() => setEditing({ ...editing, pauta: true })}
              >
                {pauta || "Pauta da reunião"}
              </span>
            )}
          </div>

          <div className="ata-section local-section">
            {editing.local ? (
              <input
                className="local-input"
                value={local}
                onChange={e => setLocal(e.target.value)}
                onBlur={() => setEditing({ ...editing, local: false })}
                onKeyDown={e => e.key === "Enter" && setEditing({ ...editing, local: false })}
              />
            ) : (
              <span
                className="local-text"
                onDoubleClick={() => setEditing({ ...editing, local: true })}
              >
                {local || "Local"}
              </span>
            )}
          </div>

          <div className="ata-section data-section">
            {editingDataLocal ? (
              <input
                type="text"
                value={dataLocal}
                placeholder="Cidade, DD de Mês de AAAA"
                onChange={e => setDataLocal(e.target.value)}
                onBlur={() => setEditingDataLocal(false)}
                onKeyDown={e => e.key === "Enter" && setEditingDataLocal(false)}
                autoFocus
              />
            ) : (
              <span
                className="data-local-text"
                onDoubleClick={() => setEditingDataLocal(true)}
              >
                {dataLocal || "Cidade e Data"}
              </span>
            )}
          </div>
        </div>

        <div className="ata-header-right">
          <div className="participantes-header">
            <span className="participantes-title">Integrantes</span>
            <button 
              className="btn-add-participante"
              onClick={() => setShowParticipanteInput(true)}
            >
              <FaUserPlus />
            </button>
          </div>

          <div ref={participantesSectionRef} className="participantes-section">
            {showParticipanteInput && (
              <input
                type="text"
                value={participanteInput}
                onChange={handleParticipanteChange}
                placeholder="@nickname ou nome (externo) + enter"
                className="participante-input"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (sugestoesParticipantes.length > 0) {
                      selecionarSugestao(sugestoesParticipantes[0]);
                    } else {
                      adicionarParticipanteExterno();
                    }
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    if (!sugestoesParticipantes.length) {
                      setShowParticipanteInput(false);
                      setParticipanteInput("");
                    }
                  }, 200);
                }}
              />
            )}
            {showParticipanteInput && sugestoesParticipantes.length > 0 && (
              <div className="sugestoes-list1">
                {sugestoesParticipantes.map(item => (
                  <div key={item.id} className="sugestao-item" onClick={() => selecionarSugestao(item)}>
                    <span>@{item.nickname || item.nome}</span>
                    <span className="sugestao-funcao">{item.funcao}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="participantes-list">
              {participantes
                .filter(p => p && typeof p === 'object')
                .map(p => (
                  <div key={p.id} className="participante-item">
                    <span className="participante-nome">{p.nome || "Nome não informado"}</span>
                    <span className="participante-funcao">{p.funcao || "Função não informada"}</span>
                    <span className="remover-participante" onClick={() => removerParticipante(p.id)}>×</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="ata-body">
        <div className="ata-section">
          <div className="participantes-header">
            <span className="participantes-title">Texto</span>
          </div>
          
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={6}
            placeholder="Digite o texto da ata..."
            className="ata-textarea"
          />
        </div>

        <AtaObjetivos
          ataId={ataId}
          texto={texto}
          usuarioId={usuarioId}
          projetoAtual={projetoAtual}
          notaAtual={notaAtual}
          projetoNome={projetoNome}
          autorNome={autorNome}
          onProgressoChange={onProgressoChange}
          containerAtual={containerAtual}
        />

        <div className="ata-section proxima-reuniao-container">
          <div className="proxima-reuniao-linha">
            <label>Próxima reunião em:</label>
            <input type="date" value={proxima} onChange={e => setProxima(e.target.value)} className="proxima-data-input" />
          </div>

          <div className="ata-autor">
            {ataId && (
              <>
                <p>Ata redigida por <strong>{autorNome}</strong></p>
                {alteradoPorNome && alteradoEm && (
                  <p>Ata alterada por <strong>{alteradoPorNome}</strong> em <strong>{alteradoEm}</strong></p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="ata-actions-container">
          <div className="ata-pdf-container" ref={pdfDropdownRef}>
            <button 
              className="btn-pdf-ata"
              onClick={() => setPdfDropdownOpen(prev => !prev)}
            >
              PDF
            </button>
            {pdfDropdownOpen && (
              <div className="pdf-dropdown-content">
                <button 
                  onClick={() => exportarPdf('texto')}
                  className="pdf-option"
                >
                  Texto da ata
                </button>
                <button 
                  onClick={() => exportarPdf('objetivos')}
                  className="pdf-option"
                >
                  Apenas Objetivos
                </button>
                <button 
                  onClick={() => exportarPdf('completo')}
                  className="pdf-option pdf-option-highlight"
                >
                  Texto e Objetivos
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="btn-salvar-ata" onClick={salvarAta} disabled={salvando}>
              Salvar
            </button>
            {salvando && <div className="loader"></div>}
            {salvoComSucesso && <span style={{ color: "green", marginLeft: "8px" }}>✓ Salvo!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}