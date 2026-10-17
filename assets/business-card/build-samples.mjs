import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../..");
const samplesDir = path.join(dir, "samples");
fs.mkdirSync(samplesDir, { recursive: true });

const icon = fs
  .readFileSync(path.join(root, "public/icons/icon-192.png"))
  .toString("base64");
const dataUri = `data:image/png;base64,${icon}`;

const PRINT_W = Math.round((96 / 25.4) * 300);
const PRINT_H = Math.round((56 / 25.4) * 300);

const C = {
  bg: "#09090b",
  mint: "#34d399",
  white: "#fafafa",
  muted: "#a1a1aa",
  meta: "#d4d4d8",
  line: "#3f3f46",
};

const styles = `
  .brand { font-family: Arial, Helvetica, sans-serif; font-weight: 700; }
  .name { font-family: Arial, Helvetica, sans-serif; font-weight: 700; fill: ${C.white}; }
  .tag { font-family: Arial, Helvetica, sans-serif; font-weight: 600; fill: ${C.white}; }
  .sub { font-family: Arial, Helvetica, sans-serif; font-weight: 400; fill: ${C.muted}; }
  .meta { font-family: Arial, Helvetica, sans-serif; font-weight: 500; fill: ${C.meta}; }
  .expire { fill: ${C.white}; }
  .y365 { fill: ${C.mint}; }
  .label { font-family: Arial, Helvetica, sans-serif; font-weight: 700; fill: ${C.mint}; letter-spacing: 0.3px; }
`;

function wrap(inner, extraDefs = "") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="96mm" height="56mm" viewBox="0 0 96 56">
  <defs>
    ${extraDefs}
    <style><![CDATA[${styles}]]></style>
  </defs>
  <rect width="96" height="56" fill="${C.bg}"/>
  ${inner}
