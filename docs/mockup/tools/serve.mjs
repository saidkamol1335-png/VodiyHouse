// Локальный сервер мокапа: отдаёт исходники холста так же, как их отдаёт claude.ai.
// /project/*.dc.html — артборды, /project/support.js — рантайм холста, /_blob/<id> — картинки и CSS.
// Запуск: node docs/mockup/tools/serve.mjs [port]   (по умолчанию 4599)
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'source');
const port = Number(process.argv[2] || 4599);
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

// Артборды ссылаются на ассеты по id без расширения — строим карту id → файл.
const blobFiles = new Map();
for (const name of await readdir(join(sourceRoot, '_blob'))) blobFiles.set(name.split('.')[0], name);

function resolveFile(urlPath) {
  if (urlPath.startsWith('/_blob/')) {
    const name = blobFiles.get(urlPath.slice('/_blob/'.length));
    return name && join(sourceRoot, '_blob', name);
  }
  if (urlPath.startsWith('/project/')) {
    const file = normalize(join(sourceRoot, urlPath));
    return file.startsWith(join(sourceRoot, 'project')) ? file : undefined;
  }
  return undefined;
}

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolveFile(urlPath);
  try {
    if (!file) throw new Error('not found');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': contentTypes[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
    console.warn('404', urlPath);
  }
}).listen(port, () => console.log(`Мокап: http://localhost:${port}/project/Main.dc.html`));
