// src/components/AtaPdf.jsx
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

class AtaPdf {
  static async exportar(opcao, projetoNome, notaNome, dataLocal, pauta, local, texto, participantes, objetivos = []) {
    let previewContainer = null;
    let previewModal = null;
    
    try {
      // Criar container temporário para pré-visualização
      const containerTemp = this.criarContainerTemporario(
        opcao, 
        projetoNome, 
        notaNome, 
        dataLocal, 
        pauta, 
        local, 
        texto, 
        participantes, 
        objetivos
      );
      
      // Mostrar modal de pré-visualização com controles de margem
      const resultado = await this.mostrarPreviewComControles(
        containerTemp,
        opcao,
        projetoNome,
        notaNome,
        dataLocal,
        pauta,
        local,
        texto,
        participantes,
        objetivos
      );
      
      // Se o usuário confirmou a exportação
      if (resultado.confirmado) {
        const loadingMsg = this.criarMensagemCarregamento();
        document.body.appendChild(loadingMsg);
        
        // Remover container de preview
        if (previewContainer) document.body.removeChild(previewContainer);
        if (previewModal) document.body.removeChild(previewModal);
        
        // Recriar container com as margens ajustadas
        const containerFinal = this.criarContainerTemporario(
          opcao, 
          projetoNome, 
          notaNome, 
          dataLocal, 
          pauta, 
          local, 
          texto, 
          participantes, 
          objetivos
        );
        document.body.appendChild(containerFinal);
        
        // Capturar canvas
        const canvas = await html2canvas(containerFinal, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: containerFinal.scrollWidth,
          height: containerFinal.scrollHeight,
          windowWidth: containerFinal.scrollWidth,
          windowHeight: containerFinal.scrollHeight,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
        });
        
        // Remover container temporário
        document.body.removeChild(containerFinal);
        this.removerMensagemCarregamento(loadingMsg);
        
        // Gerar PDF com as margens personalizadas
        const blob = await this.gerarPDF(
          canvas, 
          projetoNome, 
          notaNome, 
          opcao,
          resultado.margens
        );
        
        // Baixar arquivo
        const nomeSeguro = this.sanitizarNomeArquivo(projetoNome);
        const nomeNota = this.sanitizarNomeArquivo(notaNome);
        const dataFormatada = dataLocal ? this.formatarDataParaNome(nomeSeguro) : 'sem_data';
        const sufixo = opcao === 'texto' ? 'texto' : opcao === 'objetivos' ? 'objetivos' : 'completo';
        const nomeArquivo = `ATA - ${nomeSeguro} - ${nomeNota} - ${sufixo}.pdf`;
        
        this.baixarArquivo(blob, nomeArquivo);
        alert('PDF gerado com sucesso!');
      } else {
        // Remover container de preview se cancelado
        if (previewContainer) document.body.removeChild(previewContainer);
        if (previewModal) document.body.removeChild(previewModal);
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      if (previewContainer) document.body.removeChild(previewContainer);
      if (previewModal) document.body.removeChild(previewModal);
      alert(`Erro ao gerar PDF: ${error.message}`);
    }
  }
  
