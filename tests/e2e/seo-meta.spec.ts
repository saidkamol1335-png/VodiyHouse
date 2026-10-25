import { expect, test } from "@playwright/test";

// Метаданные публичных страниц (фаза 3, «Индексация»): canonical на своём языке, пара uz / ru и
// x-default, картинка превью отдаётся. Ширина не влияет — только 1440 (playwright.config.ts).

const PAGES = [
  { path: "/uz", canonical: "/uz", pair: "/ru" },
  { path: "/ru/kalkulyator", canonical: "/ru/kalkulyator", pair: "/uz/kalkulyator" },
] as const;

for (const { path, canonical, pair } of PAGES) {
  test(`${path}: canonical, hreflang и превью`, async ({ page, request }) => {
    await page.goto(path);
    const head = page.locator("head");
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${canonical}$`));
    await expect(head.locator(`link[rel="alternate"][hreflang="${pair.slice(1, 3)}"]`)).toHaveAttribute("href", new RegExp(`${pair}$`));
    await expect(head.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/uz(\/|$)/);
    const image = await head.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(image).toMatch(/\/(uz|ru)\/opengraph-image/);
    const response = await request.get(new URL(image!).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });
}
