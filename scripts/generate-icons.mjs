import sharp from "sharp";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "public/icons/icon-source-1024.png");

const outputs = [
  ["public/icons/icon-16.png", 16],
  ["public/icons/icon-32.png", 32],
  ["public/icons/favicon.png", 32],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
  ["src/app/icon.png", 32],
];

for (const [rel, size] of outputs) {
  const out = path.join(root, rel);
  await sharp(src).resize(size, size, { fit: "cover" }).png().toFile(out);
  console.log("wrote", rel);
}

const maskSize = 512;
const inner = Math.round(maskSize * 0.8);
const resized = await sharp(src).resize(inner, inner, { fit: "cover" }).png().toBuffer();
await sharp({
  create: {
    width: maskSize,
    height: maskSize,
    channels: 4,
    background: { r: 15, g: 76, b: 129, alpha: 1 },
  },
})
  .composite([{ input: resized, gravity: "center" }])
  .png()
  .toFile(path.join(root, "public/icons/icon-512-maskable.png"));
console.log("wrote public/icons/icon-512-maskable.png");

const fav32 = await sharp(src).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = 32;
entry[1] = 32;
entry[4] = 1;
entry[6] = 32;
entry[8] = fav32.length & 0xff;
entry[9] = (fav32.length >> 8) & 0xff;
entry[10] = (fav32.length >> 16) & 0xff;
entry[11] = (fav32.length >> 24) & 0xff;
entry[12] = 22;
writeFileSync(
  path.join(root, "public/favicon.ico"),
  Buffer.concat([header, entry, fav32]),
);
console.log("wrote public/favicon.ico");
