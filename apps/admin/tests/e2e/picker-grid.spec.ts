import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { hasCloud, NO_CLOUD } from "./cloud";
import { expect, test } from "./fixtures";
import { collectPageErrors } from "./helpers";
import { site } from "./site";

// Правки 15.11, п. 19 (блок D): этаж без картинки плана — сетка квартир по подъездам (тип, площадь, цена,
// статус), как в прототипе. У DEMO Shodlik планы — на этажах 2–12; на 1-й этаж блока A тест кладёт три
// квартиры «e2e-…» (наличие сайт читает вживую, кэш страницы не мешает) и в конце их удаляет.

const SHODLIK = site("/ru/novostroyki/demo-shodlik");

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

const cleanup = () =>
  withDb((client) =>
    client.query(
      `delete from units u using blocks b, complexes c
       where u.block_id = b.id and b.complex_id = c.id and c.slug = 'demo-shodlik' and u.number like 'e2e-%'`,
    ),
  );

test.describe("сайт · этаж без плана — сетка по подъездам", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!hasCloud || !process.env.SUPABASE_DB_URL, NO_CLOUD);

  test.beforeAll(async () => {
    await cleanup();
    await withDb(async (client) => {
      const block = await client.query<{ id: string; layout: string; price: string }>(
        `select b.id, u.layout_id as layout, u.price::text as price
         from blocks b join complexes c on c.id = b.complex_id join units u on u.block_id = b.id
         where c.slug = 'demo-shodlik' and b.name = 'A' and u.layout_id is not null and u.price is not null limit 1`,
      );
      const { id, layout, price } = block.rows[0]!;
      await client.query(
        `insert into units (block_id, entrance, floor, position, number, layout_id, price, status) values
           ($1, 1, 1, 1, 'e2e-11', $2, $3, 'free'),
           ($1, 1, 1, 2, 'e2e-12', $2, $3, 'sold'),
           ($1, 2, 1, 1, 'e2e-21', $2, $3, 'reserved')`,
        [id, layout, price],
      );
    });
  });
  test.afterAll(cleanup);

  test("1-й этаж: подъезды 1 и 2, цвет — статус; свободная открывает квартиру, проданная — подсказка", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(SHODLIK);
    const section = page.locator("#vybrat-kvartiru");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByText(/свободно \d+/).first()).toBeVisible({ timeout: 15_000 });
    const isPhone = (page.viewportSize()?.width ?? 1440) <= 760;
    await (isPhone ? section.locator(".complex-picker__block", { hasText: "Блок A" }) : section.locator(".complex-picker__tag", { hasText: "Блок A" })).click();
    await section.getByRole("button", { name: /^1 этаж/ }).click();
    const grid = section.locator(".complex-picker__grid");
    await expect(grid).toBeVisible();
    await expect(section.locator(".complex-picker__floor-plan")).toHaveCount(0);
    await expect(grid.getByRole("region", { name: "Подъезд 1" }).locator(".complex-picker__cell")).toHaveCount(2);
    await expect(grid.getByRole("region", { name: "Подъезд 2" }).locator(".complex-picker__cell--reserved")).toHaveCount(1);
    await expect(section.getByText("свободно 1 из 3")).toBeVisible();
    await grid.locator(".complex-picker__cell--sold").click();
    await expect(section.locator(".complex-picker__note")).toContainText("Квартира № e2e-12 уже продана");
    await grid.locator(".complex-picker__cell--free").click();
    await expect(section.locator(".complex-picker__flat").getByRole("heading", { level: 3 })).toContainText("Квартира № e2e-11");
    await grid.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/pravki-1511-floor-grid.png`, caret: "initial" });
    expect(errors).toEqual([]);
  });
});
