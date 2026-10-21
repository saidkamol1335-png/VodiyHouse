import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors, imageFile } from "./helpers";

// Шаг 11 фазы 1: вкладки ЖК на служебном стенде (/dev/zhk/<id>, DEMO мокапа) — «Блоки» (И4),
// «Планировки» (И5), «Фото» (И6), «Квартиры» до шага 12 и «Журнал».

const complexUrl = (n: number) => `/dev/zhk/00000000-0000-4000-8000-0000000000c${n}`;
const SHODLIK = complexUrl(1);
const GULZOR = complexUrl(5);

/** Переход и гидратация: поля управляемые — ввод до React теряется (как в 10.1 со снимками). */
async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Плашка ответа формы (role=status / role=alert) внутри формы, а не объявление Next.js. */
const formStatus = (page: Page, text: string | RegExp) =>
  page.locator(".form-status").filter({ hasText: text });

const NAMUNA = complexUrl(2);
const cardOf = (page: Page, name: string) =>
  page.getByTestId("block-card").filter({ has: page.getByText(name, { exact: true }) });

test.describe("кабинет · ЖК · блоки и планировки", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("«Блоки» (И4): карточки-сводки как на сайте, порядок стрелками", async ({ page }) => {
    await open(page, `${SHODLIK}/bloki`);
    const cards = page.getByTestId("block-card");
    await expect(cards).toHaveCount(2);
    await expect(cardOf(page, "Блок A").locator(".block-card__summary")).toHaveText(
      "Сдан · 3 кв. 2025 · Черновая · 12 эт. · USD",
    );
    const b = cardOf(page, "Блок B");
    await expect(b).toContainText("Строится · 58 %");
    await expect(b.locator(".block-card__summary")).toHaveText(
      "4 кв. 2027 · White box · 7 из 12 эт. · USD",
    );
    await page.getByRole("button", { name: "Ниже: Блок A" }).click();
    await expect(cards.first()).toContainText("Блок B");
  });

  test("блок со списком квартир не удаляется; сданному не нужны «построено» и %", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}/bloki`);
    const a = cardOf(page, "Блок A");
    await a.getByRole("button", { name: "Изменить" }).click();
    await expect(a).toContainText("У блока список из 88 квартир");
    await expect(a.getByRole("button", { name: "Удалить блок" })).toHaveCount(0);
    await expect(a.getByLabel("Построено этажей")).toHaveCount(0);
    await a.getByRole("radio", { name: "Строится" }).check({ force: true });
    await expect(a.getByLabel("Построено этажей")).toBeVisible();
  });

  test("новый блок: без названия и этажности — ошибки в карточке, потом «Сохранено»", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}/bloki`);
    await page.getByRole("button", { name: "Добавить блок" }).click();
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    // Заголовок карточки меняется вместе с названием — берём последнюю карточку.
    const card = page.getByTestId("block-card").last();
    await expect(card).toContainText("Новый блок");
    await expect(card).toContainText("Нужно название — A, B или 1");
    await expect(card).toContainText("Нужна этажность");
    await card.getByLabel("Название").fill("C");
    await card.getByLabel("Этажей всего").fill("9");
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(formStatus(page, "Сохранено")).toBeVisible();
  });

  test("смена валюты при ценах планировок или квартир — с подтверждением", async ({ page }) => {
    await open(page, `${NAMUNA}/bloki`);
    const card = cardOf(page, "Блок 1");
    await card.getByRole("button", { name: "Изменить" }).click();
    // Выбор применяется только после «Да»: радио управляемое, поэтому клик, а не check.
    await card.getByText("сум", { exact: true }).click();
    await expect(card).toContainText("У блока уже есть цены");
    await expect(card.locator(".block-card__summary")).toContainText("USD");
    await card.getByRole("button", { name: "Да, сменить" }).click();
    await expect(card.locator(".block-card__summary")).toContainText("сум");

    // У Shodlik A цены только у квартир («цена от» планировок пустая) — тоже спрашивает.
    await open(page, `${SHODLIK}/bloki`);
    const shodlik = cardOf(page, "Блок A");
    await shodlik.getByRole("button", { name: "Изменить" }).click();
    await shodlik.getByText("сум", { exact: true }).click();
    await expect(shodlik).toContainText("У блока уже есть цены");
    await expect(shodlik.locator(".block-card__summary")).toContainText("USD");
  });

  test("«Планировки» (И5): переключатель блоков; у блока с квартирами цена — из квартир", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}/planirovki`);
    const rows = page.getByTestId("layout-row");
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText("от $31 000 · свободно 2");
    await expect(rows.first()).toContainText("нет чертежа — на сайте не покажется");
    await expect(rows.first().getByRole("button", { name: "Удалить планировку" })).toBeDisabled();
    await page
      .getByRole("group", { name: "Блок" })
      .getByRole("button", { name: /Блок B/ })
      .click();
    await expect(rows.first()).toContainText("от $31 060 · свободно 8");
  });

  test("чертёж в опубликованный ЖК — только с отметкой 1.2; маленький — понятная ошибка", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}/planirovki`);
    const row = page.getByTestId("layout-row").first();
    const input = row.locator('input[type="file"]');
    await expect(input).toBeDisabled();
    await page.getByRole("checkbox", { name: /Правило 1.2/ }).check();
    await input.setInputFiles(
      await imageFile(page, { width: 800, height: 600, type: "image/png" }),
    );
    await expect(row).toContainText("Слишком маленькое");
    await input.setInputFiles(
      await imageFile(page, { width: 1600, height: 1200, type: "image/png" }),
    );
    await expect(row.getByRole("button", { name: "Открыть чертёж крупно" })).toBeVisible();
    await expect(row).not.toContainText("нет чертежа");
    await row.getByRole("button", { name: "Открыть чертёж крупно" }).click();
    await expect(page.getByRole("dialog", { name: "Чертёж планировки" })).toBeVisible();
  });

  test("блок без квартир: своя цена; пустая строка — ошибки; «Дублировать»", async ({ page }) => {
    await open(page, `${NAMUNA}/planirovki`);
    const rows = page.getByTestId("layout-row");
    await expect(rows).toHaveCount(7);
    await expect(rows.first().getByLabel("Цена от, $")).toHaveValue("33000");
    await rows.first().getByRole("button", { name: "Дублировать планировку" }).click();
    await expect(rows).toHaveCount(8);
    await page.getByRole("button", { name: "Добавить планировку" }).click();
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(rows.last()).toContainText("Выберите комнаты");
    await expect(rows.last()).toContainText("Нужна площадь");
  });

  test("вкладки не шире экрана", async ({ page }) => {
    for (const url of [`${SHODLIK}/bloki`, `${SHODLIK}/planirovki`, `${NAMUNA}/planirovki`]) {
      await open(page, url);
      await page.waitForLoadState("networkidle");
      expect(await noHorizontalScroll(page), url).toBe(0);
    }
  });
});

