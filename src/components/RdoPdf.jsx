// src/components/RdoPdf.jsx
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

class RdoPdf {
  static async exportar(projetoNome, dataOriginal) {
    let loadingMsg = null;
    try {
      loadingMsg = this.criarMensagemCarregamento();
      document.body.appendChild(loadingMsg);

      const containerRdo = document.querySelector('.rdo-modal-container');
      if (!containerRdo) {
        this.removerMensagemCarregamento(loadingMsg);
        alert('Erro ao encontrar o conteúdo do RDO.');
        return;
      }

      const elementosOcultar = this.ocultarElementos();

      const canvas = await html2canvas(containerRdo, {
        scale: 1,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: containerRdo.scrollWidth,
        height: containerRdo.scrollHeight,
      });

      this.restaurarElementos(elementosOcultar);
      this.removerMensagemCarregamento(loadingMsg);

      const blob = await this.gerarPDF(canvas, projetoNome, dataOriginal);
      
      const dataFormatada = this.formatarDataParaNomeArquivo(dataOriginal);
      const nomeArquivo = `RDO_${this.sanitizarNomeArquivo(projetoNome)}_${dataFormatada}.pdf`;
      
      this.baixarArquivo(blob, nomeArquivo);

      alert('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      if (loadingMsg) {
        this.removerMensagemCarregamento(loadingMsg);
      }
      alert(`Erro ao gerar PDF: ${error.message}`);
    }
  }

