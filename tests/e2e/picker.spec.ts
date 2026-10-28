import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Фаза 4 (4.5–4.6): «Выбрать квартиру» на фасаде у DEMO Shodlik (фасад и планы подъездов — DEMO
// из demo:seed). Путь фасад → этаж → квартира → расчёт → заявка на 1440 и 390; бронь, поставленная менеджером
// в кабинете, видна на открытом плане за секунды. Заявка e2e — имя «E2E …», её удаляет global-teardown.

const SHODLIK = "/ru/novostroyki/demo-shodlik";
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/s4-pick-${name}.png`, caret: "initial" });
const phoneOf = (seed: number) => `90${String(seed % 10_000_000).padStart(7, "0")}`;

test.use({ extraHTTPHeaders: { "x-nf-client-connection-ip": `e2e-${crypto.randomUUID()}` } });

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** Открыть раздел и блок: на 1440 — подпись на фасаде, на телефоне — строка списка под ним. */
async function openBlock(page: Page, name: "A" | "B") {
  await page.goto(SHODLIK);
  const section = page.locator("#vybrat-kvartiru");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByText(/свободно \d+/).first()).toBeVisible({ timeout: 15_000 });
  // Телефон (до 760 px) — список блоков под фасадом; шире — подписи на фасаде.
  const isPhone = (page.viewportSize()?.width ?? 1440) <= 760;
  const label = `Блок ${name}`;
  await (isPhone ? section.locator(".complex-picker__block", { hasText: label }) : section.locator(".complex-picker__tag", { hasText: label })).click();
  await expect(section.getByRole("button", { name: "Все корпуса" })).toBeVisible();
  return section;
}

test.describe("сайт · выбрать квартиру на фасаде", () => {
  test.skip(!hasCloud, NO_CLOUD);

  test("фасад → этаж → квартира → расчёт → «Забронировать» — заявка с номером", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(SHODLIK);
    const nav = page.getByRole("navigation", { name: "Разделы страницы" });
    await expect(nav.getByRole("link", { name: "Выбрать квартиру" })).toBeVisible();
    const section = await openBlock(page, "B");
    await shot(page, "plan");
    // Этаж по умолчанию — где свободных больше; на нём есть зелёная квартира.
    await expect(section.locator(".complex-picker__floor[aria-pressed='true']")).toBeVisible();
    const free = section.locator(".complex-picker__unit--free").first();
    await free.click();
    const flat = section.locator(".complex-picker__flat");
    await expect(flat.getByRole("heading", { level: 3 })).toContainText(/Квартира № \d+ · \d-комн\./);
    await expect(flat).toContainText(/\$\d/);
    await flat.getByRole("button", { name: "Рассчитать платёж" }).click();
    await expect(page.locator("dialog.flat-calc")).toBeVisible({ timeout: 15_000 });
    await shot(page, "calc");
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.flat-calc")).toBeHidden();
    await flat.getByRole("button", { name: "Забронировать эту квартиру" }).click();
    const dialog = page.getByRole("dialog", { name: "Запись на просмотр" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Имя").fill(`E2E Фасад ${test.info().project.name}`);
    await dialog.getByLabel("Телефон").fill(phoneOf(Date.now()));
    await dialog.getByRole("button", { name: "Отправить" }).click();
    await expect(dialog.getByText(/Номер заявки #\d+/)).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test("продана и бронь — только подсказка; занятая квартира панель не открывает", async ({ page }) => {
    const section = await openBlock(page, "B");
    const taken = section.locator(".complex-picker__unit--sold, .complex-picker__unit--reserved").first();
    await taken.click();
    await expect(section.locator(".complex-picker__note")).toContainText(/(забронирована|уже продана)\. Зелёные квартиры на этом этаже свободны/);
    await expect(section.locator(".complex-picker__flat")).toHaveCount(0);
  });

  test("менеджер ставит бронь в кабинете — открытый план на сайте показывает её за секунды", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440" || !process.env.SUPABASE_DB_URL, "один раз: статус меняется в общей базе");
    // В общем прогоне бронь задела бы счётчики DEMO соседних спек: только `npm run e2e:1440 -- picker.spec.ts`.
    test.skip(process.env.E2E_LIVE !== "1", "живой статус — только при отдельном запуске picker.spec");
    // Раздел перечитывает статусы раз в 15 с: ждём до 25 с; кабинет грузит список квартир лениво.
    test.setTimeout(120_000);
    const unit = await withDb(async (client) =>
      (
        await client.query<{ id: string; number: string; floor: number; entrance: number; complex_id: string }>(
          `select u.id, u.number, u.floor, u.entrance, c.id as complex_id from units u join blocks b on b.id = u.block_id
           join complexes c on c.id = b.complex_id
           where c.slug = 'demo-shodlik' and b.name = 'A' and u.status = 'free' order by u.floor desc, u.entrance limit 1`,
        )
      ).rows[0]!,
    );
    // Блок A — тест заявки выбирает квартиры блока B, общий прогон 390 + 1440 их не пересечёт.
    const section = await openBlock(page, "A");
    await section.getByRole("button", { name: new RegExp(`^${unit.floor} этаж, свободно`) }).click();
    const entrances = section.locator(".complex-picker__entrance");
    if ((await entrances.count()) > 1) await entrances.filter({ hasText: `Подъезд ${unit.entrance}` }).click();
    const tile = section.locator(`[data-unit-id="${unit.id}"]`);
    await expect(tile).toHaveClass(/complex-picker__unit--free/);
    // Как сид DEMO: без записи в журнал (vodiy.skip_audit — только в этой транзакции).
    const setStatus = (status: string) =>
      withDb(async (client) => {
        await client.query("begin");
        await client.query("select set_config('vodiy.skip_audit', 'on', true)");
        await client.query("update units set status = $1 where id = $2", [status, unit.id]);
        await client.query("commit");
      });
    // Кабинет менеджера: «Квартиры» Shodlik, блок A — первый; статус квартиры — «бронь».
    const cabinet = await browser.newContext({ storageState: cabinetState("manager") });
    const admin = await cabinet.newPage();
    const number = new RegExp(`^${unit.number}$`);
    try {
      await admin.goto(`/admin/zhk/${unit.complex_id}/kvartiry`);
      const row = admin.locator(".units-row").filter({ has: admin.locator(".units-row__number", { hasText: number }) });
      await expect(admin.locator(".units-row").first()).toBeVisible({ timeout: 30_000 });
      await row.getByRole("button", { name: `Кв. ${unit.number}, свободна. Сменить статус` }).click();
      await admin.getByRole("group", { name: new RegExp(`^Статус кв\\. ${unit.number}`) }).getByRole("button", { name: "бронь" }).click();
      await expect(admin.locator(".units-undo")).toContainText(`Кв. ${unit.number}: свободна → бронь`);
      await expect(tile).toHaveClass(/complex-picker__unit--reserved/, { timeout: 25_000 });
      // «Отменить» живёт 5 с — сайт ждём дольше; обратно — тем же выбором статуса, сайт видит и это.
      await row.getByRole("button", { name: `Кв. ${unit.number}, бронь. Сменить статус` }).click();
      await admin.getByRole("group", { name: new RegExp(`^Статус кв\. ${unit.number}`) }).getByRole("button", { name: "свободна" }).click();
      await expect(tile).toHaveClass(/complex-picker__unit--free/, { timeout: 25_000 });
    } finally {
      // Страховка: квартира DEMO снова свободна, даже если тест упал посередине.
      await setStatus("free");
      await cabinet.close();
    }
  });
});
