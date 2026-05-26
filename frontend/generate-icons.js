const sharp = require('sharp');

const sizes = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
];

async function generate() {
  for (const { file, size } of sizes) {
    const innerSize = Math.round(size * 0.70);
    const padding = Math.round((size - innerSize) / 2);

    await sharp('public/Icono.svg')
      .resize(innerSize, innerSize, { fit: 'contain', background: '#185FA5' })
      .extend({
        top: padding,
        bottom: size - innerSize - padding,
        left: padding,
        right: size - innerSize - padding,
        background: '#185FA5',
      })
      .flatten({ background: '#185FA5' })
      .png()
      .toFile(file);

    console.log(`Generado: ${file} (${size}x${size}, inner: ${innerSize}px)`);
  }
}

generate();