  static async mostrarPreviewComControles(
    containerTemp, 
    opcao,
    projetoNome,
    notaNome,
    dataLocal,
    pauta,
    local,
    texto,
    participantes,
    objetivos
  ) {
    return new Promise((resolve) => {
      // Criar overlay escuro
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      `;
      
      // Criar modal principal
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 1200px;
        width: 95%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      `;
      
      // Cabeçalho do modal
      const modalHeader = document.createElement('div');
      modalHeader.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px 25px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 16px 16px 0 0;
      `;
      
      const tituloModal = document.createElement('h2');
      tituloModal.style.cssText = `
        margin: 0;
        font-size: 22px;
        font-weight: 600;
      `;
      tituloModal.textContent = 'Pré-visualização do PDF';
      
      const botoesHeader = document.createElement('div');
      botoesHeader.style.cssText = `display: flex; gap: 10px;`;
      
      const botaoFechar = document.createElement('button');
      botaoFechar.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: 2px solid white;
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s;
      `;
      botaoFechar.textContent = 'Cancelar';
      botaoFechar.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve({ confirmado: false });
      });
      
      botoesHeader.appendChild(botaoFechar);
      modalHeader.appendChild(tituloModal);
      modalHeader.appendChild(botoesHeader);
      
      // Corpo do modal com duas colunas
      const modalBody = document.createElement('div');
      modalBody.style.cssText = `
        display: flex;
        flex: 1;
        min-height: 0;
      `;
      
      // Coluna de pré-visualização
      const previewCol = document.createElement('div');
      previewCol.style.cssText = `
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: #f8fafc;
        border-right: 1px solid #e2e8f0;
        position: relative;
      `;
      
      const previewLabel = document.createElement('div');
      previewLabel.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        background: #667eea;
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        z-index: 10;
      `;
      previewLabel.textContent = 'Pré-visualização';
      previewCol.appendChild(previewLabel);
      
      // Adicionar container temporário ao preview
      previewCol.appendChild(containerTemp);
      
      // Coluna de controles
      const controlsCol = document.createElement('div');
      controlsCol.style.cssText = `
        width: 320px;
        padding: 20px;
        background: #f1f5f9;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
      `;
      
      const controlsTitle = document.createElement('h3');
      controlsTitle.style.cssText = `
        margin: 0 0 15px 0;
        color: #1e293b;
        font-size: 18px;
        font-weight: 600;
        padding-bottom: 10px;
        border-bottom: 2px solid #667eea;
      `;
      controlsTitle.textContent = 'Configurações de Margem';
      controlsCol.appendChild(controlsTitle);
      
      // Estado das margens
      const margens = {
        esquerda: 15,
        direita: 15,
        superior: 15,
        inferior: 15
      };
      
      // Função para criar controle de margem
      const criarControleMargem = (label, key, cor) => {
        const container = document.createElement('div');
        container.style.cssText = `
          background: white;
          padding: 15px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        `;
        
        const labelEl = document.createElement('label');
        labelEl.style.cssText = `
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #334155;
          font-size: 14px;
        `;
        labelEl.textContent = `${label}:`;
        container.appendChild(labelEl);
        
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `display: flex; align-items: center; gap: 10px;`;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '5';
        input.max = '50';
        input.value = margens[key];
        input.style.cssText = `
          width: 80px;
          padding: 8px 12px;
          border: 2px solid ${cor};
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: ${cor};
        `;
        
        const unidade = document.createElement('span');
        unidade.style.cssText = `
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
        `;
        unidade.textContent = 'mm';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '5';
        slider.max = '50';
        slider.value = margens[key];
        slider.style.cssText = `
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: #e2e8f0;
          outline: none;
          -webkit-appearance: none;
        `;
        slider.style.background = `linear-gradient(to right, ${cor} ${slider.value}%, #e2e8f0 ${slider.value}%)`;
        
        // Sincronizar input e slider
        input.addEventListener('input', (e) => {
          const valor = Math.max(5, Math.min(50, parseInt(e.target.value) || 5));
          margens[key] = valor;
          slider.value = valor;
          slider.style.background = `linear-gradient(to right, ${cor} ${valor}%, #e2e8f0 ${valor}%)`;
          atualizarPreview();
        });
        
        slider.addEventListener('input', (e) => {
          margens[key] = parseInt(e.target.value);
          input.value = e.target.value;
          slider.style.background = `linear-gradient(to right, ${cor} ${e.target.value}%, #e2e8f0 ${e.target.value}%)`;
          atualizarPreview();
        });
        
        inputContainer.appendChild(input);
        inputContainer.appendChild(unidade);
        inputContainer.appendChild(slider);
        container.appendChild(inputContainer);
        
        return container;
      };
      
      // Adicionar controles de margem
      controlsCol.appendChild(criarControleMargem('Margem Esquerda', 'esquerda', '#3b82f6'));
      controlsCol.appendChild(criarControleMargem('Margem Direita', 'direita', '#10b981'));
      controlsCol.appendChild(criarControleMargem('Margem Superior', 'superior', '#f59e0b'));
      controlsCol.appendChild(criarControleMargem('Margem Inferior', 'inferior', '#ef4444'));
      
      // Informações adicionais
      const infoBox = document.createElement('div');
      infoBox.style.cssText = `
        background: #dbeafe;
        border-left: 4px solid #3b82f6;
        padding: 15px;
        border-radius: 8px;
        font-size: 13px;
        color: #1e40af;
      `;
      infoBox.innerHTML = `
        <strong>💡 Dicas:</strong><br>
        • Margens menores = mais conteúdo por página<br>
        • Margens maiores = melhor legibilidade<br>
        • Valores recomendados: 10-20mm<br>
        • Ajuste conforme necessário
      `;
      controlsCol.appendChild(infoBox);
      
      // Botões de ação
      const botoesAcao = document.createElement('div');
      botoesAcao.style.cssText = `
        display: flex;
        gap: 10px;
        padding-top: 15px;
        border-top: 2px solid #cbd5e1;
        margin-top: auto;
      `;
      
      const botaoReset = document.createElement('button');
      botaoReset.style.cssText = `
        flex: 1;
        background: #94a3b8;
        color: white;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
      `;
      botaoReset.textContent = 'Restaurar Padrão';
      botaoReset.addEventListener('click', () => {
        margens.esquerda = 15;
        margens.direita = 15;
        margens.superior = 15;
        margens.inferior = 15;
        
        // Atualizar todos os inputs e sliders
        const inputs = controlsCol.querySelectorAll('input[type="number"]');
        const sliders = controlsCol.querySelectorAll('input[type="range"]');
        
        inputs.forEach((input, index) => {
          const key = ['esquerda', 'direita', 'superior', 'inferior'][index];
          input.value = margens[key];
        });
        
        sliders.forEach((slider, index) => {
          const key = ['esquerda', 'direita', 'superior', 'inferior'][index];
          const cor = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index];
          slider.value = margens[key];
          slider.style.background = `linear-gradient(to right, ${cor} ${margens[key]}%, #e2e8f0 ${margens[key]}%)`;
        });
        
        atualizarPreview();
      });
      
