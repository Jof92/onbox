import React, { useState, useEffect } from "react";
import "./Collab.css";
import { FaPaperPlane, FaUserPlus } from "react-icons/fa";
import { supabase } from "../supabaseClient";

export default function Collab({ onClose, user }) {
  const [emailConvite, setEmailConvite] = useState("");
  const [notificacoes, setNotificacoes] = useState([]);

  useEffect(() => {
    if (user?.email) {
      fetchNotificacoes();
    }
  }, [user?.email]);

  // 🔹 Buscar convites pendentes para o usuário logado
  const fetchNotificacoes = async () => {
    try {
      const { data: convites, error } = await supabase
        .from("convites")
        .select("*")
        .eq("email", user.email)
        .eq("status", "pendente");

      if (error) throw error;

      // Buscar profile do remetente para cada convite
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

  // 🔹 Enviar convite
  const enviarConvite = async () => {
    if (!emailConvite.trim()) return alert("Digite um e-mail válido.");

    try {
      // Buscar profile do usuário convidado
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id,nome,email")
        .ilike("email", emailConvite)
        .maybeSingle();

      if (error) throw error;

      if (!profile) {
        console.log("Usuário não encontrado para o email:", emailConvite);
        return alert("Usuário não encontrado no OnBox.");
      }

      console.log("Usuário encontrado:", profile);

      // Verificar se já existe convite pendente
      const { data: existingInvite } = await supabase
        .from("convites")
        .select("*")
        .eq("email", profile.email)
        .eq("status", "pendente")
        .maybeSingle();

      if (existingInvite) return alert("Convite já enviado.");

      // Inserir convite
      const { data: novoConvite, error: insertError } = await supabase
        .from("convites")
        .insert([
          {
            email: profile.email,
            remetente_id: user.id,
            status: "pendente",
          },
        ])
        .select();

      if (insertError) throw insertError;

      alert(`Convite enviado para ${profile.nome}`);
      setEmailConvite("");
      fetchNotificacoes();

      console.log("Convite criado:", novoConvite);
    } catch (err) {
      console.error("Erro ao enviar convite:", err);
      alert("Erro ao enviar convite.");
    }
  };

  // 🔹 Aceitar convite
  const aceitarConvite = async (convite) => {
    try {
      // Atualizar status do convite
      await supabase
        .from("convites")
        .update({ status: "aceito" })
        .eq("id", convite.id);

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
            <button onClick={enviarConvite}><FaPaperPlane /> Enviar</button>
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

        {/* Espaço reservado para futuros colaboradores */}
        <div className="collab-section">
          <h3>Integrantes</h3>
          <p className="empty">Espaço reservado para integrantes.</p>
        </div>
      </div>
    </div>
  );
}
