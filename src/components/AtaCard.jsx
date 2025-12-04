// AtaCard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import Loading from "./Loading";
import "./loader.css";
import "./AtaCard.css";
import AtaObjetivos from "./AtaObjetivos"; // ✅ Novo componente

export default function AtaCard({ 
  projetoAtual, 
  notaAtual, 
  ultimaAlteracao, 
  onProgressoChange,
  containerAtual  // 👈 RECEBE O CONTAINER DO MODAL
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

  // Fetch projeto nome
  const fetchProjeto = useCallback(async () => {
    if (!projetoAtual?.id) return;
    const { data } = await supabase.from("projects").select("name").eq("id", projetoAtual.id).single();
    setProjetoNome(data?.name || "Projeto sem nome");
  }, [projetoAtual]);

  // Fetch usuário logado
  const fetchUsuarioLogado = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setUsuarioId(data?.user?.id || null);
  }, []);

  // Fetch Ata (sem objetivos)
  const fetchAta = useCallback(async () => {
    if (!notaAtual?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data: ata } = await supabase.from("atas").select("*").eq("nota_id", notaAtual.id).single();

      if (!ata) {
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

      setAtaId(ata.id);
      setPauta(ata.pauta || "");
      setLocal(ata.local || "");
      setTexto(ata.texto || "");
      setProxima(ata.proxima_reuniao || "");
      setDataLocal(ata.data_local || "");

      // Carregar participantes
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
                nome: (p.profiles.nome?.trim() || "Usuário sem nome"),
                funcao: (p.profiles.funcao?.trim() || "Membro")
              };
            } else {
              return {
                id: p.profile_id,
                nome: "Usuário excluíedido",
                funcao: "Membro"
              };
            }
          } else {
            return {
              id: `ext-${p.id}`,
              nome: (p.nome_externo?.trim() || "Convidado"),
              funcao: (p.funcao_externa?.trim() || "Externo")
            };
          }
        })
        .filter(p => p && p.id);

      setParticipantes(participantesCarregados);

      // ✅ Autor: corrige para usar o nome do usuário logado como fallback
      let nomeAutor = "Você";

      if (ata.redigido_por) {
        // Busca pelo ID do profile
        const { data: perfil1 } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", ata.redigido_por)
          .single();

        if (perfil1?.nome) {
          nomeAutor = perfil1.nome;
        } else {
          // Tenta pelo user_id (fallback)
          const { data: perfil2 } = await supabase
            .from("profiles")
            .select("nome")
            .eq("user_id", ata.redigido_por)
            .single();
          if (perfil2?.nome) {
            nomeAutor = perfil2.nome;
          } else if (usuarioId) {
            // ✅ Fallback: se não encontrar, usa o nome do usuário logado
            const { data: meuPerfil } = await supabase
              .from("profiles")
              .select("nome")
              .eq("id", usuarioId)
              .single();
            nomeAutor = meuPerfil?.nome || "Você";
          } else {
            nomeAutor = "Você";
          }
        }
      } else if (usuarioId && !ataId) {
        // ATA ainda não salva → usa o nome do usuário logado
        const { data: meuPerfil } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", usuarioId)
          .single();
        nomeAutor = meuPerfil?.nome || "Você";
      } else if (usuarioId) {
        // ATA existe mas redigido_por ausente ou inválido → usa login atual como fallback
        const { data: meuPerfil } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", usuarioId)
          .single();
        nomeAutor = meuPerfil?.nome || "Você";
      }

      setAutorNome(nomeAutor);

      // Última alteração
      if (ata.alterado_por) {
        const { data: perfilAlterador } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", ata.alterado_por)
          .single();

        const nome = perfilAlterador?.nome ||
          (await supabase.from("profiles").select("nome").eq("user_id", ata.alterado_por).single())?.data?.nome ||
          "Usuário desconhecido";

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
  }, [notaAtual, usuarioId]);

  useEffect(() => {
    fetchProjeto();
    fetchUsuarioLogado();
  }, [fetchProjeto, fetchUsuarioLogado]);

  useEffect(() => {
    if (projetoAtual?.id && notaAtual?.id) fetchAta();
  }, [projetoAtual?.id, notaAtual?.id, fetchAta]);

  // 🔍 Buscar participantes com @ — MEMBROS DO CONTAINER ATUAL (containerAtual.id)
  const handleParticipanteChange = async (e) => {
    const v = e.target.value;
    setParticipanteInput(v);

    if (v.startsWith("@") && v.length > 1 && containerAtual?.id) {
      const termo = v.slice(1).toLowerCase();

      try {
        // Buscar convites ACEITOS para o container ATUAL (containerAtual.id)
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
          .filter(id => id); // Remove nulos

        if (userIds.length === 0) {
          setSugestoesParticipantes([]);
          return;
        }

        // Buscar perfis desses membros
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nickname, nome, funcao")
          .in("id", userIds);

        if (profilesError) {
          console.error("Erro ao buscar perfis:", profilesError);
          setSugestoesParticipantes([]);
          return;
        }

        // Filtrar por nickname ou nome (case-insensitive)
        const sugestoes = profiles.filter(p =>
          (p.nickname?.toLowerCase().includes(termo)) ||
          (p.nome?.toLowerCase().includes(termo))
        );

        // Remover duplicatas por ID
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
        nome: item.nickname || item.nome,
        funcao: item.funcao || "Membro"
      }]);
    }
    setParticipanteInput("");
    setSugestoesParticipantes([]);
  };

  const removerParticipante = (id) => setParticipantes(participantes.filter(p => p.id !== id));

  // Salvar Ata (sem objetivos)
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

      // Salvar participantes
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
      setTimeout(() => setSalvoComSucesso(false), 2000);
    } catch (e) {
      console.error(e);
      alert(`❌ Erro ao salvar ata: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  }, [
    ataId, usuarioId, notaAtual, projetoAtual, pauta, local, texto, proxima, dataLocal, participantes, containerAtual
  ]);

  if (loading) return <div className="ata-card-loading"><Loading size={200} /></div>;

  return (
    <div className="ata-card">
      <div className="listagem-card">
        <div className="listagem-header-container">
          <div className="listagem-header-titles">
            <span className="project-name">{projetoNome}</span>
            <div className="sub-info">
              <span className="nota-name">{notaAtual?.nome || "Sem nota"}</span>
            </div>
          </div>
          <div className="alteracao-info">{ultimaAlteracao}</div>
        </div>
      </div>

      <div className="ata-body">
        {["pauta", "local"].map(campo => (
          <div key={campo} className="ata-section">
            {editing[campo] ? (
              <input
                className={`${campo}-input`}
                value={campo === "pauta" ? pauta : local}
                onChange={e => campo === "pauta" ? setPauta(e.target.value) : setLocal(e.target.value)}
                onBlur={() => setEditing({ ...editing, [campo]: false })}
                onKeyDown={e => e.key === "Enter" && setEditing({ ...editing, [campo]: false })}
                autoFocus
              />
            ) : (
              <span
                className={`${campo}-text`}
                onDoubleClick={() => setEditing({ ...editing, [campo]: true })}
                style={{ cursor: "pointer" }}
              >
                {campo === "pauta" ? pauta || "Pauta da reunião" : local || "Local"}
              </span>
            )}
          </div>
        ))}

        <div className="ata-section">
          <input
            type="text"
            value={participanteInput}
            onChange={handleParticipanteChange}
            placeholder="@nickname ou nome (externo) + enter"
            className="participante-input"
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (sugestoesParticipantes.length > 0) {
                  selecionarSugestao(sugestoesParticipantes[0]);
                } else if (participanteInput.trim()) {
                  setParticipantes(prev => [...prev, {
                    id: `ext-${extIdCounter}`,
                    nome: participanteInput.trim(),
                    funcao: "Externo"
                  }]);
                  setParticipanteInput("");
                  setExtIdCounter(prev => prev + 1);
                }
              }
            }}
          />
          {sugestoesParticipantes.length > 0 && (
            <div className="sugestoes-list">
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
                  <span>{p.nome || "Nome não informado"} ({p.funcao || "Função não informada"})</span>
                  <span className="remover-participante" onClick={() => removerParticipante(p.id)}>×</span>
                </div>
              ))}
          </div>
        </div>

        <div className="ata-section">
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={6}
            placeholder="Digite o texto da ata..."
          />
        </div>

        {/* ✅ Novo componente de objetivos */}
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

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="btn-salvar-ata" onClick={salvarAta} disabled={salvando}>
              Salvar
            </button>
            {salvando && <div className="loader"></div>}
            {salvoComSucesso && <span style={{ color: "green", marginLeft: "8px" }}>✓ Salvo!</span>}
          </div>

          <div className="ata-data-local">
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
                style={{ cursor: "pointer" }}
              >
                {dataLocal || "Clique duas vezes para inserir cidade e data"}
              </span>
            )}
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
      </div>
    </div>
  );
}