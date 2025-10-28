import React, { useState, useEffect } from "react";
import "./Collab.css";
import { FaPaperPlane, FaUserPlus } from "react-icons/fa";
import { supabase } from "../supabaseClient";

export default function Collab({ onClose, user }) {
  const [emailConvite, setEmailConvite] = useState("");
  const [notificacoes, setNotificacoes] = useState([]);
  const [enviando, setEnviando] = useState(false); // ✈️ novo estado de animação

  useEffect(() => {
    if (user?.email) {
      fetchNotificacoes();
    }
  }, [user?.email]);

  const fetchNotificacoes = async () => {
    try {
      const { data: convites, error } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .eq("status", "pendente");

      if (error) throw error;

      const convitesComPerfil = await Promise.all(
        convites.map(async (c) => {
          const { data: remetente } = await supabase
            .from("profiles")
            .select("id,nome,email")
            .eq("id", c.remetente_id)
            .maybeSingle();
          return { ...c, remetente };
        })
      );

      setNotificacoes(convitesComPerfil);
    } catch (err) {
      console.error("Erro ao buscar convites:", err);
      setNotificacoes([]);
    }
  };

  const enviarConvite = async () => {
    if (!emailConvite.trim()) return alert("Digite um e-mail válido.");

    setEnviando(true); // inicia animação do avião

    setTimeout(async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id,nome,email")
          .ilike("email", emailConvite)
          .maybeSingle();

        if (error) throw error;

        if (!profile) {
          alert("Usuário não encontrado no OnBox.");
          setEnviando(false);
          return;
        }

        const { data: existingInvite } = await supabase
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
        setEnviando(false); // retorna o avião
      }
    }, 800); // tempo da animação
  };

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

  return (
    <div className="collab-modal-overlay">
      <div className="collab-modal">
        <div className="collab-header">
          <h2>Colaborações</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Enviar Convite */}
        <div className="collab-section">
          <h3><FaUserPlus className="icon" /> Enviar Convite</h3>
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
            notificacoes.map((n) => (
              <div className="notificacao-item" key={n.id}>
                <span>
                  <strong>{n.remetente?.nome || "Usuário"}</strong> te convidou
                </span>
                <button className="btn-aceitar" onClick={() => aceitarConvite(n)}>Aceitar</button>
              </div>
            ))
          )}
        </div>

        <hr />

        <div className="collab-section">
          <h3>Integrantes</h3>
          <p className="empty">Espaço reservado para integrantes.</p>
        </div>
      </div>
    </div>
  );
}
