// src/config/images.js

// ⚙️ Controle da migração - mude para true quando estiver pronto
const USE_CLOUDINARY = true;

// 🎨 URLs do Cloudinary (otimizadas automaticamente)
const cloudinary = {
  // Imagens numeradas (usar image1, image2 pois "1" não é nome válido)
  image1: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829061/onbox/1.jpg',
  image2: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829062/onbox/2.jpg',
  
  // Backgrounds
  back: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829063/onbox/back.jpg',
  back1: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829064/onbox/back1.jpg',
  back2: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829065/onbox/back2.jpg',
  back3: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829067/onbox/back3.jpg',
  
  // Ícones e assets
  dataTransfer: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829068/onbox/data-transfer.png',
  file: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829069/onbox/file.jpg',
  material: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829070/onbox/material.jpg',
  
  // Onbox images
  ob1: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829072/onbox/ob1.png',
  ob2: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829073/onbox/ob2.png',
  ob3: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829074/onbox/ob3.jpg',
  ob4: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829075/onbox/ob4.jpg',
  ob5: 'https://res.cloudinary.com/dmecovtmm/image/upload/q_auto,f_auto/v1768829076/onbox/ob5.jpg',
};

// 📁 Imports locais (fallback)
let local = {};

if (!USE_CLOUDINARY) {
  // Só importa se não estiver usando Cloudinary
  local = {
    image1: require('../assets/1.png'),
    image2: require('../assets/2.png'),
    back: require('../assets/back.png'),
    back1: require('../assets/back1.png'),
    back2: require('../assets/back2.png'),
    back3: require('../assets/back3.png'),
    dataTransfer: require('../assets/data-transfer.png'),
    file: require('../assets/file.png'),
    material: require('../assets/material.png'),
    ob1: require('../assets/ob1.png'),
    ob2: require('../assets/ob2.png'),
    ob3: require('../assets/ob3.png'),
    ob4: require('../assets/ob4.png'),
    ob5: require('../assets/ob5.png'),
  };
}

// 🚀 Export final - usa Cloudinary ou local
export const images = USE_CLOUDINARY ? cloudinary : local;

// 🎯 Helper para imagens responsivas (opcional)
export const getResponsiveImage = (imageName, width) => {
  if (!USE_CLOUDINARY) return images[imageName];
  
  const baseUrl = cloudinary[imageName];
  if (!baseUrl) return '';
  
  // Adiciona transformação de largura
  return baseUrl.replace('/upload/', `/upload/w_${width},c_scale,`);
};

// 📝 Exemplo de uso:
// import { images, getResponsiveImage } from './config/images'
// 
// <img src={images.back3} alt="Background" />
// <img src={getResponsiveImage('back3', 800)} alt="Background responsivo" />