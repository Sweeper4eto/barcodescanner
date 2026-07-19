#!/usr/bin/env bash
set -euo pipefail
cd /var/www/magazin

node --input-type=module <<'EOF'
import "dotenv/config";

const key = process.env.GEMINI_API_KEY?.trim() || "";
let model = process.env.DOCUMENT_AI_MODEL?.trim() || "gemini-3.5-flash";
if (!key) {
  console.error("FAIL: GEMINI_API_KEY is empty in .env");
  process.exit(1);
}
if (/\s/.test(model)) {
  console.warn(`WARN: DOCUMENT_AI_MODEL has spaces ('${model}') — using gemini-3.5-flash`);
  model = "gemini-3.5-flash";
}

console.log(`Key length: ${key.length}`);
console.log(`Model: ${model}`);
console.log("Calling Gemini...");

const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: "Reply with exactly: ok" }] }],
  }),
});
const text = await res.text();
console.log(`HTTP: ${res.status}`);
console.log(text.slice(0, 800));
process.exit(res.ok ? 0 : 1);
EOF