  static criarMensagemCarregamento() {
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'rdo-pdf-loading';
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

  static ocultarElementos() {
    const seletores = [
      '.rdo-actions',
      '.rdo-export-buttons',
      '.rdo-add-button-group',
      '.rdo-pavimento-remover',
      '.rdo-foto-remove',
      '.lupa-busca-btn',
      '.data-transfer-icon',
      '.listagem-close-btn',
      '.rdo-lightbox',
      '.suggestions-dropdown',
      '.rdo-pavimento-select-dropdown'
    ];

    const elementosOcultos = [];

    seletores.forEach(seletor => {
      const elementos = document.querySelectorAll(seletor);
      elementos.forEach(el => {
        elementosOcultos.push({
          elemento: el,
          displayOriginal: el.style.display
        });
        el.style.display = 'none';
      });
    });

    return elementosOcultos;
  }

  static restaurarElementos(elementosOcultos) {
    elementosOcultos.forEach(({ elemento, displayOriginal }) => {
      elemento.style.display = displayOriginal;
    });
  }

  static async gerarPDF(canvas, projetoNome, dataOriginal) {
    const imgData = canvas.toDataURL('image/png', 0.85);
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const margemHorizontal = 8;
    const margemSuperior = 8;
    const margemInferior = 10;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const larguraUtil = pdfWidth - (margemHorizontal * 2);
    
    const NUMERO_PAGINAS = 2;
    const alturaUtil = pdfHeight - margemSuperior - margemInferior;
    const alturaTotalDisponivel = alturaUtil * NUMERO_PAGINAS;
    
    const razaoLargura = larguraUtil / imgWidth;
    const razaoAltura = alturaTotalDisponivel / imgHeight;
    const razao = Math.min(razaoLargura, razaoAltura);
    
    const imgPdfWidth = imgWidth * razao;
    const imgPdfHeight = imgHeight * razao;
    
    const centralizarX = (pdfWidth - imgPdfWidth) / 2;

    for (let pagina = 0; pagina < NUMERO_PAGINAS; pagina++) {
      if (pagina > 0) {
        pdf.addPage();
      }

      const yOffset = -(alturaUtil * pagina);
      
      pdf.addImage(
        imgData,
        'PNG',
        centralizarX,
        margemSuperior + yOffset,
        imgPdfWidth,
        imgPdfHeight,
        undefined,
        'FAST'
      );

      pdf.setFontSize(7);
      pdf.setTextColor(120, 120, 120);
      
      pdf.text(
        `Página ${pagina + 1} de ${NUMERO_PAGINAS}`,
        pdfWidth / 2,
        pdfHeight - 5,
        { align: 'center' }
      );
    }

    pdf.setProperties({
      title: `RDO - ${projetoNome}`,
      subject: 'Relatório Diário de Obra',
      author: 'Sistema de Gestão',
      keywords: 'RDO, obra, relatório',
      creator: 'Sistema de Gestão'
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

  static formatarDataParaNomeArquivo(data) {
    if (!data) return 'sem_data';
    
    try {
      const [ano, mes, dia] = data.split('-');
      return `${dia}-${mes}-${ano}`;
    } catch (error) {
      return 'sem_data';
    }
  }

  static formatarDataLegivel(data) {
    if (!data) return 'Data não informada';
    
    try {
      const [ano, mes, dia] = data.split('-');
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${dia}/${meses[parseInt(mes) - 1]}/${ano}`;
    } catch (error) {
      return 'Data não informada';
    }
  }

  static sanitizarNomeArquivo(nome) {
    if (!nome) return 'projeto';
    
    return nome
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  static async exportarCustomizado(opcoes = {}) {
    const {
      projetoNome = 'projeto',
      dataOriginal = null,
      seletor = '.rdo-modal-container',
      qualidade = 1,
      numeroPaginas = 2
    } = opcoes;

    let loadingMsg = null;
    try {
      loadingMsg = this.criarMensagemCarregamento();
      document.body.appendChild(loadingMsg);

      const elemento = document.querySelector(seletor);
      if (!elemento) {
        this.removerMensagemCarregamento(loadingMsg);
        alert(`Erro: elemento "${seletor}" não encontrado.`);
        return;
      }

      const elementosOcultar = this.ocultarElementos();

      const canvas = await html2canvas(elemento, {
        scale: qualidade,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      this.restaurarElementos(elementosOcultar);
      this.removerMensagemCarregamento(loadingMsg);

      const blob = await this.gerarPDFCustomizado(canvas, projetoNome, dataOriginal, numeroPaginas);
      
      const dataFormatada = this.formatarDataParaNomeArquivo(dataOriginal);
      const nomeArquivo = `RDO_${this.sanitizarNomeArquivo(projetoNome)}_${dataFormatada}.pdf`;
      
      this.baixarArquivo(blob, nomeArquivo);

      alert('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      if (loadingMsg) {
        this.removerMensagemCarregamento(loadingMsg);
      }
      alert(`Erro ao gerar PDF: ${error.message}`);
    }
  }

  static async gerarPDFCustomizado(canvas, projetoNome, dataOriginal, numeroPaginas) {
    const imgData = canvas.toDataURL('image/png', 0.85);
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const margemHorizontal = 8;
    const margemSuperior = 8;
    const margemInferior = 10;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const larguraUtil = pdfWidth - (margemHorizontal * 2);
    const alturaUtil = pdfHeight - margemSuperior - margemInferior;
    const alturaTotalDisponivel = alturaUtil * numeroPaginas;
    
    const razaoLargura = larguraUtil / imgWidth;
    const razaoAltura = alturaTotalDisponivel / imgHeight;
    const razao = Math.min(razaoLargura, razaoAltura);
    
    const imgPdfWidth = imgWidth * razao;
    const imgPdfHeight = imgHeight * razao;
    
    const centralizarX = (pdfWidth - imgPdfWidth) / 2;

    for (let pagina = 0; pagina < numeroPaginas; pagina++) {
      if (pagina > 0) {
        pdf.addPage();
      }

      const yOffset = -(alturaUtil * pagina);
      
      pdf.addImage(
        imgData,
        'PNG',
        centralizarX,
        margemSuperior + yOffset,
        imgPdfWidth,
        imgPdfHeight,
        undefined,
        'FAST'
      );

      pdf.setFontSize(7);
      pdf.setTextColor(120, 120, 120);
      
      pdf.text(
        `Página ${pagina + 1} de ${numeroPaginas}`,
        pdfWidth / 2,
        pdfHeight - 5,
        { align: 'center' }
      );
    }

    pdf.setProperties({
      title: `RDO - ${projetoNome}`,
      subject: 'Relatório Diário de Obra',
      author: 'Sistema de Gestão',
      keywords: 'RDO, obra, relatório',
      creator: 'Sistema de Gestão'
    });

    return pdf.output('blob');
  }
}

export default RdoPdf;