</svg>`;
}

function brandText(x, y, size) {
  return `<text class="brand" x="${x}" y="${y}" font-size="${size}">
    <tspan class="expire">expire</tspan><tspan class="y365">365</tspan>
  </text>`;
}

/** Logo + name side by side, left-aligned at (x,y) with logoSize */
function lockup(x, y, logoSize, fontSize, gap = 1.6) {
  const textX = x + logoSize + gap;
  const textY = y + logoSize * 0.68;
  return `
    <image href="${dataUri}" x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>
    ${brandText(textX, textY, fontSize)}
  `;
}

const copy = {
  headline: "Track expiry before it's too late",
  line1: "Smart expiry tracking for shops &amp; homes.",
  line2: "Less waste, more order.",
  name: "Georgi Nikolov",
  phone: "+359 887 628 654",
  site: "expire365.com",
  email: "expire365@gmail.com",
};

const layouts = [
  {
    id: "01",
    title: "Brand header left · contact below",
    svg: wrap(`
      <rect x="0" y="0" width="2" height="56" fill="${C.mint}"/>
      ${lockup(8, 7, 9, 5.2)}
      <text class="tag" x="8" y="24" font-size="2.6">${copy.headline}</text>
      <text class="sub" x="8" y="28.5" font-size="1.9">${copy.line1}</text>
      <line x1="8" y1="32" x2="50" y2="32" stroke="${C.line}" stroke-width="0.25"/>
      <text class="name" x="8" y="38" font-size="2.8">${copy.name}</text>
      <text class="meta" x="8" y="43" font-size="1.95">${copy.phone}</text>
      <text class="meta" x="8" y="47.2" font-size="1.95">${copy.site}</text>
      <text class="meta" x="8" y="51.4" font-size="1.95">${copy.email}</text>
    `),
  },
  {
    id: "02",
    title: "Centered stack · brand top",
    svg: wrap(`
      <radialGradient id="g" cx="50%" cy="35%" r="55%">
        <stop offset="0%" stop-color="${C.mint}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${C.bg}" stop-opacity="0"/>
      </radialGradient>
      <rect width="96" height="56" fill="url(#g)"/>
      <!-- centered lockup: logo 10 + gap + ~28 text ≈ 40 wide → start ~28 -->
      ${lockup(28, 6, 10, 5.5)}
      <text class="tag" x="48" y="24" font-size="2.5" text-anchor="middle">${copy.headline}</text>
      <text class="sub" x="48" y="28.5" font-size="1.85" text-anchor="middle">${copy.line1}</text>
      <text class="name" x="48" y="37" font-size="2.9" text-anchor="middle">${copy.name}</text>
      <text class="meta" x="48" y="42.5" font-size="1.9" text-anchor="middle">${copy.phone}  ·  ${copy.site}</text>
      <text class="meta" x="48" y="47" font-size="1.9" text-anchor="middle">${copy.email}</text>
    `),
  },
  {
    id: "03",
    title: "Split columns · big logo stacked / info right",
    svg: wrap(
      `
      <rect width="96" height="56" fill="#0a100e"/>
      <rect width="96" height="56" fill="${C.mint}" fill-opacity="0.04"/>
      <rect width="96" height="56" fill="url(#spill03)"/>
      <rect x="0" y="0" width="2" height="56" fill="${C.mint}"/>
      <!-- Logo stacked: big mark, expire365 centered under -->
      <image href="${dataUri}" x="10" y="12" width="22" height="22" preserveAspectRatio="xMidYMid meet"/>
      <text class="brand" x="21" y="40" font-size="4.4" text-anchor="middle">
        <tspan class="expire">expire</tspan><tspan class="y365">365</tspan>
      </text>
      <text class="tag" x="45" y="14" font-size="2.5">${copy.headline}</text>
      <text class="sub" x="45" y="19" font-size="1.85">${copy.line1}</text>
      <text class="sub" x="45" y="22.5" font-size="1.85">${copy.line2}</text>
      <line x1="45" y1="27" x2="88" y2="27" stroke="${C.line}" stroke-width="0.25"/>
      <text class="name" x="45" y="34" font-size="2.9">${copy.name}</text>
      <text class="meta" x="45" y="40" font-size="1.95">${copy.phone}</text>
      <text class="meta" x="45" y="44.5" font-size="1.95">${copy.site}</text>
      <text class="meta" x="45" y="49" font-size="1.95">${copy.email}</text>
    `,
      `<linearGradient id="spill03" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${C.mint}" stop-opacity="0.14"/>
        <stop offset="28%" stop-color="${C.mint}" stop-opacity="0.05"/>
        <stop offset="55%" stop-color="${C.mint}" stop-opacity="0"/>
      </linearGradient>`,
    ),
  },
  {
    id: "04",
    title: "Brand bottom-left · tagline top",
    svg: wrap(`
      <rect x="0" y="0" width="96" height="2" fill="${C.mint}"/>
      <text class="tag" x="8" y="14" font-size="3.0">${copy.headline}</text>
      <text class="sub" x="8" y="19.5" font-size="2.0">${copy.line1}</text>
      <text class="sub" x="8" y="23.5" font-size="2.0">${copy.line2}</text>
      <text class="name" x="8" y="33" font-size="2.8">${copy.name}</text>
      <text class="meta" x="8" y="38" font-size="1.95">${copy.phone}</text>
      <text class="meta" x="48" y="38" font-size="1.95">${copy.site}</text>
      <text class="meta" x="8" y="42.5" font-size="1.95">${copy.email}</text>
      ${lockup(8, 45, 7.5, 4.4)}
    `),
  },
  {
    id: "05",
    title: "Brand top-right · copy left block",
    svg: wrap(`
      <radialGradient id="rg" cx="82%" cy="22%" r="45%">
        <stop offset="0%" stop-color="${C.mint}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${C.bg}" stop-opacity="0"/>
      </radialGradient>
      <rect width="96" height="56" fill="url(#rg)"/>
      <rect x="0" y="0" width="2.2" height="56" fill="${C.mint}"/>
      ${lockup(58, 6, 8.5, 4.6)}
      <text class="tag" x="8" y="16" font-size="2.8">${copy.headline}</text>
      <text class="sub" x="8" y="21" font-size="1.95">${copy.line1}</text>
      <text class="sub" x="8" y="25" font-size="1.95">${copy.line2}</text>
      <line x1="8" y1="30" x2="52" y2="30" stroke="${C.line}" stroke-width="0.25"/>
      <text class="name" x="8" y="37" font-size="3.0">${copy.name}</text>
      <text class="meta" x="8" y="43" font-size="2.0">${copy.phone}</text>
      <text class="meta" x="8" y="47.5" font-size="2.0">${copy.site}</text>
      <text class="meta" x="8" y="51.5" font-size="2.0">${copy.email}</text>
    `),
  },
  {
    id: "06",
    title: "Horizontal band · brand strip top",
    svg: wrap(`
      <rect x="0" y="0" width="96" height="18" fill="#0f1412"/>
      <rect x="0" y="16" width="96" height="2" fill="${C.mint}"/>
      ${lockup(8, 3.5, 10, 5.0)}
      <text class="tag" x="8" y="28" font-size="2.7">${copy.headline}</text>
      <text class="sub" x="8" y="32.5" font-size="1.9">${copy.line1}</text>
      <text class="name" x="8" y="41" font-size="2.9">${copy.name}</text>
      <text class="meta" x="8" y="46.5" font-size="1.95">${copy.phone}</text>
      <text class="meta" x="42" y="46.5" font-size="1.95">${copy.site}</text>
      <text class="meta" x="8" y="51" font-size="1.95">${copy.email}</text>
    `),
  },
  {
    id: "07",
    title: "Two zones · brand mid-left · contacts mid-right",
    svg: wrap(`
      <line x1="48" y1="10" x2="48" y2="46" stroke="${C.line}" stroke-width="0.3"/>
      ${lockup(8, 16, 12, 4.5)}
      <text class="sub" x="8" y="36" font-size="1.8">${copy.line2}</text>
      <text class="name" x="54" y="18" font-size="2.7">${copy.name}</text>
      <text class="meta" x="54" y="24" font-size="1.9">${copy.phone}</text>
      <text class="meta" x="54" y="29" font-size="1.9">${copy.site}</text>
      <text class="meta" x="54" y="34" font-size="1.9">${copy.email}</text>
      <text class="tag" x="54" y="43" font-size="2.0">${copy.headline}</text>
    `),
  },
  {
    id: "08",
    title: "Minimal quiet · large lockup left · slim contact right",
    svg: wrap(`
      <radialGradient id="mg" cx="28%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${C.mint}" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="${C.bg}" stop-opacity="0"/>
      </radialGradient>
      <rect width="96" height="56" fill="url(#mg)"/>
      ${lockup(7, 18, 14, 5.8, 2)}
      <text class="name" x="58" y="18" font-size="2.6">${copy.name}</text>
      <text class="meta" x="58" y="25" font-size="1.85">${copy.phone}</text>
      <text class="meta" x="58" y="30" font-size="1.85">${copy.site}</text>
      <text class="meta" x="58" y="35" font-size="1.85">${copy.email}</text>
      <text class="sub" x="58" y="43" font-size="1.7">${copy.line2}</text>
    `),
  },
  {
    id: "09",
    title: "Name hero · brand lockup under name · meta footer",
    svg: wrap(`
      <rect x="0" y="0" width="2" height="56" fill="${C.mint}"/>
      <text class="name" x="9" y="16" font-size="4.2">${copy.name}</text>
      ${lockup(9, 20, 8, 4.5)}
      <text class="tag" x="9" y="36" font-size="2.3">${copy.headline}</text>
      <text class="sub" x="9" y="40.5" font-size="1.85">${copy.line1}</text>
      <line x1="9" y1="44" x2="88" y2="44" stroke="${C.line}" stroke-width="0.25"/>
      <text class="meta" x="9" y="49.5" font-size="1.9">${copy.phone}   ${copy.site}   ${copy.email}</text>
    `),
  },
  {
    id: "10",
    title: "Footer brand bar · content above",
    svg: wrap(`
      <text class="tag" x="8" y="12" font-size="2.9">${copy.headline}</text>
      <text class="sub" x="8" y="17.5" font-size="1.95">${copy.line1}</text>
      <text class="sub" x="8" y="21.5" font-size="1.95">${copy.line2}</text>
      <text class="name" x="8" y="31" font-size="3.0">${copy.name}</text>
      <text class="meta" x="8" y="36.5" font-size="1.95">${copy.phone}</text>
      <text class="meta" x="8" y="41" font-size="1.95">${copy.site}  ·  ${copy.email}</text>
      <rect x="0" y="45" width="96" height="11" fill="#0f1412"/>
      <rect x="0" y="45" width="96" height="1.2" fill="${C.mint}"/>
      ${lockup(8, 47, 7, 4.2)}
    `),
  },
];

async function writeJpg(svg, outPath) {
  await sharp(Buffer.from(svg, "utf8"), { density: 300 })
    .resize(PRINT_W, PRINT_H, { fit: "fill" })
    .jpeg({ quality: 95, mozjpeg: true })
    .toFile(outPath);
}

const index = [];
for (const layout of layouts) {
  const svgPath = path.join(samplesDir, `sample-${layout.id}.svg`);
  const jpgPath = path.join(samplesDir, `sample-${layout.id}.jpg`);
  fs.writeFileSync(svgPath, layout.svg, "utf8");
  await writeJpg(layout.svg, jpgPath);
  index.push(` ${layout.id}. ${layout.title}`);
  console.log(`sample-${layout.id}: ${layout.title}`);
}

fs.writeFileSync(
  path.join(samplesDir, "INDEX.txt"),
  `expire365 business card layout samples\n\n${index.join("\n")}\n`,
  "utf8",
);

console.log(`\nWrote ${layouts.length} samples → assets/business-card/samples/`);