test.describe("кабинет · ЖК · фото, квартиры, журнал", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("«Фото» (И6): у опубликованного — сначала отметка 1.2; пачка; маленькое — ошибка; обложка", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}/foto`);
    const add = page.getByLabel("Добавить фото");
    await expect(add).toBeDisabled();
    await page.getByRole("checkbox", { name: /Правило 1\.2/ }).check();
    await add.setInputFiles([
      await imageFile(page, { width: 2400, height: 1600, type: "image/jpeg" }),
      await imageFile(page, { width: 1600, height: 1000, type: "image/jpeg" }),
      await imageFile(page, { width: 800, height: 600, type: "image/jpeg" }),
    ]);
    const tiles = page.getByTestId("photo-tile");
    await expect(tiles).toHaveCount(2);
    await expect(page.getByTestId("photo-pending")).toContainText("Слишком маленькое");
    await expect(tiles.first()).toContainText("Обложка");

    await page.getByRole("button", { name: "Фото 2" }).click();
    await expect(page.getByRole("button", { name: "Сделать обложкой" })).toBeDisabled();
    await expect(page.getByText("Обложкой стать не может")).toBeVisible();
    await page.getByRole("button", { name: "Фото 1" }).click();
    await expect(page.getByText("Это обложка — первое фото")).toBeVisible();
  });

  test("порядок стрелкой, точка фокуса и удаление — сразу, без кнопки сохранения", async ({
    page,
  }) => {
    await open(page, `${GULZOR}/foto`);
    await expect(page.getByRole("checkbox", { name: /Правило 1\.2/ })).toHaveCount(0);
    await page
      .getByLabel("Добавить фото")
      .setInputFiles([
        await imageFile(page, { width: 2400, height: 1600, type: "image/jpeg" }),
        await imageFile(page, { width: 3000, height: 2000, type: "image/jpeg" }),
      ]);
    const tiles = page.getByTestId("photo-tile");
    await expect(tiles).toHaveCount(2);
    await page.getByRole("button", { name: "Фото 1" }).click();
    await page.getByRole("button", { name: "Правее" }).click();
    await expect(tiles.nth(1).getByRole("button")).toHaveAttribute("aria-pressed", "true");

    const stage = page.getByTestId("focus-stage");
    const box = (await stage.boundingBox())!;
    await stage.click({ position: { x: box.width - 2, y: box.height / 2 } });
    await expect(page.getByTestId("frame-phone")).toHaveCSS("object-position", "100% 50%");

    await page.getByRole("button", { name: "Удалить фото" }).click();
    await page.getByRole("button", { name: "Да, удалить" }).click();
    await expect(tiles).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Сохранить вкладку" })).toHaveCount(0);
  });

  test("«Квартиры» до шага 12 и «Журнал» ЖК", async ({ page }) => {
    await open(page, `${SHODLIK}/kvartiry`);
    const rows = page.locator(".complex-units__row");
    await expect(rows.first()).toContainText("Блок A");
    await expect(rows.first()).toContainText("список из 88 квартир");
    await expect(rows.first()).toContainText("свободно 12");
    await open(page, `${NAMUNA}/kvartiry`);
    await expect(page.locator(".complex-units__row")).toContainText("списка квартир нет");
    await expect(page.getByRole("link", { name: "Отметить доступность →" })).toHaveAttribute(
      "href",
      `${NAMUNA}/planirovki`,
    );

    await open(page, `${SHODLIK}/zhurnal`);
    await expect(page.getByText("Блок B").first()).toBeVisible();
    await expect(page.getByText("Готовность, %")).toBeVisible();
    await expect(page.getByText("Блок A · 1-комн. · 42,5 м²")).toBeVisible();
  });

  test("журнал квартир (12.2): сводки — сколько, номера, статусы плашками, без сырых ключей", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}/zhurnal`);
    const entries = page.locator(".journal-list__entry");
    const unitsEntry = (text: string) => entries.filter({ hasText: text });

    await expect(unitsEntry("Удалён весь список")).toContainText(
      "свободных 10, в брони 2, продано 76",
    );
    await expect(unitsEntry("Удалён весь список")).toContainText("были в брони: № 30, 77");
    await expect(unitsEntry("Создан список: 88 квартир")).toContainText("№ 1–88");
    // Стояки на разные планировки — запись без пары не пропала.
    await expect(unitsEntry("Стояки")).toContainText("без планировки");
    await expect(unitsEntry("Стояки")).toContainText("3-комн. · 78 м²");
    await expect(unitsEntry("White box")).toContainText("№ 85–88");
    await expect(unitsEntry("$700/м²")).toContainText("22 квартиры");
    await expect(unitsEntry("Создан список")).toContainText("88 квартир");
    const mixed = unitsEntry("1 квартира").filter({ hasText: "№ 47" });
    await expect(mixed).toContainText("Квартиры");
    // Смену статуса показывают группы плашками — пары «Статус было → стало» нет.
    await expect(mixed.locator(".journal-list__change")).toHaveCount(0);
    await expect(mixed.locator(".journal-list__group")).toHaveCount(2);
    await expect(mixed.locator(".badge").filter({ hasText: "бронь" })).toBeVisible();
    await expect(unitsEntry("Отмена смены статуса")).toContainText("не тронуты");
    // Одна квартира — номер в подписи, без «№» и числа в теле.
    const single = unitsEntry("Блок A · кв. 41");
    await expect(single).toContainText("Дилноза Юсупова");
    await expect(single.locator(".journal-list__numbers")).toHaveCount(0);

    await expect(page.locator(".journal-list")).not.toContainText(
      /price_per_m2|finishing_id|units_many|\bsold\b|\breserved\b|summary\./,
    );
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`журнал квартир · скриншот · ${theme}`, async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      await open(page, `${SHODLIK}/zhurnal`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `test-results/screens/${testInfo.project.name}/s12-journal-${theme}.png`,
        fullPage: true,
      });
    });
  }

  test("вкладки не шире экрана", async ({ page }) => {
    for (const url of [`${SHODLIK}/foto`, `${SHODLIK}/kvartiry`, `${SHODLIK}/zhurnal`]) {
      await open(page, url);
      await page.waitForLoadState("networkidle");
      expect(await noHorizontalScroll(page), url).toBe(0);
    }
  });
});
