// Весь проект на одном адресе: `npm run dev` в корне → http://localhost:3000 — сайт, /admin — кабинет.
// Поднимает dev-серверы сайта и кабинета на внутренних портах и маленький прокси перед ними (запросы и
// WebSocket горячей перезагрузки). Кабинет — с ADMIN_BASE_PATH=/admin (apps/admin/next.config.ts).
// Только для разработки: в проде сайт и кабинет — два домена. Базы — из .env.local приложений.
//   PORT=3000 SITE_PORT=3100 ADMIN_PORT=3101 — порты по умолчанию; e2e кабинета (3001) не задеваются.

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.PORT ?? 3000);
let SITE_PORT = Number(process.env.SITE_PORT ?? 3100);
const ADMIN_PORT = Number(process.env.ADMIN_PORT ?? 3101);
const ADMIN_PREFIX = "/admin";
const ORIGIN = `http://localhost:${PORT}`;
const ALREADY_RUNNING = /Another .*next dev.* server is already running/;
const RUNNING_PORT = /Local:\D*localhost:(\d+)/;

const children = [
  // Next не даёт второй dev-сервер на одну папку: сайт уже запущен (другой вкладкой) — ведём на него.
  start("сайт", "@vh/site", SITE_PORT, { SITE_URL: ORIGIN }, (port) => {
    SITE_PORT = port;
  }),
  // Кабинет так нельзя: уже запущенный — без префикса /admin.
  start("кабинет", "@vh/admin", ADMIN_PORT, {
    ADMIN_BASE_PATH: ADMIN_PREFIX,
    ADMIN_URL: `${ORIGIN}${ADMIN_PREFIX}`,
    SITE_URL: ORIGIN,
  }),
];

function start(label, workspace, port, env, reuse) {
  // `npm run dev -w` с --port поверх порта из package.json; переменные окружения сильнее .env.local.
  const child = spawn(`npm run dev -w ${workspace} -- --port ${port}`, {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  const prefix = `[${label}] `;
  let busy = false;
  let reused = false;
  const relay = (stream, out) =>
    stream.on("data", (chunk) => {
      // Цвета терминала в выводе Next мешают искать порт.
      const text = chunk.toString().replace(/\x1b\[[0-9;]*m/g, "");
      if (ALREADY_RUNNING.test(text)) busy = true;
      const existing = busy && !reused && reuse ? RUNNING_PORT.exec(text) : null;
      if (existing) {
        reused = true;
        reuse(Number(existing[1]));
        console.log(`${prefix}уже запущен на :${existing[1]} — общий адрес ведёт на него`);
      }
      if (busy) return;
      for (const line of text.split(/\r?\n/)) if (line.trim()) out.write(`${prefix}${line}\n`);
    });
  relay(child.stdout, process.stdout);
  relay(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (reused) return;
    if (busy) console.error(`${prefix}в этой папке уже запущен другой dev-сервер — остановите его`);
    console.error(`${prefix}остановился (код ${code}) — останавливаю всё`);
    stop(code ?? 1);
  });
  return child;
}

function targetPort(url = "/") {
  return url === ADMIN_PREFIX || url.startsWith(`${ADMIN_PREFIX}/`) || url.startsWith(`${ADMIN_PREFIX}?`)
    ? ADMIN_PORT
    : SITE_PORT;
}

// Host не меняем: Server Actions сверяют Origin с Host, а ссылки и редиректы строятся от него.
const server = http.createServer((request, response) => {
  const upstream = http.request(
    { host: "127.0.0.1", port: targetPort(request.url), method: request.method, path: request.url, headers: request.headers },
    (reply) => {
      response.writeHead(reply.statusCode ?? 502, reply.rawHeaders);
      reply.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end("Сервер ещё запускается — обновите страницу через несколько секунд.");
  });
  request.pipe(upstream);
});

// WebSocket горячей перезагрузки: сырой туннель до нужного dev-сервера.
server.on("upgrade", (request, socket, head) => {
  const upstream = net.connect(targetPort(request.url), "127.0.0.1", () => {
    const lines = [`${request.method} ${request.url} HTTP/${request.httpVersion}`];
    for (let i = 0; i < request.rawHeaders.length; i += 2) lines.push(`${request.rawHeaders[i]}: ${request.rawHeaders[i + 1]}`);
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length) upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, () => {
  console.log(`\nVodiy House: сайт ${ORIGIN}  ·  кабинет ${ORIGIN}${ADMIN_PREFIX}\n`);
});

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  server.close();
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // npm под shell на Windows: гасим всё дерево процессов.
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
