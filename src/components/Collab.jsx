// src/components/Collab.jsx
import React, { useState, useEffect } from "react";
import "./Collab.css";
import { FaPaperPlane, FaUserPlus, FaEllipsisV } from "react-icons/fa";
import { supabase } from "../supabaseClient";

export default function Collab({ onClose, user }) {
  const [emailConvite, setEmailConvite] = useState("");
  const [notificacoes, setNotificacoes] = useState([]);
  const [integrantes, setIntegrantes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [removendo, setRemovendo] = useState(null);

  useEffect(() => {
    if (user?.email) {
      fetchNotificacoes();
      fetchIntegrantes();
    }
  }, [user?.email]);

  // ==============================
  // 🔔 BUSCAR NOTIFICAÇÕES (convites + menções)
  // ==============================
  const fetchNotificacoes = async () => {
    try {
      // Convites pendentes
      const {  convites } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .eq("status", "pendente");

      const convitesComPerfil = await Promise.all(
        convites.map(async (c) => {
          const {  remetente } = await supabase
            .from("profiles")
            .select("id,nome,email,avatar_url")
            .eq("id", c.remetente_id)
            .maybeSingle();
          return { ...c, remetente, tipo: "convite" };
        })
      );

      // Notificações de menção
      const {  mencoes } = await supabase
        .from("notificacoes")
        .select(`
          *,
          remetente:profiles(id, nome, avatar_url),
          nota:notas(nome),
          projeto:projects(name)
        `)
        .eq("user_id", user.id)
        .eq("lido", false);

      const mencoesFormatadas = mencoes.map(m => ({
        ...m,
        tipo: "menção"
      }));

      setNotificacoes([...convitesComPerfil, ...mencoesFormatadas]);
    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
      setNotificacoes([]);
    }
  };

  // ==============================
  // 👥 BUSCAR INTEGRANTES
  // ==============================
  const fetchIntegrantes = async () => {
    try {
      const {  convitesAceitos } = await supabase
        .from("convites")
        .select("*")
        .eq("remetente_id", user.id)
        .eq("status", "aceito");

      const integrantesComPerfil = await Promise.all(
        (convitesAceitos || []).map(async (c) => {
          const {  profile } = await supabase
            .from("profiles")
            .select("id,nome,email,avatar_url")
            .ilike("email", c.email)
            .maybeSingle();

          return {
            convite_id: c.id,
            invited_email: c.email,
            profile_id: profile?.id || null,
            nome: profile?.nome || c.email,
            email: profile?.email || c.email,
            avatar_url: profile?.avatar_url || null,
          };
        })
      );

      setIntegrantes(integrantesComPerfil);
    } catch (err) {
      console.error("Erro ao buscar integrantes:", err);
      setIntegrantes([]);
    }
  };

  // ==============================
  // ✉️ ENVIAR CONVITE
  // ==============================
  const enviarConvite = async () => {
    if (!emailConvite.trim()) return alert("Digite um e-mail válido.");
    setEnviando(true);

    setTimeout(async () => {
      try {
        const {  profile } = await supabase
          .from("profiles")
          .select("id,nome,email")
          .ilike("email", emailConvite)
          .maybeSingle();

        if (!profile) {
          alert("Usuário não encontrado no OnBox.");
          setEnviando(false);
          return;
        }

        const {  existingInvite } = await supabase
          .from("convites")
          .select("*")
          .eq("email", profile.email)
          .eq("status", "pendente")
          .maybeSingle();

        if (existingInvite) {
          alert("Convite já enviado.");
          setEnviando(false);
          return;
        }

        const { error: insertError } = await supabase.from("convites").insert([
          {
            email: profile.email,
            remetente_id: user.id,
            status: "pendente",
          },
        ]);

        if (insertError) throw insertError;

        alert(`Convite enviado para ${profile.nome}`);
        setEmailConvite("");
        fetchNotificacoes();
      } catch (err) {
        console.error("Erro ao enviar convite:", err);
        alert("Erro ao enviar convite.");
      } finally {
        setEnviando(false);
      }
    }, 800);
  };

  // ==============================
  // ✅ ACEITAR CONVITE
  // ==============================
  const aceitarConvite = async (convite) => {
    try {
      await supabase.from("convites").update({ status: "aceito" }).eq("id", convite.id);
      alert("Convite aceito!");
      fetchNotificacoes();
    } catch (err) {
      console.error("Erro ao aceitar convite:", err);
      alert("Erro ao aceitar convite.");
    }
  };

  // ==============================
  // 🔗 LER NOTIFICAÇÃO DE MENÇÃO
  // ==============================
  const lerMensagemMencoes = async (notificacao) => {
    try {
      // Marca como lida
      await supabase.from("notificacoes").update({ lido: true }).eq("id", notificacao.id);
      
      // Aqui você deve redirecionar para a tarefa
      // Exemplo (ajuste conforme sua rota de navegação):
      alert(`Abrir tarefa: ${notificacao.nota?.nome}`);
      // window.location.href = `/task/${notificacao.nota_id}`;
    } catch (err) {
      console.error("Erro ao marcar notificação como lida:", err);
    }
  };

  // ==============================
  // ❌ REMOVER INTEGRANTE
  // ==============================
  const removerIntegrante = async (item) => {
    const ok = window.confirm(`Remover ${item.nome} do seu container?`);
    if (!ok) return;
    try {
      setRemovendo(item.convite_id);
      setTimeout(async () => {
        await supabase.from("convites").delete().eq("id", item.convite_id);
        setIntegrantes((prev) =>
          prev.filter((i) => i.convite_id !== item.convite_id)
        );
        setMenuAberto(null);
        setRemovendo(null);
      }, 300);
    } catch (err) {
      console.error("Erro ao remover integrante:", err);
      alert("Erro ao remover integrante.");
    }
  };

  return (
    <div className="collab-modal-overlay">
      <div className="collab-modal">
        <button className="overlay-close-btn" onClick={onClose}>
          ×
        </button>

        <div className="collab-header">
          <h2>Colaborações</h2>
        </div>

        {/* Enviar convite */}
        <div className="collab-section">
          <h3>
            <FaUserPlus className="icon" /> Enviar Convite
          </h3>
          <div className="convite-form">
            <input
              type="email"
              placeholder="Digite o e-mail do colaborador..."
              value={emailConvite}
              onChange={(e) => setEmailConvite(e.target.value)}
            />
            <button
              className={`btn-enviar ${enviando ? "plane-fly" : ""}`}
              onClick={!enviando ? enviarConvite : undefined}
            >
              <FaPaperPlane className="plane-icon" />
              {!enviando && " Enviar"}
            </button>
          </div>
        </div>

        <hr />

        {/* Notificações */}
        <div className="collab-section">
          <h3>Notificações</h3>
          {notificacoes.length === 0 ? (
            <p className="empty">Nenhuma notificação no momento.</p>
          ) : (
            notificacoes.map((n) => {
              if (n.tipo === "convite") {
                return (
                  <div className="notificacao-item" key={n.id}>
                    <span>
                      <strong>{n.remetente?.nome || "Usuário"}</strong> te convidou
                    </span>
                    <button
                      className="btn-aceitar"
                      onClick={() => aceitarConvite(n)}
                    >
                      Aceitar
                    </button>
                  </div>
                );
              } else if (n.tipo === "menção") {
                return (
                  <div className="notificacao-item" key={n.id}>
                    <span>
                      <strong>{n.remetente?.nome || "Alguém"}</strong> marcou você em um comentário na tarefa{" "}
                      <strong>{n.nota?.nome || "Sem nome"}</strong> do projeto{" "}
                      <strong>{n.projeto?.name || "Sem projeto"}</strong>
                    </span>
                    <button
                      className="btn-ler"
                      onClick={() => lerMensagemMencoes(n)}
                    >
                      Abrir
                    </button>
                  </div>
                );
              }
              return null;
            })
          )}
        </div>

        <hr />

        {/* Integrantes */}
        <div className="collab-section">
          <h3>Integrantes</h3>
          {integrantes.length === 0 ? (
            <p className="empty">Nenhum integrante ainda.</p>
          ) : (
            <div className="integrantes-list">
              {integrantes.map((i) => (
                <div
                  key={i.convite_id}
                  className={`integrante-item ${
                    removendo === i.convite_id ? "fade-out" : ""
                  }`}
                >
                  <div className="integrante-info">
                    {i.avatar_url ? (
                      <img
                        src={i.avatar_url}
                        alt={i.nome}
                        className="integrante-avatar"
                      />
                    ) : (
                      <div className="integrante-avatar placeholder">
                        {i.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="integrante-texto">
                      <strong>{i.nome}</strong>
                      <span>{i.email}</span>
                    </div>
                  </div>

                  <div className="integrante-menu">
                    <button
                      className="menu-btn"
                      onClick={() =>
                        setMenuAberto(
                          menuAberto === i.convite_id ? null : i.convite_id
                        )
                      }
                    >
                      <FaEllipsisV />
                    </button>

                    {menuAberto === i.convite_id && (
                      <div className="menu-opcoes">
                        <button onClick={() => removerIntegrante(i)}>
                          Remover
                        </button>
                      </div>
                    )}
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