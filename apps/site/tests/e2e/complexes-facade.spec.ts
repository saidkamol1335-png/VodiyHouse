import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { expect, test, type Page } from "./fixtures";
import { collectPageErrors, imageFile } from "./helpers";

// Фаза 4 (4.3–4.4): вкладка ЖК «Фасад и планы» руководителем против облака. Свой черновик ЖК
// «e2e-fasad-…» (блок A: 2 подъезда × этажи 2–3 × 2 места) — DEMO не трогаем; в конце он удаляется
// со всем, что к нему привязано (файлы остаются в его папке бакета — сироты черновика).

const SLUG = `e2e-fasad-${Date.now().toString(36)}`;
let complexId = "";
let blockId = "";

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** Три щелчка по редактору — треугольник в процентах (x, y) рамки. */
async function drawTriangle(page: Page, editor: ReturnType<Page["locator"]>, at: [number, number][]) {
  await editor.scrollIntoViewIfNeeded();
  const box = (await editor.boundingBox())!;
  for (const [x, y] of at) await page.mouse.click(box.x + (box.width * x) / 100, box.y + (box.height * y) / 100);
}

test.describe("кабинет · фасад и планы этажей", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: cabinetState("head") });
  test.skip(!hasCloud || !process.env.SUPABASE_DB_URL || !process.env.SUPABASE_SECRET_KEY, NO_CLOUD);

  test.beforeAll(() =>
    withDb(async (client) => {
      const developer = await client.query<{ id: string }>("select id from developers where slug = 'demo-sifat'");
      complexId = (
        await client.query<{ id: string }>(
          `insert into complexes (developer_id, slug, name, status) values ($1, $2, '{"ru": "E2E Фасад", "uz": "E2E Fasad"}', 'draft') returning id`,
          [developer.rows[0]!.id, SLUG],
        )
      ).rows[0]!.id;
      blockId = (await client.query<{ id: string }>("insert into blocks (complex_id, name, floors_total) values ($1, 'A', 3) returning id", [complexId])).rows[0]!.id;
      await client.query(
        `insert into units (block_id, entrance, floor, position, number)
         select $1, e, f, p, ((e - 1) * 4 + (f - 2) * 2 + p)::text from generate_series(1, 2) e, generate_series(2, 3) f, generate_series(1, 2) p`,
        [blockId],
      );
    }),
  );
  test.afterAll(async () => {
    await withDb((client) => client.query("delete from complexes where slug = $1", [SLUG]));
    // Файлы черновика (фасад, план) — из его папки бакета: строк уже нет, иначе остались бы сиротами.
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } }).storage.from("media");
    const { data } = await storage.list(`complexes/${complexId}`);
    if (data?.length) await storage.remove(data.map((file) => `complexes/${complexId}/${file.name}`));
  });

  test("фасад → контур блока → план подъезда → контуры квартир → удаление плана", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectPageErrors(page);
    await page.goto(`/admin/zhk/${complexId}/fasad`);
    await expect(page.getByRole("heading", { name: "Фасад ЖК" })).toBeVisible();
    await expect(page.getByText("Сначала загрузите фасад.")).toBeVisible();
    const facadeSection = page.locator(".facade-tab__section").first();
    await facadeSection.locator("input[type=file]").first().setInputFiles(await imageFile(page, { width: 2400, height: 1600, type: "image/jpeg" }));
    const contours = page.locator(".facade-tab__section").nth(1);
    const editor = contours.locator(".facade-editor");
    // Редактор появляется только после того, как страница перечитала данные (router.refresh).
    await expect(editor).toBeVisible({ timeout: 30_000 });
    // С клавиатуры: Ввод — угол в центре, стрелка двигает его, Backspace убирает.
    await editor.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+ArrowRight");
    await expect(contours.getByText("1 точка")).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(contours.getByText("0 точек")).toBeVisible();
    await drawTriangle(page, editor, [[20, 20], [60, 20], [40, 70]]);
    await expect(contours.getByText("3 точки")).toBeVisible();
    await contours.getByRole("button", { name: "Сохранить контур" }).click();
    await expect(contours.getByText("Сохранено")).toBeVisible({ timeout: 15_000 });
    await expect(contours.getByRole("button", { name: /Блок A контур есть/ })).toBeVisible();

    const plans = page.locator(".facade-tab__section").nth(2);
    await plans.locator("select").first().selectOption("1");
    await plans.getByLabel("Этажи с").fill("2");
    await plans.getByLabel("по", { exact: true }).fill("3");
    await plans.locator("input[type=file]").first().setInputFiles(await imageFile(page, { width: 1600, height: 1200, type: "image/png" }));
    const card = plans.locator("details.facade-tab__card", { hasText: "Подъезд 1 · этажи 2–3" });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.locator("summary").click();
    await expect(card.getByText("Обведено 0 из 2").first()).toBeVisible();
    await drawTriangle(page, card.locator(".facade-editor"), [[5, 5], [45, 5], [25, 90]]);
    await card.getByRole("button", { name: /Подъезд 1 · позиция 2/ }).click();
    await drawTriangle(page, card.locator(".facade-editor"), [[55, 5], [95, 5], [75, 90]]);
    await card.getByRole("button", { name: "Сохранить контуры квартир" }).click();
    await expect(card.getByText("Сохранено")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s4-facade-tab.png`, fullPage: true, caret: "initial" });
    const saved = await withDb((client) =>
      client.query<{ n: number; contour: boolean }>(
        `select jsonb_array_length(p.contours) as n, b.facade_contour is not null as contour
         from floor_plans p join blocks b on b.id = p.block_id where p.block_id = $1`,
        [blockId],
      ),
    );
    expect(saved.rows).toEqual([{ n: 2, contour: true }]);
    await card.getByRole("button", { name: "Удалить план" }).click();
    await card.getByRole("group", { name: /Удалить план?/ }).getByRole("button", { name: "Удалить план" }).click();
    await expect(plans.locator("details.facade-tab__card", { hasText: "Подъезд 1 · этажи 2–3" })).toHaveCount(0, { timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("менеджеру вкладки нет — адрес уводит на «Квартиры»", async ({ browser }) => {
    const context = await browser.newContext({ storageState: cabinetState("manager") });
    const page = await context.newPage();
    await page.goto(`/admin/zhk/${complexId}/fasad`);
    await expect(page).toHaveURL(new RegExp(`/admin/zhk/${complexId}/kvartiry`));
    await context.close();
  });
});
