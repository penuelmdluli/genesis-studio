import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");

async function generateIcon(size, outPath) {
  const r = Math.round(size * 0.2); // corner radius ~20%
  const fontSize = Math.round(size * 0.55);
  const yOffset = Math.round(size * 0.04); // nudge baseline

  const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <text x="50%" y="50%" dy="${yOffset}" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="${fontSize}px" fill="white">G</text>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log(`Created ${outPath} (${size}x${size})`);
}

await generateIcon(192, path.join(outDir, "icon-192.png"));
await generateIcon(512, path.join(outDir, "icon-512.png"));