      const botaoExportar = document.createElement('button');
      botaoExportar.style.cssText = `
        flex: 1;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      `;
      botaoExportar.textContent = 'Gerar PDF';
      botaoExportar.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve({ confirmado: true, margens });
      });
      
      botoesAcao.appendChild(botaoReset);
      botoesAcao.appendChild(botaoExportar);
      controlsCol.appendChild(botoesAcao);
      
      // Função para atualizar preview em tempo real
      const atualizarPreview = () => {
        // Atualizar visualização com margens (simulação visual)
        const previewContent = containerTemp;
        previewContent.style.padding = `${margens.superior}px ${margens.direita}px ${margens.inferior}px ${margens.esquerda}px`;
      };
      
      modalBody.appendChild(previewCol);
      modalBody.appendChild(controlsCol);
      
      modal.appendChild(modalHeader);
      modal.appendChild(modalBody);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Iniciar com preview atualizado
      atualizarPreview();
    });
  }
  
  static criarMensagemCarregamento() {
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'ata-pdf-loading';
    loadingMsg.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px 40px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 16px;
      font-weight: bold;
      text-align: center;
    `;
    loadingMsg.innerHTML = `
      <div>Gerando PDF...</div>
      <div style="font-size: 12px; font-weight: normal; margin-top: 8px; color: #666;">
        Isso pode levar alguns segundos
      </div>
    `;
    return loadingMsg;
  }
  
  static removerMensagemCarregamento(elemento) {
    try {
      if (elemento && elemento.parentNode) {
        elemento.parentNode.removeChild(elemento);
      }
    } catch (err) {
      console.warn('Erro ao remover mensagem de carregamento:', err);
    }
  }
  
  static criarContainerTemporario(opcao, projetoNome, notaNome, dataLocal, pauta, local, texto, participantes, objetivos) {
    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      width: 794px; /* A4 width in pixels at 96 DPI */
      background: white;
      padding: 40px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      box-sizing: border-box;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      margin: 0 auto;
    `;
    
    // Cabeçalho
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 20px;
    `;
    
    const titulo = document.createElement('h1');
    titulo.style.cssText = `
      font-size: 24px;
      color: #1e3a8a;
      margin: 0 0 10px 0;
    `;
    titulo.textContent = 'ATA DE REUNIÃO';
    
    const subtitulo = document.createElement('div');
    subtitulo.style.cssText = `
      font-size: 16px;
      color: #4b5563;
      margin-top: 5px;
    `;
    subtitulo.innerHTML = `
      <div><strong>Projeto:</strong> ${projetoNome || 'Não informado'}</div>
      <div><strong>Nota:</strong> ${notaNome || 'Não informado'}</div>
      ${dataLocal ? `<div><strong>Data:</strong> ${dataLocal}</div>` : ''}
    `;
    
    header.appendChild(titulo);
    header.appendChild(subtitulo);
    container.appendChild(header);
    
    // Pauta e Local (sempre incluídos)
    if (opcao !== 'objetivos') {
      const pautaLocal = document.createElement('div');
      pautaLocal.style.cssText = `margin-bottom: 25px;`;
      
      if (pauta) {
        const pautaEl = document.createElement('div');
        pautaEl.style.cssText = `font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #1e40af;`;
        pautaEl.textContent = pauta;
        pautaLocal.appendChild(pautaEl);
      }
      
      if (local) {
        const localEl = document.createElement('div');
        localEl.style.cssText = `font-size: 16px; color: #4b5563; margin-bottom: 15px;`;
        localEl.textContent = `Local: ${local}`;
        pautaLocal.appendChild(localEl);
      }
      
      container.appendChild(pautaLocal);
    }
    
    // Participantes
    if (opcao !== 'objetivos' && participantes?.length > 0) {
      const participantesEl = document.createElement('div');
      participantesEl.style.cssText = `margin-bottom: 25px;`;
      
      const tituloPart = document.createElement('h3');
      tituloPart.style.cssText = `font-size: 18px; color: #1e3a8a; margin: 0 0 10px 0;`;
      tituloPart.textContent = 'Participantes:';
      participantesEl.appendChild(tituloPart);
      
      const listaPart = document.createElement('div');
      listaPart.style.cssText = `display: flex; flex-wrap: wrap; gap: 8px;`;
      
      participantes.forEach(p => {
        const chip = document.createElement('span');
        chip.style.cssText = `
          background: #dbeafe;
          color: #1e40af;
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 14px;
          display: inline-block;
          margin-right: 6px;
          margin-bottom: 6px;
        `;
        chip.textContent = `${p.nome}${p.funcao ? ` (${p.funcao})` : ''}`;
        listaPart.appendChild(chip);
      });
      
      participantesEl.appendChild(listaPart);
      container.appendChild(participantesEl);
    }
    
    // Texto da ata
    if (opcao === 'texto' || opcao === 'completo') {
      if (texto?.trim()) {
        const textoEl = document.createElement('div');
        textoEl.style.cssText = `
          margin-bottom: 30px;
          white-space: pre-wrap;
          line-height: 1.8;
          font-size: 14px;
        `;
        
        // Processar texto para destacar objetivos entre aspas
        const textoProcessado = texto.replace(/'([^']+)'/g, match => {
          return `<span style="background-color: #fef3c7; padding: 2px 4px; border-radius: 4px; font-weight: bold;">${match}</span>`;
        });
        
        textoEl.innerHTML = textoProcessado;
        container.appendChild(textoEl);
      }
    }
    
    // Objetivos
    if ((opcao === 'objetivos' || opcao === 'completo') && objetivos?.length > 0) {
      const objetivosEl = document.createElement('div');
      objetivosEl.style.cssText = `margin-top: 20px;`;
      
      const tituloObj = document.createElement('h2');
      tituloObj.style.cssText = `
        font-size: 20px;
        color: #1e3a8a;
        margin: 0 0 20px 0;
        padding-bottom: 10px;
        border-bottom: 2px solid #93c5fd;
      `;
      tituloObj.textContent = 'Objetivos Definidos';
      objetivosEl.appendChild(tituloObj);
      
      objetivos.forEach((obj, index) => {
        const objEl = document.createElement('div');
        objEl.style.cssText = `
          margin-bottom: 15px;
          padding: 15px;
          border-left: 4px solid ${obj.concluido ? '#10b981' : '#3b82f6'};
          background: ${obj.concluido ? '#ecfdf5' : '#f0f9ff'};
          border-radius: 0 6px 6px 0;
        `;
        
        const conteudo = document.createElement('div');
        conteudo.style.cssText = `display: flex; flex-direction: column; gap: 8px;`;
        
        // Número e texto
        const linha1 = document.createElement('div');
        linha1.style.cssText = `display: flex; align-items: flex-start; gap: 10px;`;
        
        const numero = document.createElement('span');
        numero.style.cssText = `
          min-width: 24px;
          height: 24px;
          background: ${obj.concluido ? '#10b981' : '#3b82f6'};
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
        `;
        numero.textContent = index + 1;
        
        const textoObj = document.createElement('span');
        textoObj.style.cssText = `
          flex: 1;
          font-size: 15px;
          ${obj.concluido ? 'text-decoration: line-through; color: #065f46;' : ''}
        `;
        textoObj.textContent = obj.texto;
        
        linha1.appendChild(numero);
        linha1.appendChild(textoObj);
        conteudo.appendChild(linha1);
        
        // Responsáveis
        if (obj.responsaveis?.length > 0) {
          const respEl = document.createElement('div');
          respEl.style.cssText = `font-size: 13px; color: #4b5563; display: flex; align-items: center; gap: 6px;`;
          respEl.innerHTML = `<strong>Responsáveis:</strong> ${obj.responsaveis.map(r => r.nome_exibicao || r.nome || 'Usuário').join(', ')}`;
          conteudo.appendChild(respEl);
        }
        
        // Data de entrega
        if (obj.dataEntrega) {
          const dataEl = document.createElement('div');
          dataEl.style.cssText = `font-size: 13px; color: #4b5563; display: flex; align-items: center; gap: 6px;`;
          const dataFormatada = obj.dataEntrega.split('-').reverse().join('/');
          dataEl.innerHTML = `<strong>Data de entrega:</strong> ${dataFormatada}`;
          conteudo.appendChild(dataEl);
        }
        
        // Status
        const statusEl = document.createElement('div');
        statusEl.style.cssText = `
          font-size: 13px;
          font-weight: bold;
          color: ${obj.concluido ? '#065f46' : '#1e40af'};
          display: flex;
          align-items: center;
          gap: 6px;
        `;
        statusEl.innerHTML = obj.concluido 
          ? `<span style="color: #10b981;">✓ Concluído em ${obj.concluidoEm ? new Date(obj.concluidoEm).toLocaleDateString('pt-BR') : 'data não informada'}</span>`
          : `<span style="color: #3b82f6;">Em andamento</span>`;
        conteudo.appendChild(statusEl);
        
        // Comentário
        if (obj.comentario) {
          const comentarioEl = document.createElement('div');
          comentarioEl.style.cssText = `
            margin-top: 8px;
            padding: 8px 12px;
            background: #f3f4f6;
            border-radius: 6px;
            font-size: 13px;
            font-style: italic;
            color: #4b5563;
          `;
          comentarioEl.textContent = obj.comentario;
          conteudo.appendChild(comentarioEl);
        }
        
        objEl.appendChild(conteudo);
        objetivosEl.appendChild(objEl);
      });
      
      container.appendChild(objetivosEl);
    }
    
    // Rodapé
    const rodape = document.createElement('div');
    rodape.style.cssText = `
      margin-top: 40px;
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    `;
    rodape.innerHTML = `
      <div>Documento gerado automaticamente pelo sistema OnBox</div>
      <div>Data de emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    container.appendChild(rodape);
    
    return container;
  }
  
  static async gerarPDF(canvas, projetoNome, notaNome, opcao, margensPersonalizadas = null) {
    const imgData = canvas.toDataURL('image/png', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Usar margens personalizadas ou padrão
    const margemEsquerda = margensPersonalizadas?.esquerda || 15;
    const margemDireita = margensPersonalizadas?.direita || 15;
    const margemSuperior = margensPersonalizadas?.superior || 15;
    const margemInferior = margensPersonalizadas?.inferior || 15;
    
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const larguraUtil = pdfWidth - margemEsquerda - margemDireita;
    const alturaUtilPorPagina = pdfHeight - margemSuperior - margemInferior;
    
    const escalaLargura = larguraUtil / imgWidth;
    const imgPdfWidth = imgWidth * escalaLargura;
    const imgPdfHeight = imgHeight * escalaLargura;
    
    const numeroPaginas = Math.ceil(imgPdfHeight / alturaUtilPorPagina);
    
    for (let pagina = 0; pagina < numeroPaginas; pagina++) {
      if (pagina > 0) pdf.addPage();
      
      const yPosicao = margemSuperior - pagina * alturaUtilPorPagina;
      
      pdf.addImage(
        imgData,
        'PNG',
        margemEsquerda,
        yPosicao,
        imgPdfWidth,
        imgPdfHeight,
        undefined,
        'FAST'
      );
      
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(
        `Página ${pagina + 1} de ${numeroPaginas}`,
        pdfWidth / 2,
        pdfHeight - (margemInferior / 2),
        { align: 'center' }
      );
    }
    
    const tituloPDF = `ATA - ${projetoNome} - ${notaNome} (${opcao === 'texto' ? 'Texto' : opcao === 'objetivos' ? 'Objetivos' : 'Completo'})`;
    pdf.setProperties({
      title: tituloPDF,
      subject: 'Ata de Reunião',
      author: 'Sistema OnBox',
      keywords: 'ata, reunião, objetivos',
      creator: 'OnBox'
    });
    
    return pdf.output('blob');
  }
  
  static baixarArquivo(blob, nomeArquivo) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
  
  static formatarDataParaNome(data) {
    if (!data) return 'sem_data';
    try {
      const d = new Date(data);
      return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    } catch {
      return 'sem_data';
    }
  }
  
  static sanitizarNomeArquivo(nome) {
    if (!nome) return 'documento';
    return nome
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }
}

export default AtaPdf;