// src/utils/formatText.js

// Escapa caracteres HTML para evitar XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Converte *negrito* e _itálico_ em HTML, de forma segura
export function parseInlineFormatting(text) {
  if (!text) return "";

  // Primeiro, escapa todo o HTML para neutralizar qualquer tag maliciosa
  let safeText = escapeHtml(text);

  // Substitui *...* por <strong>...</strong>
  // Usa expressão regular não gulosa e evita * aninhados ou incompletos
  safeText = safeText.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');

  // Substitui _..._ por <em>...</em>
  safeText = safeText.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  return safeText;
}