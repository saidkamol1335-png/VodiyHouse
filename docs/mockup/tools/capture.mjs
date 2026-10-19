// Снимает все артборды мокапа в docs/mockup/screens/ через Playwright.
// Нужен запущенный serve.mjs. Запуск: node docs/mockup/tools/capture.mjs [port] [фильтр-по-имени]
// Страницы (expand: fill) — первый экран PNG + вся страница JPG; экраны телефона 390×844 — PNG.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// MOCKUP_ROOT — если скрипт запускают из другой папки (где установлен playwright).
const mockupRoot = process.env.MOCKUP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 4599);
const nameFilter = process.argv[3] ? new RegExp(process.argv[3]) : null;
const INTRO_WAIT_MS = 4500;   // прелоадер главной: 2,6 с + 0,9 с затухание
const SCROLL_STEP_WAIT_MS = 250;

const canvas = JSON.parse(await readFile(join(mockupRoot, 'source', 'project', 'canvas.json'), 'utf8'));

function groupOf(stem) {
  if (/Dark$/.test(stem) && !stem.startsWith('Mob')) return 'dark-1440';
  if (stem.startsWith('Cab')) return 'cabinet-1440';
  if (stem.startsWith('Phone')) return 'adaptive-390';
  if (stem.startsWith('Mob')) return 'phone-390';
  return 'site-1440';
}

// Появление блоков при скролле срабатывает только если блок побывал в кадре — прокручиваем страницу целиком.
async function revealWholePage(page, viewportHeight) {
  const height = await page.evaluate(() => document.scrollingElement.scrollHeight);
  for (let y = 0; y < height; y += Math.round(viewportHeight * 0.8)) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(SCROLL_STEP_WAIT_MS);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();
const index = [];
for (const file of canvas.order) {
  const board = canvas.boards[file];
  const stem = file.replace('.dc.html', '');
  if (nameFilter && !nameFilter.test(stem)) continue;
  const group = groupOf(stem);
  const viewport = { width: board.w, height: board.w >= 1000 ? 900 : 844 };
  const outDir = join(mockupRoot, 'screens', group);
  await mkdir(outDir, { recursive: true });

  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/project/${file}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(INTRO_WAIT_MS);

  const shots = [];
  if (board.expand === 'fill') {
    await revealWholePage(page, viewport.height);
    await page.screenshot({ path: join(outDir, `${stem}.png`) });
    await page.screenshot({ path: join(outDir, `${stem}.full.jpg`), fullPage: true, type: 'jpeg', quality: 82 });
    shots.push(`${stem}.png`, `${stem}.full.jpg`);
  } else {
    await page.screenshot({ path: join(outDir, `${stem}.png`) });
    shots.push(`${stem}.png`);
  }
  await page.close();
  index.push({ group, stem, title: board.title, size: `${viewport.width}×${viewport.height}`, shots, errors });
  console.log(`${errors.length ? '!' : '✓'} ${group}/${stem}${errors.length ? ' — ' + errors[0] : ''}`);
}
await browser.close();

if (!nameFilter) {
  const lines = ['# Скриншоты мокапа', '', 'Сгенерировано `docs/mockup/tools/capture.mjs`. Не править руками.', ''];
  for (const group of ['site-1440', 'cabinet-1440', 'dark-1440', 'adaptive-390', 'phone-390']) {
    lines.push(`## ${group}`, '', '| Артборд | Что на экране | Файлы |', '| --- | --- | --- |');
    for (const item of index.filter((i) => i.group === group)) {
      const links = item.shots.map((s) => `[${s.endsWith('.jpg') ? 'вся страница' : 'первый экран'}](${group}/${s})`).join(' · ');
      lines.push(`| ${item.stem} | ${item.title} | ${links} |`);
    }
    lines.push('');
  }
  await writeFile(join(mockupRoot, 'screens', 'INDEX.md'), lines.join('\n'));
}
