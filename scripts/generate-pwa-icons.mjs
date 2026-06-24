import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2563eb"/>
  <rect x="96" y="120" width="320" height="272" rx="24" fill="#ffffff"/>
  <rect x="136" y="168" width="120" height="16" rx="8" fill="#2563eb"/>
  <rect x="136" y="208" width="240" height="16" rx="8" fill="#93c5fd"/>
  <rect x="136" y="248" width="200" height="16" rx="8" fill="#93c5fd"/>
  <rect x="136" y="288" width="160" height="16" rx="8" fill="#93c5fd"/>
  <circle cx="360" cy="328" r="48" fill="#f59e0b"/>
  <text x="360" y="342" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#ffffff">M</text>
</svg>
`;

async function main() {
  const outDir = path.join(process.cwd(), "public", "icons");
  await mkdir(outDir, { recursive: true });

  const sizes = [
    { name: "apple-touch-icon.png", size: 180 },
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
  ];

  for (const { name, size } of sizes) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, name));
  }

  console.log("PWA icons generated in public/icons/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
