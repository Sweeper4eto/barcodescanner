import sharp from "sharp";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "public/icons/icon-source-1024.png");

async function png(size, rel, { fit = "contain", background = { r: 255, g: 255, b: 255, alpha: 1 } } = {}) {
  const out = path.join(root, rel);
  await sharp(src)
    .resize(size, size, { fit, background })
    .png()
    .toFile(out);
  console.log("wrote", rel);
}

const outputs = [
  ["public/icons/icon-16.png", 16],
  ["public/icons/icon-32.png", 32],
  ["public/icons/favicon.png", 32],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
  ["src/app/icon.png", 512],
  ["src/app/apple-icon.png", 180],
];

for (const [rel, size] of outputs) {
  await png(size, rel);
}

const maskSize = 512;
const inner = Math.round(maskSize * 0.72);
const resized = await sharp(src)
  .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toBuffer();
await sharp({
  create: {
    width: maskSize,
    height: maskSize,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite([{ input: resized, gravity: "center" }])
  .png()
  .toFile(path.join(root, "public/icons/icon-512-maskable.png"));
console.log("wrote public/icons/icon-512-maskable.png");

// Build a real multi-size .ico for both public/ and src/app/
async function writeIco(rel) {
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    images.push(
      await sharp(src)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer(),
    );
  }

  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;
  const payloads = [];
  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    const png = images[i];
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    payloads.push(png);
    offset += png.length;
  }

  writeFileSync(path.join(root, rel), Buffer.concat([header, ...entries, ...payloads]));
  console.log("wrote", rel);
}

await writeIco("public/favicon.ico");
await writeIco("src/app/favicon.ico");