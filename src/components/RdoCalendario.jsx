// src/components/CalendarioDiarioObra.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./RdoCalendario.css";

export default function CalendarioDiarioObra({
  pilhaId,
  usuarioId,
  onSelectNota
}) {
  const [diasPreenchidos, setDiasPreenchidos] = useState(new Set());
  const [mesAno, setMesAno] = useState(new Date());
  const [criandoNota, setCriandoNota] = useState(false);

  useEffect(() => {
    const carregarDias = async () => {
      const inicio = new Date(mesAno.getFullYear(), mesAno.getMonth(), 1);
      const fim = new Date(mesAno.getFullYear(), mesAno.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from("notas")
        .select("id, data_entrega")
        .eq("pilha_id", pilhaId)
        .eq("tipo", "Diário de Obra")
        .gte("data_entrega", inicio.toISOString().split("T")[0])
        .lte("data_entrega", fim.toISOString().split("T")[0]);

      if (error) {
        console.error("Erro ao carregar RDOs:", error);
        return;
      }

      const dias = new Set(data.map(n => n.data_entrega));
      setDiasPreenchidos(dias);
    };

    carregarDias();
  }, [pilhaId, mesAno]);

  const gerarDiasDoMes = () => {
    const ano = mesAno.getFullYear();
    const mes = mesAno.getMonth();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();

    const dias = [];
    for (let i = 0; i < primeiroDiaSemana; i++) {
      dias.push(null);
    }
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      dias.push({
        dia,
        dataStr,
        preenchido: diasPreenchidos.has(dataStr)
      });
    }
    return dias;
  };

  const handleDiaClick = async (dataStr) => {
    if (!dataStr || criandoNota) return;

    console.log("📅 Clicou no dia:", dataStr);

    // ✅ Se já está preenchido (dia verde), abre a nota existente
    if (diasPreenchidos.has(dataStr)) {
      console.log("🟢 Dia já preenchido, buscando nota existente...");
      
      const { data: notaExistente, error } = await supabase
        .from("notas")
        .select("*")
        .eq("pilha_id", pilhaId)
        .eq("tipo", "Diário de Obra")
        .eq("data_entrega", dataStr)
        .limit(1)
        .single();

      if (error) {
        console.error("❌ Erro ao buscar nota existente:", error);
        return;
      }

      if (notaExistente) {
        console.log("✅ Nota encontrada:", notaExistente);
        onSelectNota(notaExistente.id);
      }
      return;
    }

    console.log("⚪ Dia vazio, criando novo RDO...");

    // ✅ Se o dia não está preenchido, cria um novo RDO
    try {
      setCriandoNota(true);
      
      const dataObj = new Date(`${dataStr}T00:00:00`);
      const nomeFormatado = dataObj.toLocaleDateString('pt-BR');

      console.log("📝 Criando nova nota RDO...");

      const { data: nova, error: erroInsert } = await supabase
        .from("notas")
        .insert([{
          nome: `RDO - ${nomeFormatado}`,
          tipo: "Diário de Obra",
          pilha_id: pilhaId,
          data_entrega: dataStr,
          responsavel: usuarioId,
          concluida: false,
          ordem: 0
        }])
        .select()
        .single();

      if (erroInsert) {
        console.error("❌ Erro ao criar nova nota RDO:", erroInsert);
        alert("Erro ao criar o Diário de Obra: " + (erroInsert.message || "Erro desconhecido"));
        return;
      }

      if (!nova) {
        console.error("❌ Inserção não retornou dados.");
        alert("Falha ao criar o Diário de Obra.");
        return;
      }

      console.log("✅ Nova nota criada:", nova);

      // ✅ Atualiza UI imediatamente
      setDiasPreenchidos(prev => new Set(prev).add(dataStr));
      
      // ✅ Abre o modal do RDO recém-criado (vazio para preencher)
      console.log("🚀 Abrindo modal para nota ID:", nova.id);
      onSelectNota(nova.id);

    } catch (err) {
      console.error("❌ Erro inesperado em handleDiaClick:", err);
      alert("Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setCriandoNota(false);
    }
  };

  const dias = gerarDiasDoMes();
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="calendario-diario-obras">
      <div className="calendario-header">
        <button onClick={() => setMesAno(new Date(mesAno.getFullYear(), mesAno.getMonth() - 1, 1))}>
          &lt;
        </button>
        <span>{mesAno.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setMesAno(new Date(mesAno.getFullYear(), mesAno.getMonth() + 1, 1))}>
          &gt;
        </button>
      </div>

      <div className="calendario-semana-header">
        {diasSemana.map(dia => (
          <div key={dia} className="calendario-dia-semana">
            {dia}
          </div>
        ))}
      </div>

      <div className="calendario-grid">
        {dias.map((item, index) => (
          <div
            key={index}
            className={`calendario-dia ${item ? (item.preenchido ? 'preenchido' : '') : 'vazio'} ${criandoNota ? 'disabled' : ''}`}
            onClick={() => item && handleDiaClick(item.dataStr)}
            style={{ cursor: criandoNota ? 'wait' : (item ? 'pointer' : 'default') }}
          >
            {item ? item.dia : ''}
          </div>
        ))}
      </div>

      {criandoNota && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '8px', 
          fontSize: '0.85em', 
          color: '#666' 
        }}>
          Criando RDO...
        </div>
      )}
    </div>
  );
}