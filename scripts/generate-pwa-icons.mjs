import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="64" y1="48" x2="448" y2="464" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0d9488"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="header" x1="96" y1="140" x2="416" y2="212" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#1e40af"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <rect x="112" y="108" width="28" height="64" rx="14" fill="#ffffff" opacity="0.95"/>
  <rect x="372" y="108" width="28" height="64" rx="14" fill="#ffffff" opacity="0.95"/>
  <rect x="88" y="148" width="336" height="276" rx="36" fill="#ffffff"/>
  <rect x="88" y="148" width="336" height="84" rx="36" fill="url(#header)"/>
  <rect x="88" y="208" width="336" height="24" fill="url(#header)"/>
  <circle cx="156" cy="196" r="10" fill="#ffffff" opacity="0.85"/>
  <circle cx="196" cy="196" r="10" fill="#ffffff" opacity="0.85"/>
  <circle cx="236" cy="196" r="10" fill="#ffffff" opacity="0.85"/>
  <text x="256" y="332" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="800" fill="#1d4ed8">365</text>
  <text x="256" y="272" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#0f766e" letter-spacing="2">EXPIRE</text>
  <circle cx="372" cy="372" r="44" fill="#f59e0b"/>
  <path d="M372 348v44M350 372h44" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
</svg>
`;

const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0d9488"/>
  <g transform="translate(56 56) scale(0.78)">
    <defs>
      <linearGradient id="bg2" x1="64" y1="48" x2="448" y2="464" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#0d9488"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
      <linearGradient id="header2" x1="96" y1="140" x2="416" y2="212" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#0f766e"/>
        <stop offset="100%" stop-color="#1e40af"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="108" fill="url(#bg2)"/>
    <rect x="112" y="108" width="28" height="64" rx="14" fill="#ffffff" opacity="0.95"/>
    <rect x="372" y="108" width="28" height="64" rx="14" fill="#ffffff" opacity="0.95"/>
    <rect x="88" y="148" width="336" height="276" rx="36" fill="#ffffff"/>
    <rect x="88" y="148" width="336" height="84" rx="36" fill="url(#header2)"/>
    <rect x="88" y="208" width="336" height="24" fill="url(#header2)"/>
    <circle cx="156" cy="196" r="10" fill="#ffffff" opacity="0.85"/>
    <circle cx="196" cy="196" r="10" fill="#ffffff" opacity="0.85"/>
    <circle cx="236" cy="196" r="10" fill="#ffffff" opacity="0.85"/>
    <text x="256" y="332" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="800" fill="#1d4ed8">365</text>
    <text x="256" y="272" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#0f766e" letter-spacing="2">EXPIRE</text>
    <circle cx="372" cy="372" r="44" fill="#f59e0b"/>
    <path d="M372 348v44M350 372h44" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
  </g>
</svg>
`;

async function main() {
  const outDir = path.join(process.cwd(), "public", "icons");
  await mkdir(outDir, { recursive: true });

  const sizes = [
    { name: "apple-touch-icon.png", size: 180, svg: iconSvg },
    { name: "icon-192.png", size: 192, svg: iconSvg },
    { name: "icon-512.png", size: 512, svg: iconSvg },
    { name: "icon-512-maskable.png", size: 512, svg: maskableSvg },
  ];

  for (const { name, size, svg } of sizes) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, name));
  }

  console.log("expire365 PWA icons generated in public/icons/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
