import { expect, test, type Page } from "@playwright/test";
import { LOCALES } from "../../lib/i18n/routing";
import { ROUTES } from "../../lib/routes";
import { findFiction, findZeroCounts, type FictionHit } from "../../lib/site/prodCheck/fiction";

// Обход прода (playwright.prod.config.ts): sitemap + публичные страницы на обоих языках. Только GET:
// любой другой запрос браузера обрывается, чтобы проверка не оставила в базе прода ни заявки, ни
// события. Снимки — test-results/prod/<проект>/.

const STATIC_PAGES = [
  ROUTES.home,
  ROUTES.catalog,
  ROUTES.developers,
  ROUTES.calculator,
  ROUTES.about,
  ROUTES.forDevelopers,
  ROUTES.howToBuy,
  ROUTES.privacy,
  ROUTES.quiz,
  ROUTES.favorites,
];
const ALLOWED_PHONES = (process.env.PROD_ALLOWED_PHONES ?? "").split(",").filter(Boolean);

const localized = (path: string) =>
  LOCALES.map((locale) => `/${locale}${path === "/" ? "" : path}`);

/** Адреса карты сайта — на хосте PROD_URL (до домена SITE_URL пуст, карта может назвать другой хост). */
async function sitemapPaths(page: Page): Promise<string[]> {
  const response = await page.request.get("/sitemap.xml");
  expect(response.status(), "sitemap.xml").toBe(200);
  return [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => new URL(match[1]!).pathname,
  );
}

async function pagesToCheck(page: Page): Promise<string[]> {
  return [...new Set([...STATIC_PAGES.flatMap(localized), ...(await sitemapPaths(page))])].sort();
}

const report = (path: string, hits: FictionHit[]) =>
  hits.map((hit) => `${path} — ${hit.rule}: «${hit.match}»`);

/** Только чтение: всё, кроме GET и HEAD, обрываем (Server Actions, заявки, события, sendBeacon). */
async function readOnly(page: Page) {
  await page.route("**/*", (route) => {
    const method = route.request().method();
    return method === "GET" || method === "HEAD"
      ? route.continue()
      : route.abort("blockedbyclient");
  });
}

test("HTML: нет названий мокапа и DEMO, заглушек и чужих телефонов", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1440", "HTML одинаковый — один проход");
  test.setTimeout(300_000);
  const problems: string[] = [];
  for (const path of await pagesToCheck(page)) {
    const response = await page.request.get(path);
    if (response.status() !== 200) {
      problems.push(`${path} — HTTP ${response.status()}`);
      continue;
    }
    const html = await response.text();
    // Телефоны ищем в тексте без тегов и скриптов: в адресах чанков и хэшах цифры бывают какие угодно.
    const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
    const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => m[1])
      .join(" ");
    const meta = [...html.matchAll(/<meta [^>]*content="([^"]*)"/g)].map((m) => m[1]).join(" ");
    const hits = [
      ...findFiction(html, ALLOWED_PHONES).filter((hit) => hit.rule !== "телефон"),
      ...findFiction(`${text} ${jsonLd} ${meta}`, ALLOWED_PHONES).filter(
        (hit) => hit.rule === "телефон",
      ),
    ];
    problems.push(...report(path, hits));
  }
  expect(problems).toEqual([]);
});

test("страницы: без нулей вместо данных, битых ссылок и ошибок консоли; снимки", async ({
  page,
}, info) => {
  test.setTimeout(600_000);
  await readOnly(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()} — ${error.message}`));
  page.on("console", (message) => {
    // Оборванные нами POST — не ошибка сайта.
    if (
      message.type() === "error" &&
      !/ERR_BLOCKED_BY_CLIENT|Failed to fetch|blockedbyclient/i.test(message.text())
    )
      errors.push(`${page.url()} — ${message.text()}`);
  });
  const problems: string[] = [];
  const links = new Set<string>();
  const origin = new URL(info.project.use.baseURL!).origin;
  for (const path of await pagesToCheck(page)) {
    await page.goto(path, { waitUntil: "load" });
    await page.waitForTimeout(3_500); // экран загрузки главной — не дольше ~3 с
    const visible = await page.locator("body").innerText();
    problems.push(...report(path, findZeroCounts(visible)));
    for (const href of await page
      .locator("a[href]")
      .evaluateAll((items) => items.map((a) => (a as HTMLAnchorElement).href))) {
      const url = new URL(href);
      if (url.origin === origin) links.add(url.pathname);
    }
    const name = path.replace(/\W+/g, "_").replace(/^_|_$/g, "") || "root";
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  }
  for (const link of links) {
    const response = await page.request.get(link);
    if (response.status() >= 400) problems.push(`ссылка ${link} — HTTP ${response.status()}`);
  }
  expect(problems).toEqual([]);
  expect(errors).toEqual([]);
});
