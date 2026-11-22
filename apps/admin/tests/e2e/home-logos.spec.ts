import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { expect, test } from "./fixtures";
import { collectPageErrors, imageFile } from "./helpers";
import { site } from "./site";

// Правки 15.11, п. 27 (20.11): логотип застройщика из кабинета — в строке под первым экраном главной,
// ссылка — на страницу застройщика, городов в строке нет. DEMO «Farg‘ona Sifat» получает логотип и
// в конце теряет его: у опубликованного застройщика кабинет логотип не снимает — строка уходит из базы,
// файл — из бакета (afterAll).

const NAME = "Farg‘ona Sifat Qurilish";
let developerId = "";

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

test.describe("кабинет · логотип застройщика → строка на главной", () => {
  test.use({ storageState: cabinetState("head") });
  test.skip(!hasCloud || !process.env.SUPABASE_DB_URL || !process.env.SUPABASE_SECRET_KEY, NO_CLOUD);

  test.beforeAll(async () => {
    developerId = await withDb(async (client) => {
      const row = await client.query<{ id: string; logos: number }>(
        "select d.id, (select count(*)::int from media_assets m where m.developer_id = d.id and m.kind = 'logo') as logos from developers d where d.slug = 'demo-sifat'",
      );
      if (row.rows[0]!.logos > 0) throw new Error("у DEMO Sifat уже есть логотип — тест его не трогает");
      return row.rows[0]!.id;
    });
  });

  test.afterAll(async () => {
    const paths = await withDb(async (client) => {
      const rows = await client.query<{ path: string }>(
        "delete from media_assets where developer_id = $1 and kind = 'logo' returning path",
        [developerId],
      );
      return rows.rows.map((row) => row.path);
    });
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } }).storage.from("media");
    if (paths.length) await storage.remove(paths);
  });

  test("логотип в кабинете → ссылка в строке главной; убрали — его нет", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(`/zastroyshchiki/${developerId}`);
    const logo = page.locator("#developer-logo");
    await page.getByRole("checkbox", { name: /Правило 1.2/ }).check();
    await logo.setInputFiles(await imageFile(page, { width: 800, height: 800, type: "image/png" }));
    // Записано: отметка 1.2 снята (она — на одну загрузку), превью на месте.
    await expect(page.getByRole("checkbox", { name: /Правило 1.2/ })).not.toBeChecked({ timeout: 30_000 });
    await expect(page.locator(".media-drop__tile-image")).toBeVisible();

    const strip = page.locator(".home-marquee");
    const link = strip.getByRole("link", { name: NAME });
    await expect(async () => {
      await page.goto(site("/ru"));
      await expect(link).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 40_000 });
    await expect(link).toHaveAttribute("href", "/ru/zastroyshchiki/demo-sifat");
    await expect(strip).not.toContainText(/Quvasoy|Marg‘ilon|Новостройки/);
    // Меньше 5 логотипов — статичный ряд без копии ленты.
    const count = await strip.locator(".home-marquee__list").first().getByRole("link").count();
    await expect(strip).toHaveClass(count >= 5 ? /home-marquee--running/ : /home-marquee--static/);
    await strip.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/pravki-2011-logos.png`, caret: "initial" });

    // У опубликованного застройщика логотип можно только заменить — убирает его afterAll (база и бакет).
    await page.goto(`/zastroyshchiki/${developerId}`);
    await page.getByRole("button", { name: "Удалить" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "логотип можно только заменить" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
