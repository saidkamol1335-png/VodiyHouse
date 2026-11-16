import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";
import { hasCloud } from "./cloud";

// Страница ЖК (шаг 3.5) на DEMO из облака: разделы мокапа SiteJk / MobJk, сверх мокапа — Ф4,
// карта и «Удобство локации» — Ф5; без скидок (PLAN §3.13). Скриншоты —
// test-results/screens/<проект>/s35-complex-*.png.

const SHODLIK = "/ru/novostroyki/demo-shodlik";

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/s35-complex-${name}.png`, fullPage: true, caret: "initial" });

/** Ленивые картинки и появление разделов — прокруткой до низа, как читатель. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let top = 0; top < height; top += 600) await page.evaluate((y) => window.scrollTo(0, y), top);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe("страница ЖК", () => {
  test.skip(!hasCloud, "страница читает DEMO из облака");

  test("Shodlik по мокапу: цена, разделы, блоки с переносом срока, наличие, застройщик, документы", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(SHODLIK);
    await expect(page.getByRole("heading", { level: 1, name: "ЖК Shodlik" })).toBeVisible();
    const main = page.locator("main");
    await expect(main).toContainText(/от \$30\s290/);
    const nav = page.getByRole("navigation", { name: "Разделы страницы" });
    // Разделов без данных нет: у Shodlik нет видео и деталей; «Ход строительства» — DEMO-отчёты (фаза 5).
    // Правки 15.11, п. 17: расположение — сразу после «О ЖК», затем «Блоки и условия»; тот же порядок у разделов.
    await expect(nav.getByRole("link")).toHaveText(["О ЖК", "Расположение", "Блоки и условия", "Наличие", "Выбрать квартиру", "Планировки", "Ход строительства", "Застройщик", "Документы"]);
    const order = await main.locator("section[id]").evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(order.slice(0, 4)).toEqual(["o-zhk", "raspolozhenie", "bloki", "nalichie"]);
    await expect(main.locator("#bloki")).toContainText("перенесён с 2 кв. 2027");
    await expect(main.locator("#raspolozhenie")).toContainText("Школа №46");
    // Карта — сразу картинкой, без кнопки «Показать на карте»; грузится лениво.
    const map = main.locator("#raspolozhenie .complex-location__image");
    await expect(map).toHaveAttribute("loading", "lazy");
    await expect(map).toHaveAttribute("src", /^https:\/\/static-maps\.yandex\.ru\//);
    await expect(main.getByRole("button", { name: "Показать на карте" })).toHaveCount(0);
    // Итог «в продаже» = сумма по блокам (число в DEMO меняют e2e кабинета: было 41, 16.11 — 40).
    const total = Number(await main.locator("#nalichie .complex-stock__number").textContent());
    const perBlock = (await main.locator("#nalichie .complex-stock__blocks").textContent()) ?? "";
    await expect(main.locator("#nalichie .complex-stock__caption")).toHaveText("в продаже сейчас");
    expect(total).toBeGreaterThan(0);
    expect(total).toBe([...perBlock.matchAll(/: (\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 0));
    await expect(main.locator("#nalichie")).toContainText(/обновлено \d{2}\.\d{2}, \d{2}:\d{2}/i);
    await expect(main.locator("#planirovki h3")).toHaveCount(8);
    await expect(main.locator("#zastroyshchik")).toContainText("Farg‘ona Sifat Qurilish");
    await expect(main.locator("#zastroyshchik")).toContainText("Строится 2 ЖК");
    await expect(main.locator("#dokumenty")).toContainText("Разрешение на строительство");
    await expect(main).not.toContainText(/скидк|−\d+\s?%|-\d+\s?%/i);
    await scrollThrough(page);
    await shot(page, "shodlik");
    expect(errors).toEqual([]);
  });

  test("галерея: нажатие на фото — во весь экран, у кадров размытое превью; «Далее» листает (правки 15.11, п. 15)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(`${SHODLIK}?motion=lite`);
    const gallery = page.getByRole("group", { name: "Фото: ЖК Shodlik" });
    await expect(gallery).toHaveCSS("cursor", "zoom-in");
    // Заранее — следующий и предыдущий кадры и следующее превью.
    await expect(gallery.locator(".complex-gallery__preload .site-photo")).toHaveCount(3);
    // Галерея ожила (гидратация): превью «Далее» встало в угол.
    await expect(gallery.locator(".complex-gallery__thumb")).toHaveAttribute("style", /translate3d/);
    await gallery.getByRole("button", { name: "Следующее фото" }).click();
    await expect(gallery.locator(".sr-only")).toHaveText(/Фото 2 из \d+/);
    await gallery.click({ position: { x: 60, y: 260 } });
    const viewer = page.getByRole("dialog", { name: /Фото 2 из \d+/ });
    await expect(viewer).toBeVisible();
    // Пока кадр грузится — его размытое превью, а не тёмный пустой кадр (было: 4/9 чёрным).
    const slides = viewer.locator(".complex-viewer__slide");
    const blurred = await slides.evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).style.getPropertyValue("--viewer-blur").startsWith("url(")).length);
    expect(blurred).toBe(await slides.count());
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("«Рассчитать платёж» у планировки: расчёт открывается на месте (телефон — шторкой)", async ({ page, isMobile }) => {
    const errors = collectPageErrors(page);
    await page.goto(`${SHODLIK}#planirovki`);
    // Кнопка оживает после гидратации: клик раньше потерялся бы.
    await page.waitForLoadState("networkidle");
    await page.locator(".complex-layout__calc").first().click();
    const calc = page.locator("dialog.flat-calc");
    await expect(calc).toHaveAttribute("open", "");
    await expect(calc.locator(".flat-calc__price")).toContainText(/\$30\s290/);
    expect(await calc.evaluate((dialog) => dialog.matches(":modal"))).toBe(isMobile);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s35-complex-calc.png`, caret: "initial" });
    // Повторное нажатие у открытого расчёта — «Свернуть» (мокап pcClose).
    if (!isMobile) {
      await page.locator(".complex-layout__calc").first().click();
      await expect(calc).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test("«Рассчитать платёж» у блока открывает расчёт его самой дешёвой планировки; проданная — «Нет в наличии»", async ({ page, isMobile }) => {
    const errors = collectPageErrors(page);
    await page.goto(SHODLIK);
    await page.waitForLoadState("networkidle");
    // На телефоне блоки — вкладками: открыта первая (Блок A).
    await page.locator(".complex-block__calc").first().click();
    const calc = page.locator("dialog.flat-calc");
    await expect(calc).toHaveAttribute("open", "");
    await expect(calc.locator(".flat-calc__price")).toContainText(/\$30\s290/);
    if (isMobile) await page.keyboard.press("Escape");
    await expect(page.locator(".complex-layout").filter({ hasText: "46,8 м²" })).toContainText("Нет в наличии");
    expect(errors).toEqual([]);
  });

  test("Namuna — разделы сверх мокапа (Ф4): «Детали проекта» и «Что входит в цену»", async ({ page }) => {
    await page.goto("/ru/novostroyki/demo-namuna");
    await expect(page.getByRole("navigation", { name: "Разделы страницы" }).getByRole("link", { name: "Детали проекта" })).toBeVisible();
    await expect(page.locator("#detali")).toContainText("Благоустройство");
    await expect(page.locator("#bloki")).toContainText(/Место в подземном паркинге\s*отдельно, от \$9\s000/);
  });

  test("UZ — тексты на узбекском; чужой адрес — 404", async ({ page }) => {
    await page.goto("/uz/novostroyki/demo-shodlik");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shodlik TJM");
    await expect(page.locator("#nalichie")).toContainText("ta qoldi");
    const response = await page.goto("/ru/novostroyki/net-takogo-zhk");
    expect(response?.status()).toBe(404);
  });
});
