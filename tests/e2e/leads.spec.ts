import { expect, test, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// Шаг 3.7: заявки. Сайт — окно заявки на странице ЖК и в каталоге (DEMO в базе): проверка полей,
// «Заявка отправлена» с номером; кабинет — «Заявки» (список, шторка, статус, «Взять в работу»),
// главная — «Последние заявки». Каждому тесту — свой адрес посетителя: лимит «5 заявок с адреса за
// 10 минут» (ТЗ 10.2) иначе сработал бы на весь прогон. Заявки e2e — имя «E2E …», их удаляет
// global-teardown.

const COMPLEX = "/ru/novostroyki/demo-shodlik";
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/s37-${name}.png`, caret: "initial" });
/** Местный номер оператора 90 (не «98…»: маска не примет его за код страны). */
const phoneOf = (seed: number) => `90${String(seed % 10_000_000).padStart(7, "0")}`;

test.use({ extraHTTPHeaders: { "x-nf-client-connection-ip": `e2e-${crypto.randomUUID()}` } });

async function sendLead(page: Page, name: string): Promise<number> {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Имя").fill(name);
  await dialog.getByLabel("Телефон").fill(phoneOf(Date.now() + Math.floor(Math.random() * 1000)));
  await dialog.getByRole("button", { name: "Отправить" }).click();
  const number = dialog.getByText(/Номер заявки #\d+/);
  await expect(number).toBeVisible({ timeout: 15_000 });
  return Number((await number.textContent())?.replace(/\D/g, ""));
}

test.describe("сайт · заявки", () => {
  test.skip(!hasCloud, NO_CLOUD);
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test("«Записаться на просмотр»: ошибки полей и фокус, выбор просмотра, «Заявка отправлена» с номером", async ({ page }) => {
    await page.goto(`${COMPLEX}?utm_source=instagram&utm_content=e2e_reels`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Записаться на просмотр" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Запись на просмотр" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("ЖК Shodlik")).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Этот ЖК" })).toBeChecked();
    await expect(dialog.getByRole("link", { name: "обработку персональных данных" })).toHaveAttribute("href", "/ru/privacy");
    await shot(page, "lead-view");
    await dialog.getByRole("button", { name: "Отправить" }).click();
    await expect(dialog.getByText("Укажите имя")).toBeVisible();
    await expect(dialog.getByLabel("Имя")).toBeFocused();
    await dialog.getByLabel("Имя").fill("E2E Просмотр");
    await dialog.getByLabel("Телефон").fill("90 12");
    await dialog.getByRole("button", { name: "Отправить" }).click();
    await expect(dialog.getByText("Номер в формате +998 XX XXX XX XX")).toBeVisible();
    await dialog.getByRole("radio", { name: "Вечером" }).check();
    const number = await sendLead(page, "E2E Просмотр");
    expect(number).toBeGreaterThan(1000);
    await expect(dialog.getByRole("status")).toBeFocused();
    await shot(page, "lead-done");
    // Под ответом — «Закрыть» текстом (у «×» в шапке та же подпись для диктора).
    await dialog.getByText("Закрыть", { exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("каталог: «Перезвоните мне» на карточке — окно с ЖК; страница ЖК: «Хотите узнать больше?» отправляется на месте", async ({ page }) => {
    await page.goto("/ru/novostroyki");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Перезвоните мне" }).first().click();
    await expect(page.getByRole("dialog", { name: /Перезвон/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto(COMPLEX);
    await page.waitForLoadState("networkidle");
    const more = page.locator(".lead-more");
    await more.scrollIntoViewIfNeeded();
    await more.getByLabel("Имя").fill("E2E Узнать больше");
    await more.getByLabel("Телефон").fill(phoneOf(Date.now()));
    await more.getByRole("radio", { name: "Узбекский" }).check();
    await more.getByRole("button", { name: "Отправить" }).click();
    await expect(more.getByText("Заявка отправлена")).toBeVisible({ timeout: 15_000 });
    await shot(page, "lead-more");
    expect(errors).toEqual([]);
  });
});

test("служебные адреса: /api/cron без секрета — 403, /api/telegram без бота — 503, с чужим секретом — 403", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "без раскладки — один раз");
  expect((await request.post("/api/cron/leads")).status()).toBe(403);
  expect((await request.post("/api/cron/leads", { headers: { authorization: "Bearer wrong-secret-1234567" } })).status()).toBe(403);
  const telegram = await request.post("/api/telegram", { headers: { "x-telegram-bot-api-secret-token": "wrong-secret" }, data: {} });
  expect([403, 503]).toContain(telegram.status());
});

test.describe("кабинет · заявки", () => {
  test.skip(!hasCloud, NO_CLOUD);

  test.describe("руководитель", () => {
    test.use({ storageState: cabinetState("head") });

    test("заявка с сайта — в списке; шторка: статус, «Взять в работу»; главная — «Последние заявки»", async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.goto(COMPLEX);
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Узнать о наличии" }).first().click();
      const name = `E2E Наличие ${test.info().project.name}`;
      const number = await sendLead(page, name);
      await page.goto("/admin/zayavki");
      const row = page.locator(".leads-table__row", { hasText: `#${number}` });
      await expect(row).toContainText(name);
      await expect(row).toContainText("Узнать о наличии");
      await expect(row).toContainText("ЖК Shodlik");
      await shot(page, "leads");
      await row.getByRole("button", { name: `Открыть заявку #${number}` }).click();
      const drawer = page.getByRole("dialog", { name: `Заявка #${number}` });
      await expect(drawer).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`n=${number}`));
      await expect(drawer.locator(".lead-drawer__message")).toContainText(`Новая заявка #${number} — Узнать о наличии`);
      await expect(drawer.getByText("Застройщику — не передаётся")).toBeVisible();
      await drawer.getByRole("button", { name: "Перезвонили" }).click();
      // Статус пишет действие сервера в базу: в общем прогоне e2e под нагрузкой — дольше 5 с.
      await expect(drawer.locator(".lead-drawer__head .lead-status")).toHaveText("Перезвонили", { timeout: 15_000 });
      await drawer.getByRole("button", { name: "Взять в работу" }).click();
      await expect(drawer.getByRole("button", { name: /\(вы\)/ })).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
      await shot(page, "lead-drawer");
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(row).toContainText("Перезвонили");
      await page.goto("/admin");
      await expect(page.locator(".home-leads__row", { hasText: `#${number}` })).toBeVisible();
      await shot(page, "home");
      expect(errors).toEqual([]);
    });

    test("фильтры в адресе: статус и поиск по номеру; CSV — та же выборка", async ({ page, request }) => {
      await page.goto("/admin/zayavki?status=new");
      await expect(page.getByRole("button", { name: /^Новая/ })).toHaveAttribute("aria-pressed", "true");
      await page.getByLabel("Поиск по заявкам").fill("E2E");
      await expect(page).toHaveURL(/q=E2E/);
      const csv = await request.get("/admin/zayavki/csv?q=E2E", {
        headers: { cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") },
      });
      expect(csv.headers()["content-type"]).toContain("text/csv");
      expect(await csv.text()).toContain("№;Когда;Клиент;Номер;Тип");
    });
  });

  test.describe("менеджер", () => {
    test.use({ storageState: cabinetState("manager") });

    test("видит «Заявки» в меню и список", async ({ page }) => {
      await page.goto("/admin/zayavki");
      await expect(page.getByRole("heading", { name: "Заявки", level: 1 })).toBeVisible();
      await expect(page.locator(".leads-screen__rule")).toBeVisible();
    });
  });

  test.describe("видеограф", () => {
    test.use({ storageState: cabinetState("videographer") });

    test("заявок не видит: раздел закрыт", async ({ page }) => {
      await page.goto("/admin/zayavki");
      await expect(page.locator(".leads-screen")).toHaveCount(0);
      await expect(page.locator(".leads-table__row")).toHaveCount(0);
    });
  });
});
