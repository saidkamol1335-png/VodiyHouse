// Три кадра 3D-ключа блока «Отзывы» для lite, телефона и без WebGL (PLAN §10, п. 47): снимаются из той
// же сцены на живой странице через Playwright — анфас, ребро, финал (поворот в замке) — с прозрачным
// фоном → public/assets/key/{1,2,3}.webp.
//
//   npm run frames:key -w @vh/site            (dev-сервер с VH_DEMO_SECTIONS=1 на E2E_PORT или 3002)
//
// Нужен блок на главной: настоящие отзывы (≥ 3) или DEMO в разработке.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3002}`;
const OUT = path.join(import.meta.dirname, "..", "..", "public", "assets", "key");
const WIDTH = 640;

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${BASE}/ru?motion=full`);
  const list = page.locator(".reviews__list");
  await list.scrollIntoViewIfNeeded();
  await page.waitForSelector(".reviews--3d .reviews__canvas[data-running='1']", {
    timeout: 60_000,
  });
  const box = await list.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top + window.scrollY, height: rect.height };
  });
  const viewport = 900;
  // Прогресс ключа — от «верх списка у центра» до «низ списка у центра»; финал — CTA в кадре.
  const shots = [
    { name: "1", y: box.top - viewport / 2 + 2 },
    { name: "2", y: box.top - viewport / 2 + box.height * 0.5 },
    { name: "3", y: box.top + box.height },
  ];
  await page.addStyleTag({
    content: `html, body { background: transparent !important; }
      body * { visibility: hidden !important; }
      .reviews__canvas { visibility: visible !important; }`,
  });
  mkdirSync(OUT, { recursive: true });
  for (const shot of shots) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), shot.y);
    await page.waitForTimeout(2200);
    const png = await page.locator(".reviews__canvas").screenshot({ omitBackground: true });
    const file = path.join(OUT, `${shot.name}.webp`);
    await sharp(png)
      .trim({ threshold: 1 })
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: 86, alphaQuality: 90 })
      .toFile(file);
    console.log(`${file}`);
  }
} finally {
  await browser.close();
}
