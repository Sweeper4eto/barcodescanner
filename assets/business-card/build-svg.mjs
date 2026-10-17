import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../..");

/** Knock out near-black so the mark sits on the card wash (no black disc). */
async function logoDataUri() {
  const raw = await sharp(path.join(root, "public/icons/icon-192.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = raw;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Black / near-black → transparent
    if (r < 28 && g < 28 && b < 28) {
      data[i + 3] = 0;
    }
  }

  const png = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  return `data:image/png;base64,${png.toString("base64")}`;
}

/** 96×56 mm at 300 dpi */
const PRINT_W = Math.round((96 / 25.4) * 300);
const PRINT_H = Math.round((56 / 25.4) * 300);

/**
 * Layout 03: even green-tinted bg + soft left spill (no radial rings),
 * big logo with expire365 under it (left), copy + contact (right).
 */
function cardSvg({ headline, line1, line2, name, dataUri }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="96mm" height="56mm" viewBox="0 0 96 56">
  <defs>
    <!-- Soft green glow left → fade to black on the right (slightly dialed back) -->
    <linearGradient id="wash" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#14382e"/>
      <stop offset="22%" stop-color="#0f2820"/>
      <stop offset="50%" stop-color="#0b1512"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <style><![CDATA[
      .brand { font-family: Arial, Helvetica, sans-serif; font-weight: 700; }
      .name { font-family: Arial, Helvetica, sans-serif; font-weight: 700; fill: #fafafa; }
      .tag { font-family: Arial, Helvetica, sans-serif; font-weight: 600; fill: #fafafa; }
      .sub { font-family: Arial, Helvetica, sans-serif; font-weight: 400; fill: #a1a1aa; }
      .meta { font-family: Arial, Helvetica, sans-serif; font-weight: 500; fill: #d4d4d8; }
      .expire { fill: #fafafa; }
      .y365 { fill: #34d399; }
    ]]></style>
  </defs>

  <rect width="96" height="56" fill="url(#wash)"/>
  <rect x="0" y="0" width="2" height="56" fill="#34d399"/>

  <!-- Divider y=27: logo above, expire365 just below (aligned with right separator) -->
  <image href="${dataUri}" x="9" y="5.5" width="20" height="20" preserveAspectRatio="xMidYMid meet"/>
  <text class="brand" x="19" y="32.8" font-size="6" text-anchor="middle">
    <tspan class="expire">expire</tspan><tspan class="y365">365</tspan>
  </text>

  <!-- Copy + contact right -->
  <text class="tag" x="45" y="14" font-size="2.5">${headline}</text>
  <text class="sub" x="45" y="19" font-size="1.85">${line1}</text>
  <text class="sub" x="45" y="22.5" font-size="1.85">${line2}</text>

  <line x1="45" y1="27" x2="88" y2="27" stroke="#3f3f46" stroke-width="0.25"/>

  <text class="name" x="45" y="34" font-size="2.9">${name}</text>
  <text class="meta" x="45" y="40" font-size="1.95">+359 887 628 654</text>
  <text class="meta" x="45" y="44.5" font-size="1.95">expire365.com</text>
  <text class="meta" x="45" y="49" font-size="1.95">expire365@gmail.com</text>
</svg>
`;
}

async function writeJpg(svg, outName) {
  const buf = Buffer.from(svg, "utf8");
  await sharp(buf, { density: 300 })
    .resize(PRINT_W, PRINT_H, { fit: "fill" })
    .jpeg({ quality: 95, mozjpeg: true })
    .toFile(path.join(dir, outName));
}

const dataUri = await logoDataUri();

const frontEn = cardSvg({
  headline: "Track expiry before it's too late",
  line1: "Smart expiry tracking for shops &amp; homes.",
  line2: "Less waste, more order.",
  name: "Georgi Nikolov",
  dataUri,
});

const backBg = cardSvg({
  headline: "Следи срока, преди да е късно",
  line1: "Умно следене на годност за магазини и дома.",
  line2: "По-малко отпадък, повече ред.",
  name: "Георги Николов",
  dataUri,
});

fs.writeFileSync(path.join(dir, "front-en-bleed.svg"), frontEn, "utf8");
fs.writeFileSync(path.join(dir, "back-bg-bleed.svg"), backBg, "utf8");
fs.writeFileSync(path.join(dir, "front-bleed.svg"), frontEn, "utf8");
fs.writeFileSync(path.join(dir, "back-bleed.svg"), backBg, "utf8");

await writeJpg(frontEn, "preview-front-en.jpg");
await writeJpg(backBg, "preview-back-bg.jpg");
await writeJpg(frontEn, "preview-front.jpg");
await writeJpg(backBg, "preview-back.jpg");

console.log("SVG + JPG: soft left→right green glow fade.");



