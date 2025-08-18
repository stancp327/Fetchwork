const sharp = require('sharp');

async function tileWatermark(inputPath, outputPath, text = 'FetchWork', opacity = 0.3) {
  const img = sharp(inputPath);
  const { width, height } = await img.metadata();
  const tile = await sharp({
    create: {
      width: 400,
      height: 200,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();

  const svg = `
    <svg width="400" height="200">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="white" stop-opacity="${opacity}"/>
          <stop offset="100%" stop-color="white" stop-opacity="${opacity}"/>
        </linearGradient>
      </defs>
      <g transform="rotate(-30 200 100)">
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-family="Arial, sans-serif" font-size="36" fill="url(#g)">${text}</text>
      </g>
    </svg>`;
  const svgBuf = Buffer.from(svg);

  const overlayTile = await sharp(tile).composite([{ input: svgBuf, gravity: 'center' }]).png().toBuffer();

  const cols = Math.ceil((width || 1200) / 300);
  const rows = Math.ceil((height || 800) / 150);

  const overlays = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      overlays.push({ input: overlayTile, left: x * 300, top: y * 150 });
    }
  }

  await img
    .composite(overlays)
    .toFile(outputPath);
}

module.exports = { tileWatermark };
