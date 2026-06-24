#!/usr/bin/env node
/**
 * Serves the app over HTTPS on the LAN so phone browsers allow the camera.
 * HTTP Next.js runs on 127.0.0.1:3000; this proxy listens on 0.0.0.0:3443.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import httpProxy from "http-proxy";
import selfsigned from "selfsigned";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const certDir = path.join(root, ".certs");
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");
const HTTP_PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const mode = process.argv[2] === "dev" ? "dev" : "start";

function getLanIps() {
  const ips = new Set(["127.0.0.1"]);
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.add(iface.address);
      }
    }
  }
  return [...ips];
}

async function ensureCerts(ips) {
  fs.mkdirSync(certDir, { recursive: true });
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }

  const pems = await selfsigned.generate(
    [{ name: "commonName", value: "magazin-dev" }],
    {
      days: 825,
      keySize: 2048,
      extensions: [
        {
          name: "subjectAltName",
          altNames: [
            { type: 2, value: "localhost" },
            ...ips.map((ip) => ({ type: 7, ip })),
          ],
        },
      ],
    },
  );

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  return { key: pems.private, cert: pems.cert };
}

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

function runNext(appUrl) {
  const cmd = mode === "dev" ? "dev" : "start";
  const child = spawn(
    process.execPath,
    [nextBin, cmd, "-p", String(HTTP_PORT), "-H", "127.0.0.1"],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_URL: appUrl,
        APP_URL: appUrl,
        SESSION_COOKIE_SECURE: "true",
      },
    },
  );

  child.on("exit", (code) => process.exit(code ?? 1));
  return child;
}

function waitForHttp() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 120_000;

    const tick = () => {
      const req = http.get(`http://127.0.0.1:${HTTP_PORT}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Next.js did not start on port ${HTTP_PORT}`));
          return;
        }
        setTimeout(tick, 500);
      });
    };

    tick();
  });
}

async function main() {
  const ips = getLanIps();
  const lanIp = ips.find((ip) => ip !== "127.0.0.1");
  const appUrl = `https://${lanIp ?? "localhost"}:${HTTPS_PORT}`;
  const certs = await ensureCerts(ips);

  const nextProc = runNext(appUrl);

  const shutdown = () => {
    nextProc.kill();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await waitForHttp();

  const proxy = httpProxy.createProxyServer({
    target: `http://127.0.0.1:${HTTP_PORT}`,
    ws: true,
    xfwd: true,
  });

  proxy.on("proxyReq", (proxyReq, req) => {
    proxyReq.setHeader("X-Forwarded-Proto", "https");
    if (req.headers.host) {
      proxyReq.setHeader("X-Forwarded-Host", req.headers.host);
      const port = String(HTTPS_PORT);
      if (!req.headers.host.includes(":")) {
        proxyReq.setHeader("X-Forwarded-Port", port);
      }
    }
  });

  const server = https.createServer(certs, (req, res) => {
    proxy.web(req, res, (err) => {
      console.error("Proxy error:", err);
      if (!res.headersSent) {
        res.writeHead(502);
      }
      res.end("Bad gateway");
    });
  });

  server.on("upgrade", (req, socket, head) => {
    proxy.ws(req, socket, head, (err) => {
      if (err) {
        socket.destroy();
      }
    });
  });

  server.listen(HTTPS_PORT, "0.0.0.0", () => {
    console.log("");
    console.log("HTTPS ready — open on your phone:");
    if (lanIp) {
      console.log(`  https://${lanIp}:${HTTPS_PORT}`);
    }
    console.log(`  https://localhost:${HTTPS_PORT}`);
    console.log("");
    console.log("First visit: tap Advanced → proceed past the certificate warning.");
    console.log("Then open Scan and tap Start camera.");
    console.log("");
    if (mode === "start") {
      console.log("Tip: run npm run build before start:lan if you changed the app.");
    }
    console.log("");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
