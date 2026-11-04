// Рендер сцены Three.js в PNG-кадры через Playwright (PLAN §10, п. 47): заглушка «Выберите свою
// квартиру» (scenes/dollhouse.html), пока нет настоящих кадров. Фон прозрачный.
//
//   node scripts/frames/render.mjs <сцена> <папка PNG> [--count 48] [--w 1440] [--h 1008] [--query rooms=2]
//
// Кадры потом режет в WebP scripts/frames/frames.mjs. Сцена получает three из node_modules через
// маленький локальный сервер — без CDN и без сборки.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    count: { type: "string", default: "48" },
    w: { type: "string", default: "1440" },
    h: { type: "string", default: "1008" },
    query: { type: "string", default: "" },
  },
});
const [sceneName, outDir] = positionals;
if (!sceneName || !outDir) {
  console.error(
    "Использование: node scripts/frames/render.mjs <сцена> <папка PNG> [--count 48] [--w 1440] [--h 1008] [--query rooms=2]",
  );
  process.exit(1);
}

const SCENES = path.join(import.meta.dirname, "scenes");
const THREE_DIR = path.dirname(path.dirname(createRequire(import.meta.url).resolve("three")));
const TYPES = { ".html": "text/html", ".js": "text/javascript" };

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const [root, rest] = url.pathname.startsWith("/three/")
    ? [THREE_DIR, url.pathname.slice("/three/".length)]
    : [SCENES, url.pathname.slice(1)];
  const file = path.normalize(path.join(root, rest));
  if (!file.startsWith(root) || !existsSync(file)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
  });
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport: { width: Number(values.w), height: Number(values.h) },
  });
  page.on("pageerror", (error) => console.error("сцена:", error.message));
  const query = new URLSearchParams(values.query);
  query.set("w", values.w);
  query.set("h", values.h);
  await page.goto(`http://127.0.0.1:${port}/${sceneName}.html?${query}`);
  await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 60_000 });
  mkdirSync(outDir, { recursive: true });
  const count = Number(values.count);
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1);
    const data = await page.evaluate((value) => window.renderFrame(value), t);
    const name = `${String(index + 1).padStart(4, "0")}.png`;
    writeFileSync(path.join(outDir, name), Buffer.from(data.split(",")[1], "base64"));
  }
  console.log(`${count} кадров → ${outDir}`);
} finally {
  await browser.close();
  server.close();
}
