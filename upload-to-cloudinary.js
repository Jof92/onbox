// upload-to-cloudinary.js
// npm install cloudinary dotenv

require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const assetsDir = path.join(__dirname, 'src', 'assets');
const urlsMap = {};

async function uploadImage(filePath) {
  try {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'onbox',
      public_id: fileName,
      overwrite: true,
      // Otimizações automáticas
      quality: 'auto:good',
      fetch_format: 'auto'
    });

    console.log(`✓ ${fileName} uploaded - ${result.secure_url}`);
    
    urlsMap[path.basename(filePath)] = {
      original: result.secure_url,
      optimized: result.secure_url.replace('/upload/', '/upload/q_auto,f_auto/')
    };

    return result;
  } catch (error) {
    console.error(`✗ Erro ao fazer upload de ${filePath}:`, error.message);
  }
}

async function uploadAllImages() {
  const files = fs.readdirSync(assetsDir)
    .filter(file => /\.(png|jpg|jpeg|gif|webp)$/i.test(file))
    .map(file => path.join(assetsDir, file));

  console.log(`\nEncontramos ${files.length} imagens para fazer upload...\n`);

  for (const file of files) {
    await uploadImage(file);
  }

  // Salva o mapeamento de URLs
  fs.writeFileSync(
    'cloudinary-urls.json',
    JSON.stringify(urlsMap, null, 2)
  );

  console.log('\n✓ Todas as imagens foram enviadas!');
  console.log('✓ URLs salvas em cloudinary-urls.json');
  
  generateMigrationCode();
}

function generateMigrationCode() {
  console.log('\n=== CÓDIGO PARA SUBSTITUIR NOS COMPONENTES ===\n');
  
  Object.entries(urlsMap).forEach(([fileName, urls]) => {
    const varName = fileName.replace(/\.(png|jpg|jpeg)$/i, '');
    console.log(`// Antes: import ${varName} from './assets/${fileName}'`);
    console.log(`const ${varName} = '${urls.optimized}';\n`);
  });
}

// Executar
uploadAllImages().catch(console.error);