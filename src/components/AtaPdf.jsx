// src/components/AtaPdf.jsx
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

class AtaPdf {
  static async exportar(opcao, projetoNome, notaNome, dataLocal, pauta, local, texto, participantes, objetivos = []) {
    let loadingMsg = null;
    try {
      loadingMsg = this.criarMensagemCarregamento();
      document.body.appendChild(loadingMsg);

      // Criar container temporário com o conteúdo a ser exportado
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
      document.body.appendChild(containerTemp);

      // Capturar canvas
      const canvas = await html2canvas(containerTemp, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: containerTemp.scrollWidth,
        height: containerTemp.scrollHeight,
        windowWidth: containerTemp.scrollWidth,
        windowHeight: containerTemp.scrollHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });

      // Remover container temporário
      document.body.removeChild(containerTemp);
      this.removerMensagemCarregamento(loadingMsg);

      // Gerar PDF
      const blob = await this.gerarPDF(canvas, projetoNome, notaNome, opcao);

      // Baixar arquivo
      const nomeSeguro = this.sanitizarNomeArquivo(projetoNome);
      const nomeNota = this.sanitizarNomeArquivo(notaNome);
      const dataFormatada = dataLocal ? this.formatarDataParaNome(nomeSeguro) : 'sem_data';
      const sufixo = opcao === 'texto' ? 'texto' : opcao === 'objetivos' ? 'objetivos' : 'completo';
      const nomeArquivo = `ATA - ${nomeSeguro} - ${nomeNota} - ${sufixo}.pdf`;

      this.baixarArquivo(blob, nomeArquivo);
      alert('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      if (loadingMsg) this.removerMensagemCarregamento(loadingMsg);
      alert(`Erro ao gerar PDF: ${error.message}`);
    }
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
      position: absolute;
      left: -9999px;
      top: -9999px;
      width: 794px; /* A4 width in pixels at 96 DPI */
      background: white;
      padding: 40px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      box-sizing: border-box;
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

  static async gerarPDF(canvas, projetoNome, notaNome, opcao) {
    const imgData = canvas.toDataURL('image/png', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const margemEsquerda = 15;
    const margemDireita = 15;
    const margemSuperior = 15;
    const margemInferior = 15;

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