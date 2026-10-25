import { expect, test, type Page } from "@playwright/test";
import { hasCloud } from "./cloud";
import { collectPageErrors } from "./helpers";

// Метаданные публичных страниц (фаза 3, «Индексация»): canonical на своём языке, пара uz / ru и
// x-default, картинка превью отдаётся. Ширина не влияет — только 1440 (playwright.config.ts).

const PAGES = [
  { path: "/uz", canonical: "/uz", pair: "/ru" },
  { path: "/ru/kalkulyator", canonical: "/ru/kalkulyator", pair: "/uz/kalkulyator" },
  // Каталог с фильтром в адресе — canonical без параметров (3.14).
  { path: "/ru/novostroyki?rooms=2&sort=price", canonical: "/ru/novostroyki", pair: "/uz/novostroyki" },
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

// Шаг 3.14: robots.txt с картой сайта, sitemap.xml с парами языков, schema.org агентства и ЖК,
// описание ЖК с ценой «от»; переход из каталога в ЖК без ошибок в консоли (скрипт разметки).

test("robots.txt и sitemap.xml: кабинет закрыт, карта с языками; избранного и подборки нет", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toMatch(/<loc>[^<]+\/ru\/kak-kupit<\/loc>/);
  expect(xml).toContain('hreflang="x-default"');
  expect(xml).not.toMatch(/izbrannoe|podborka|\/admin/);
});

/** Разметка schema.org страницы — все блоки ld+json одним массивом. */
async function jsonLdOf(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => [JSON.parse(text)].flat());
}

test("главная: агентство в schema.org — офис, без контактов застройщика", async ({ page }) => {
  await page.goto("/ru");
  const [agency] = await jsonLdOf(page);
  expect(agency).toMatchObject({ "@type": "RealEstateAgent", name: "Vodiy House", address: { streetAddress: "Фергана, ул. Сайилгох, 4" } });
});

test.describe("страница ЖК: поиск и превью", () => {
  test.skip(!hasCloud, "страница читает DEMO из облака");

  test("описание и превью с ценой «от», ЖК с AggregateOffer и крошки; переход из каталога — консоль чистая", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/novostroyki");
    await page.locator('a[href="/ru/novostroyki/demo-shodlik"]').first().click();
    await expect(page).toHaveURL(/\/ru\/novostroyki\/demo-shodlik$/);
    await expect(page.getByRole("heading", { level: 1, name: "ЖК Shodlik" })).toBeVisible();
    const head = page.locator("head");
    await expect(head.locator('meta[name="description"]')).toHaveAttribute("content", /квартиры от \$30\s290/);
    await expect(head.locator('meta[property="og:description"]')).toHaveAttribute("content", /от \$30\s290/);
    const ld = await jsonLdOf(page);
    expect(ld.find((item) => Array.isArray(item["@type"]))).toMatchObject({
      "@type": ["ApartmentComplex", "Product"],
      name: "ЖК Shodlik",
      offers: { "@type": "AggregateOffer", lowPrice: 30290, priceCurrency: "USD" },
    });
    expect(ld.find((item) => item["@type"] === "BreadcrumbList")).toMatchObject({
      itemListElement: [{ position: 1 }, { position: 2, name: "Новостройки" }, { position: 3, name: "ЖК Shodlik" }],
    });
    expect(JSON.stringify(ld)).not.toMatch(/t\.me|tel:|instagram/);
    expect(errors).toEqual([]);
  });
});
