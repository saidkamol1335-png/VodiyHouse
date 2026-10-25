import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";
import { hasCloud } from "./cloud";

// Страница ЖК (шаг 3.5) на DEMO из облака: разделы мокапа SiteJk / MobJk, сверх мокапа — Ф4,
// карта и «Удобство локации» — Ф5; без скидок (PLAN §3.13). Скриншоты —
// test-results/screens/<проект>/s35-complex-*.png.

const SHODLIK = "/ru/novostroyki/demo-shodlik";

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/s35-complex-${name}.png`, fullPage: true });

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
    // Разделов без данных нет: у Shodlik нет видео и деталей.
    await expect(nav.getByRole("link")).toHaveText(["О ЖК", "Расположение", "Наличие", "Планировки", "Застройщик", "Документы"]);
    await expect(main.locator("#o-zhk")).toContainText("перенесён с 2 кв. 2027");
    await expect(main.locator("#raspolozhenie")).toContainText("Школа №46");
    await expect(main.locator("#nalichie")).toContainText(/41\s*в продаже сейчас/);
    await expect(main.locator("#nalichie")).toContainText(/обновлено \d{2}\.\d{2}, \d{2}:\d{2}/i);
    await expect(main.locator("#planirovki h3")).toHaveCount(8);
    await expect(main.locator("#zastroyshchik")).toContainText("Farg‘ona Sifat Qurilish");
    await expect(main.locator("#zastroyshchik")).toContainText("Строится 1 ЖК");
    await expect(main.locator("#dokumenty")).toContainText("Разрешение на строительство");
    await expect(main).not.toContainText(/скидк|−\d+\s?%|-\d+\s?%/i);
    await scrollThrough(page);
    await shot(page, "shodlik");
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
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s35-complex-calc.png` });
    expect(errors).toEqual([]);
  });

  test("Namuna — разделы сверх мокапа (Ф4): «Детали проекта» и «Что входит в цену»", async ({ page }) => {
    await page.goto("/ru/novostroyki/demo-namuna");
    await expect(page.getByRole("navigation", { name: "Разделы страницы" }).getByRole("link", { name: "Детали проекта" })).toBeVisible();
    await expect(page.locator("#detali")).toContainText("Благоустройство");
    await expect(page.locator("#o-zhk")).toContainText(/Место в подземном паркинге\s*отдельно, от \$9\s000/);
  });

  test("UZ — тексты на узбекском; чужой адрес — 404", async ({ page }) => {
    await page.goto("/uz/novostroyki/demo-shodlik");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shodlik TJM");
    await expect(page.locator("#nalichie")).toContainText("ta qoldi");
    const response = await page.goto("/ru/novostroyki/net-takogo-zhk");
    expect(response?.status()).toBe(404);
  });
});
