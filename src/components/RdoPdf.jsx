// src/components/RdoPdf.jsx
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

class RdoPdf {
  static async exportar(projetoNome, dataOriginal) {
    let loadingMsg = null;
    let espacoInferior = null;
    try {
      loadingMsg = this.criarMensagemCarregamento();
      document.body.appendChild(loadingMsg);

      const containerRdo = document.querySelector('.rdo-modal-container');
      if (!containerRdo) {
        this.removerMensagemCarregamento(loadingMsg);
        alert('Erro ao encontrar o conteúdo do RDO.');
        return;
      }

      // ✅ Salvar estilos originais
      const paddingOriginal = containerRdo.style.padding;
      const backgroundOriginal = containerRdo.style.background;
      const boxSizingOriginal = containerRdo.style.boxSizing;
      const marginBottomOriginal = containerRdo.style.marginBottom;
      const overflowOriginal = containerRdo.style.overflow;

      // ✅ Aplicar estilos temporários para garantir margens reais
      containerRdo.style.padding = '20px';
      containerRdo.style.background = '#ffffff';
      containerRdo.style.boxSizing = 'border-box';
      containerRdo.style.marginBottom = '50px'; // força espaço extra na base
      containerRdo.style.overflow = 'visible'; // evita corte por overflow

      // ✅ Adicionar elemento físico branco no final (não invisível!)
      espacoInferior = document.createElement('div');
      espacoInferior.style.height = '30px';
      espacoInferior.style.backgroundColor = '#ffffff';
      espacoInferior.style.marginTop = '10px';
      containerRdo.appendChild(espacoInferior);

      const elementosOcultar = this.ocultarElementos();

      // ✅ Capturar canvas com alta fidelidade
      const canvas = await html2canvas(containerRdo, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: containerRdo.scrollWidth,
        height: containerRdo.scrollHeight,
        windowWidth: containerRdo.scrollWidth,
        windowHeight: containerRdo.scrollHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });

      // ✅ Restaurar estilos originais
      containerRdo.style.padding = paddingOriginal;
      containerRdo.style.background = backgroundOriginal;
      containerRdo.style.boxSizing = boxSizingOriginal;
      containerRdo.style.marginBottom = marginBottomOriginal;
      containerRdo.style.overflow = overflowOriginal;

      // ✅ Remover elemento extra
      if (espacoInferior && espacoInferior.parentNode) {
        espacoInferior.parentNode.removeChild(espacoInferior);
      }

      this.restaurarElementos(elementosOcultar);
      this.removerMensagemCarregamento(loadingMsg);

      const blob = await this.gerarPDF(canvas, projetoNome, dataOriginal);

      // ✅ Nome seguro e formatado
      const nomeSeguro = this.sanitizarNomeArquivo(projetoNome);
      const dataFormatada = this.formatarDataParaNomeArquivo(dataOriginal);
      const nomeArquivo = `RDO - ${nomeSeguro} - ${dataFormatada}.pdf`;

      this.baixarArquivo(blob, nomeArquivo);
      alert('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      if (loadingMsg) this.removerMensagemCarregamento(loadingMsg);
      if (espacoInferior && espacoInferior.parentNode) {
        espacoInferior.parentNode.removeChild(espacoInferior);
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
      '.rdo-pavimento-select-dropdown',
      '.rdo-pavimento-camera-btn',
      '.rdo-pavimento-foto-remover',
      '.rdo-opcoes-foto-overlay',
    ];

    const elementosOcultos = [];
    seletores.forEach(seletor => {
      document.querySelectorAll(seletor).forEach(el => {
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

    pdf.setProperties({
      title: `RDO - ${projetoNome} - ${this.formatarDataLegivel(dataOriginal)}`,
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
    } catch {
      return 'sem_data';
    }
  }

  static formatarDataLegivel(data) {
    if (!data) return 'Data não informada';
    try {
      const [ano, mes, dia] = data.split('-');
      return `${dia}/${mes}/${ano}`;
    } catch {
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

  // === MÉTODO CUSTOMIZADO (mantido para compatibilidade) ===

  static async exportarCustomizado(opcoes = {}) {
    const {
      projetoNome = 'projeto',
      dataOriginal = null,
      seletor = '.rdo-modal-container',
      qualidade = 2,
      margens = {
        superior: 15,
        inferior: 15,
        esquerda: 15,
        direita: 15
      }
    } = opcoes;

    let loadingMsg = null;
    let espacoInferior = null;
    try {
      loadingMsg = this.criarMensagemCarregamento();
      document.body.appendChild(loadingMsg);

      const containerRdo = document.querySelector(seletor);
      if (!containerRdo) {
        this.removerMensagemCarregamento(loadingMsg);
        alert(`Erro: elemento "${seletor}" não encontrado.`);
        return;
      }

      // ✅ Salvar estilos originais
      const paddingOriginal = containerRdo.style.padding;
      const backgroundOriginal = containerRdo.style.background;
      const boxSizingOriginal = containerRdo.style.boxSizing;
      const marginBottomOriginal = containerRdo.style.marginBottom;
      const overflowOriginal = containerRdo.style.overflow;

      // ✅ Aplicar estilos temporários
      containerRdo.style.padding = '10px';
      containerRdo.style.background = '#ffffff';
      containerRdo.style.boxSizing = 'border-box';
      containerRdo.style.marginBottom = '40px';
      containerRdo.style.overflow = 'visible';

      // ✅ Espaço físico no final
      espacoInferior = document.createElement('div');
      espacoInferior.style.height = '25px';
      espacoInferior.style.backgroundColor = '#ffffff';
      espacoInferior.style.marginTop = '8px';
      containerRdo.appendChild(espacoInferior);

      const elementosOcultar = this.ocultarElementos();

      const canvas = await html2canvas(containerRdo, {
        scale: qualidade,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: containerRdo.scrollWidth,
        height: containerRdo.scrollHeight,
      });

      // ✅ Restaurar
      containerRdo.style.padding = paddingOriginal;
      containerRdo.style.background = backgroundOriginal;
      containerRdo.style.boxSizing = boxSizingOriginal;
      containerRdo.style.marginBottom = marginBottomOriginal;
      containerRdo.style.overflow = overflowOriginal;

      if (espacoInferior && espacoInferior.parentNode) {
        espacoInferior.parentNode.removeChild(espacoInferior);
      }

      this.restaurarElementos(elementosOcultar);
      this.removerMensagemCarregamento(loadingMsg);

      const blob = await this.gerarPDFComMargens(canvas, projetoNome, dataOriginal, margens);

      const nomeSeguro = this.sanitizarNomeArquivo(projetoNome);
      const dataFormatada = this.formatarDataParaNomeArquivo(dataOriginal);
      const nomeArquivo = `RDO - ${nomeSeguro} - ${dataFormatada}.pdf`;

      this.baixarArquivo(blob, nomeArquivo);
      alert('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF customizado:', error);
      if (loadingMsg) this.removerMensagemCarregamento(loadingMsg);
      if (espacoInferior && espacoInferior.parentNode) {
        espacoInferior.parentNode.removeChild(espacoInferior);
      }
      alert(`Erro ao gerar PDF: ${error.message}`);
    }
  }

  static async gerarPDFComMargens(canvas, projetoNome, dataOriginal, margens) {
    const imgData = canvas.toDataURL('image/png', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const { superior, inferior, esquerda, direita } = margens;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const larguraUtil = pdfWidth - esquerda - direita;
    const alturaUtilPorPagina = pdfHeight - superior - inferior;

    const escalaLargura = larguraUtil / imgWidth;
    const imgPdfWidth = imgWidth * escalaLargura;
    const imgPdfHeight = imgHeight * escalaLargura;

    const numeroPaginas = Math.ceil(imgPdfHeight / alturaUtilPorPagina);

    for (let pagina = 0; pagina < numeroPaginas; pagina++) {
      if (pagina > 0) pdf.addPage();

      const yPosicao = superior - pagina * alturaUtilPorPagina;

      pdf.addImage(
        imgData,
        'PNG',
        esquerda,
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
        pdfHeight - (inferior / 2),
        { align: 'center' }
      );
    }

    pdf.setProperties({
      title: `RDO - ${projetoNome} - ${this.formatarDataLegivel(dataOriginal)}`,
      subject: 'Relatório Diário de Obra',
      author: 'Sistema de Gestão',
      keywords: 'RDO, obra, relatório',
      creator: 'Sistema de Gestão'
    });

    return pdf.output('blob');
  }
}

export default RdoPdf;