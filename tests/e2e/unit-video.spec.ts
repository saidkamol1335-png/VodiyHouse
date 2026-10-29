import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";
import { hasCloud } from "./cloud";

// Видео квартиры для клиента (фаза 5, 5C.2) на DEMO из облака (scripts/demoProgress.mjs): у Shodlik —
// опубликованный отчёт по свободной квартире. Мокап SiteVideo / MobVideo. Без номера квартиры, вне поиска.
// Скриншот — test-results/screens/<проект>/p5-unit-video.png.

/** id отчёта — только из базы: ссылку клиенту даёт менеджер, на сайте её нет (таблицы закрыты и серверу). */
async function demoUnitVideoId(): Promise<string> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      `select r.id from progress_reports r join complexes c on c.id = r.complex_id
       where r.is_unit and r.status = 'published' and c.slug = 'demo-shodlik' limit 1`,
    );
    return rows[0]!.id;
  } finally {
    await client.end();
  }
}

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("видео квартиры для клиента", () => {
  test.skip(!hasCloud || !process.env.SUPABASE_DB_URL, "страница читает DEMO из облака");

  test("Shodlik: плеер, что сделано, предыдущие месяцы, готовность, запись на просмотр; noindex и без номера", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    const id = await demoUnitVideoId();
    await page.goto(`/ru/video/${id}?motion=none`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Как квартира выглядит сейчас",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const main = page.locator("main");
    await expect(main).toContainText("ЖК Shodlik");
    await expect(main).toContainText(/\d+ этаж/);
    await expect(main).toContainText("Видео этой квартиры");
    await expect(main).toContainText("Что сделано за месяц");
    await expect(main).toContainText("DEMO · Квартира");
    // Номера квартиры нет нигде: ни в мета, ни в расчёте.
    await expect(main).not.toContainText(/Кв\.\s?\d|№\s?\d/);

    // Прошлый месяц — его отчёт в плеере, штамп — «Видео блока A».
    const months = main.locator(".unit-video__history").getByRole("button");
    await expect(months.first()).toHaveAttribute("aria-pressed", "true");
    await months.nth(1).click();
    await expect(main.locator(".progress-player")).toContainText(/Видео блока A/i);

    await expect(main.getByRole("button", { name: "Записаться на просмотр" })).toBeVisible();
    await expect(main.getByRole("link", { name: /Страница ЖК/ })).toHaveAttribute(
      "href",
      /\/novostroyki\/demo-shodlik$/,
    );
    // Расчёт — по планировке, без списка квартир: номера нет и в калькуляторе.
    await main.getByRole("button", { name: "Рассчитать платёж" }).click();
    await expect(page.getByRole("dialog", { name: /комн. · / })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Кв.s?d|№s?d/);
    await page.keyboard.press("Escape");
    expect(await noSideScroll(page)).toBe(true);
    await page.screenshot({
      path: `test-results/screens/${test.info().project.name}/p5-unit-video.png`,
      fullPage: true,
      caret: "initial",
    });
    expect(errors).toEqual([]);
  });

  // Статус чужого адреса — 200 с «не найдено», как у ЖК и застройщика (поток после оболочки, «Полировка»).
  test("чужой адрес — «не найдено», вне поиска, без видео", async ({ page }) => {
    await page.goto("/ru/video/11111111-1111-4111-8111-111111111111");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Как квартира выглядит сейчас" }),
    ).toHaveCount(0);
  });
});
