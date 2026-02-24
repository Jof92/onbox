// src/components/ListagemPdf.jsx
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';

class ListagemPdf {
  static async exportar(projetoNome, notaNome, dataExportacao, rows = []) {
    let loadingMsg = null;

    try {
      loadingMsg = this.criarMensagemCarregamento();
      document.body.appendChild(loadingMsg);

      // Filtrar apenas linhas com dados válidos
      const linhasValidas = rows.filter(r => 
        r.codigo?.trim() || r.descricao?.trim() || r.quantidade
      );

      if (linhasValidas.length === 0) {
        this.removerMensagemCarregamento(loadingMsg);
        alert('Nenhum insumo para exportar. Adicione itens à listagem.');
        return;
      }

      // Gerar PDF com tabela de insumos
      const blob = await this.gerarPDFComTabela(
        projetoNome, 
        notaNome, 
        dataExportacao, 
        linhasValidas
      );

      // Nome seguro e formatado
      const nomeSeguro = this.sanitizarNomeArquivo(projetoNome);
      const notaSegura = this.sanitizarNomeArquivo(notaNome);
      const dataFormatada = this.formatarDataParaNomeArquivo(dataExportacao);
      const nomeArquivo = `Listagem - ${nomeSeguro} - ${notaSegura} - ${dataFormatada}.pdf`;

      this.removerMensagemCarregamento(loadingMsg);
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
    loadingMsg.id = 'listagem-pdf-loading';
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

  static async gerarPDFComTabela(projetoNome, notaNome, dataExportacao, rows) {
    // ===== MODO PAISAGEM (LANDSCAPE) =====
    const pdf = new jsPDF('l', 'mm', 'a4');  // 'l' = landscape

    const margemEsquerda = 12;
    const margemDireita = 12;
    const margemSuperior = 12;
    const margemInferior = 15;

    const pdfWidth = pdf.internal.pageSize.getWidth();   // ~297mm em paisagem
    const pdfHeight = pdf.internal.pageSize.getHeight();  // ~210mm em paisagem

    // ===== CABEÇALHO =====
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('LISTAGEM DE INSUMOS', margemEsquerda, margemSuperior + 8);

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Projeto: ${projetoNome}`, margemEsquerda, margemSuperior + 17);
    pdf.text(`Nota: ${notaNome}`, margemEsquerda, margemSuperior + 24);
    pdf.text(
      `Data de Exportação: ${this.formatarDataLegivel(dataExportacao)}`,
      margemEsquerda,
      margemSuperior + 31
    );

    // ===== TABELA =====
    const tableData = rows.map(row => {
      const locacaoStr = Array.isArray(row.locacao) && row.locacao.length > 0 
        ? row.locacao.join(', ') 
        : '–';

      return [
        row.codigo || '–',
        row.descricao || '–',
        row.unidade || '–',
        row.quantidade ? this.formatarNumero(row.quantidade) : '–',
        locacaoStr,
        row.eap || '–',
        row.observacao || '–',
        row.comentario || '–',
      ];
    });

    autoTable(pdf, {
      startY: margemSuperior + 38,
      margin: { left: margemEsquerda, right: margemDireita, top: margemSuperior, bottom: margemInferior },
      head: [['Código', 'Descrição', 'Unidade', 'Qtd', 'Locação', 'EAP', 'Observação', 'Comentário']],
      body: tableData,
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        fontSize: 10,
        cellPadding: 4,
        minCellHeight: 9,
        overflow: 'linebreak',
        lineWidth: 0.3,
        lineColor: [255, 255, 255],
      },
      bodyStyles: {
        textColor: 50,
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle',
        lineWidth: 0.3,
        lineColor: [200, 200, 200],
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', overflow: 'visible' },   // Código
        1: { cellWidth: 58, halign: 'left', overflow: 'linebreak' },   // Descrição (MAIOR em paisagem)
        2: { cellWidth: 14, halign: 'center', overflow: 'visible' },   // Unidade
        3: { cellWidth: 12, halign: 'center', overflow: 'visible' },   // Qtd
        4: { cellWidth: 52, halign: 'left', overflow: 'linebreak' },   // Locação (MAIOR)
        5: { cellWidth: 24, halign: 'left', overflow: 'linebreak' },   // EAP
        6: { cellWidth: 26, halign: 'left', overflow: 'linebreak' },   // Observação
        7: { cellWidth: 26, halign: 'left', overflow: 'linebreak' },   // Comentário
      },
      alternateRowStyles: {
        fillColor: [245, 248, 251],
      },
      didDrawPage: (data) => {
        // Rodapé - Página (centro)
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        const pageCount = pdf.internal.pages.length;
        const currentPage = data.pageNumber || 1;
        
        pdf.text(
          `Página ${currentPage} de ${pageCount - 1}`,
          pdfWidth / 2,
          pdfHeight - 8,
          { align: 'center' }
        );

        // Rodapé - Gerado por Onbox (esquerda)
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(41, 128, 185);
        pdf.text(
          'Gerado por Onbox',
          margemEsquerda,
          pdfHeight - 5,
        );
      },
    });

    // ===== PROPRIEDADES DO PDF =====
    pdf.setProperties({
      title: `Listagem - ${projetoNome} - ${notaNome}`,
      subject: 'Listagem de Insumos',
      author: 'Sistema de Gestão',
      keywords: 'listagem, insumos, obra',
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
      if (data instanceof Date) {
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        return `${dia}-${mes}-${ano}`;
      }
      const [ano, mes, dia] = data.split('-');
      return `${dia}-${mes}-${ano}`;
    } catch {
      return 'sem_data';
    }
  }

  static formatarDataLegivel(data) {
    if (!data) return 'Data não informada';
    try {
      if (data instanceof Date) {
        return data.toLocaleDateString('pt-BR');
      }
      const [ano, mes, dia] = data.split('-');
      return `${dia}/${mes}/${ano}`;
    } catch {
      return 'Data não informada';
    }
  }

  static formatarNumero(num) {
    if (!num) return '0';
    const numero = parseFloat(num);
    if (isNaN(numero)) return String(num);
    // Formatar com até 2 casas decimais, removendo zeros desnecessários
    return numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  static sanitizarNomeArquivo(nome) {
    if (!nome) return 'documento';
    return nome
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }
}

export default ListagemPdf;