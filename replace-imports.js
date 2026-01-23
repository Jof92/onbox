// replace-imports.js
// Script para substituir imports automaticamente
// USO: node replace-imports.js

const fs = require('fs');
const path = require('path');

// Lista de arquivos para processar (baseado no grep)
const filesToProcess = [
  'src/components/Header.jsx',
  'src/pages/Home.jsx',
  'src/components/ProjectManager.jsx',
  'src/pages/Rdo.jsx'
];

// Mapeamento de imports antigos
const importPatterns = [
  { pattern: /import\s+ob2\s+from\s+['"](\.\.\/)?assets\/ob2\.png['"];?\s*/g, name: 'ob2' },
  { pattern: /import\s+imgMaterial\s+from\s+['"](\.\.\/)?assets\/material\.png['"];?\s*/g, name: 'material' },
  { pattern: /import\s+imgOb4\s+from\s+['"](\.\.\/)?assets\/ob1\.png['"];?\s*/g, name: 'ob1' },
  { pattern: /import\s+imgScroll\s+from\s+['"](\.\.\/)?assets\/1\.png['"];?\s*/g, name: 'image1' },
  { pattern: /import\s+backImg\s+from\s+['"](\.\.\/)?assets\/back\.png['"];?\s*/g, name: 'back' },
  { pattern: /import\s+back1Img\s+from\s+['"](\.\.\/)?assets\/back1\.png['"];?\s*/g, name: 'back1' },
  { pattern: /import\s+back2Img\s+from\s+['"](\.\.\/)?assets\/back2\.png['"];?\s*/g, name: 'back2' },
  { pattern: /import\s+back3Img\s+from\s+['"](\.\.\/)?assets\/back3\.png['"];?\s*/g, name: 'back3' },
  { pattern: /import\s+dataTransferImage\s+from\s+['"](\.\.\/)?assets\/data-transfer\.png['"];?\s*/g, name: 'dataTransfer' },
];

// Mapeamento de uso das variáveis
const usageReplacements = [
  { old: /\{ob2\}/g, new: '{images.ob2}' },
  { old: /src=\{ob2\}/g, new: 'src={images.ob2}' },
  { old: /\{imgMaterial\}/g, new: '{images.material}' },
  { old: /src=\{imgMaterial\}/g, new: 'src={images.material}' },
  { old: /\{imgOb4\}/g, new: '{images.ob1}' },
  { old: /src=\{imgOb4\}/g, new: 'src={images.ob1}' },
  { old: /\{imgScroll\}/g, new: '{images.image1}' },
  { old: /src=\{imgScroll\}/g, new: 'src={images.image1}' },
  { old: /\{backImg\}/g, new: '{images.back}' },
  { old: /src=\{backImg\}/g, new: 'src={images.back}' },
  { old: /\{back1Img\}/g, new: '{images.back1}' },
  { old: /src=\{back1Img\}/g, new: 'src={images.back1}' },
  { old: /\{back2Img\}/g, new: '{images.back2}' },
  { old: /src=\{back2Img\}/g, new: 'src={images.back2}' },
  { old: /\{back3Img\}/g, new: '{images.back3}' },
  { old: /src=\{back3Img\}/g, new: 'src={images.back3}' },
  { old: /\{dataTransferImage\}/g, new: '{images.dataTransfer}' },
  { old: /src=\{dataTransferImage\}/g, new: 'src={images.dataTransfer}' },
  // Casos com backgroundImage
  { old: /backgroundImage:\s*`url\(\$\{backImg\}\)`/g, new: 'backgroundImage: `url(${images.back})`' },
  { old: /backgroundImage:\s*`url\(\$\{back1Img\}\)`/g, new: 'backgroundImage: `url(${images.back1})`' },
  { old: /backgroundImage:\s*`url\(\$\{back2Img\}\)`/g, new: 'backgroundImage: `url(${images.back2})`' },
  { old: /backgroundImage:\s*`url\(\$\{back3Img\}\)`/g, new: 'backgroundImage: `url(${images.back3})`' },
];

function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Arquivo não encontrado: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remove imports antigos
  importPatterns.forEach(({ pattern }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      modified = true;
    }
  });

  // Adiciona import do images se necessário
  if (modified && !content.includes("import { images } from")) {
    // Encontra a última linha de import
    const lines = content.split('\n');
    let lastImportIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    // Determina o caminho relativo correto
    let importPath = './config/images';
    if (filePath.includes('pages/')) {
      importPath = '../config/images';
    } else if (filePath.includes('components/')) {
      importPath = '../config/images';
    }
    
    const importStatement = `import { images } from "${importPath}";`;
    
    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, importStatement);
      content = lines.join('\n');
    }
  }

  // Substitui o uso das variáveis
  usageReplacements.forEach(({ old, new: newVal }) => {
    if (old.test(content)) {
      content = content.replace(old, newVal);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Atualizado: ${filePath}`);
    return true;
  }
  
  return false;
}

// Executar
console.log('🔄 Processando arquivos...\n');
let count = 0;

filesToProcess.forEach(file => {
  if (processFile(file)) count++;
});

console.log(`\n✅ ${count} arquivo(s) modificado(s)!`);

if (count > 0) {
  console.log('\n📋 Próximos passos:');
  console.log('1. git diff          - Revisar mudanças');
  console.log('2. npm start         - Testar localmente');
  console.log('3. Verificar se todas as imagens carregam corretamente');
}