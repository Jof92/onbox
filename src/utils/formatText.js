// src/utils/formatText.js
export const formatText = (text) => {
  if (!text) return text;

  // Handle *bold* → <strong>
  const boldRegex = /\*([^*]+)\*/g;
  // Handle _italic_ → <em>
  const italicRegex = /_([^_]+)_/g;

  // Split by bold first, then apply italic inside
  const parts = text.split(boldRegex);
  const formatted = parts.map((part, i) => {
    if (i % 2 === 1) {
      // Bold content: now check for italic inside
      const italicParts = part.split(italicRegex);
      return (
        <strong key={i}>
          {italicParts.map((subPart, j) => {
            if (j % 2 === 1) return <em key={j}>{subPart}</em>;
            return subPart;
          })}
        </strong>
      );
    } else {
      // Not bold: check for italic
      const italicParts = part.split(italicRegex);
      return italicParts.map((subPart, j) => {
        if (j % 2 === 1) return <em key={j}>{subPart}</em>;
        return subPart;
      });
    }
  });

  return formatted;
};