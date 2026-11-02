import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Шаг 12.6: менеджер (Н2, Н7) на стенде /dev/menedzher/zhk — те же компоненты и те же правила
// роли, что у /admin/zhk (complexAccess, unitsActionsFor). DEMO: Shodlik — блоки со списком (блок
// A — 88 квартир, свободных 12), Namuna — блок без списка; ?demo=variety — вторая планировка Namuna
// «нет в наличии». DEMO не меняется: ответ действия лежит на экране до перезагрузки.

const SHODLIK_ID = "00000000-0000-4000-8000-0000000000c1";
const NAMUNA_ID = "00000000-0000-4000-8000-0000000000c2";
const ARCHIVED_ID = "00000000-0000-4000-8000-0000000000c7";
const MANAGER = "/dev/menedzher/zhk";
const units = (base: string, id: string, query = "") => `${base}/${id}/kvartiry${query}`;

const rows = (page: Page) => page.locator(".units-row");
const bulk = (page: Page) => page.locator(".units-bulk");
const bar = (page: Page) => page.locator(".units-undo");
const nav = (page: Page) => page.getByRole("navigation", { name: "Разделы кабинета" });
const availability = (page: Page, layout: string) =>
  page.getByRole("group", { name: `Наличие: ${layout}` });
const rowOf = (page: Page, number: string) =>
  rows(page).filter({
    has: page.locator(".units-row__number", { hasText: new RegExp(`^${number}$`) }),
  });

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function openList(page: Page) {
  await page.goto(units(MANAGER, SHODLIK_ID));
  await expect(rows(page).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function openAvailability(page: Page, base = MANAGER, query = "?demo=variety") {
  await page.goto(units(base, NAMUNA_ID, query));
  await expect(page.getByRole("heading", { name: "Наличие по планировкам" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("кабинет · ЖК · квартиры: менеджер", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("меню — Главная и ЖК; список без создания и статусов публикации → сразу «Квартиры»", async ({
    page,
  }) => {
    await page.goto(MANAGER);
    await expect(nav(page).getByRole("link", { name: "ЖК", exact: true })).toBeVisible();
    for (const hidden of ["Застройщики", "Настройки"])
      await expect(nav(page).getByRole("link", { name: hidden })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Добавить ЖК" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Статус" })).toHaveCount(0);
    // Архива нет, плашек публикации и «не на сайте: застройщик не опубликован» — тоже.
    await expect(page.locator(".complex-list__row")).toHaveCount(6);
    await expect(page.locator(".complex-list__status")).toHaveCount(0);
    await expect(page.locator(".complex-list__warning")).toHaveCount(0);
    await expect(page.locator(".complex-list__stock").first()).toContainText("свободно 41");
    await page.locator(".complex-list__row").filter({ hasText: "ЖК Shodlik" }).click();
    await expect(page).toHaveURL(new RegExp(`/${SHODLIK_ID}/kvartiry$`));
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("страница ЖК: без статуса, готовности и вкладок; «Основное» перекидывает на «Квартиры»", async ({
    page,
  }) => {
    await page.goto(`${MANAGER}/${SHODLIK_ID}`);
    await expect(page).toHaveURL(new RegExp(`/${SHODLIK_ID}/kvartiry$`));
    await expect(page.getByRole("heading", { name: "ЖК Shodlik" })).toBeVisible();
    await expect(page.locator(".admin-entity-head")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Скрыть с сайта|В архив|Опубликовать/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Основное" })).toHaveCount(0);
    await expect(page.getByText(/из них сайт считает «осталось N»/)).toBeVisible();
    // Другие вкладки — туда же; архивного ЖК (его нет и в списке) менеджеру не открыть и по ссылке.
    await page.goto(`${MANAGER}/${SHODLIK_ID}/bloki`);
    await expect(page).toHaveURL(new RegExp(`/${SHODLIK_ID}/kvartiry$`));
    // Запросом, а не в браузере: страница 404 в разработке пишет в консоль свои предупреждения.
    expect((await page.request.get(units(MANAGER, ARCHIVED_ID))).status()).toBe(404);
    expect((await page.request.get(units("/dev/zhk", ARCHIVED_ID))).status()).toBe(200);
  });

  test("Shodlik: статус тапом с «Отменить»; ни стояков, ни «+ Квартира», ни правки, ни удаления", async ({
    page,
  }) => {
    await openList(page);
    await expect(rows(page)).toHaveCount(88);
    await expect(page.getByRole("button", { name: /^Стояки/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Квартира" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Удалить список блока" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Статус и правка$/ })).toHaveCount(0);
    // Блок со списком: наличие — из квартир, переключателя планировок нет.
    await expect(page.getByRole("heading", { name: "Наличие по планировкам" })).toHaveCount(0);

    await rowOf(page, "4").getByRole("button", { name: "Кв. 4, свободна. Сменить статус" }).click();
    await expect(page.getByRole("button", { name: "Изменить квартиру" })).toHaveCount(0);
    await page
      .getByRole("group", { name: /^Статус кв\. 4/ })
      .getByRole("button", { name: "бронь" })
      .click();
    await expect(bar(page)).toContainText("Кв. 4: свободна → бронь");
    await expect(bar(page).getByRole("button", { name: /Отменить/ })).toBeVisible();
    await bar(page)
      .getByRole("button", { name: /Отменить/ })
      .click();
    await expect(bar(page)).toContainText("Вернули: кв. 4 — свободна");

    await page.getByRole("checkbox", { name: "Выбрать кв. 1", exact: true }).check();
    await expect(bulk(page)).toContainText("Выбрано: 1 квартира");
    await expect(bulk(page).getByRole("button", { name: "Статус", exact: true })).toBeVisible();
    for (const hidden of ["Цена", "Отделка", "Удалить"])
      await expect(bulk(page).getByRole("button", { name: hidden, exact: true })).toHaveCount(0);
    expect(await noHorizontalScroll(page)).toBe(0);

    // Массовый «Статус» и «Отменить» после него — менеджеру тоже («Решаю сам» шага 12).
    await page.getByRole("checkbox", { name: "Выбрать кв. 4", exact: true }).check();
    await bulk(page).getByRole("button", { name: "Статус", exact: true }).click();
    await bulk(page)
      .getByRole("group", { name: "Статус выбранных" })
      .getByRole("button", { name: "бронь" })
      .click();
    await expect(bar(page)).toContainText("2 квартиры → бронь");
    await expect(rowOf(page, "4").getByRole("button", { name: /бронь/ })).toBeVisible();
    await bar(page)
      .getByRole("button", { name: /Отменить/ })
      .click();
    await expect(bar(page)).toContainText("Вернули");
    await expect(rowOf(page, "4").getByRole("button", { name: /свободна/ })).toBeVisible();
  });

  test("Namuna: «Наличие по планировкам» без генератора; тап сохраняет сразу", async ({ page }) => {
    await openAvailability(page);
    await expect(page.getByRole("heading", { name: "Генератор списка" })).toHaveCount(0);
    await expect(page.getByText("цена по запросу").first()).toBeVisible();
    const studio = availability(page, "Студия · 34,2 м²");
    const second = availability(page, "1-комн. · 48,6 м²");
    await expect(studio.getByRole("button", { name: "Доступна" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(second.getByRole("button", { name: "Нет в наличии" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // В имени группы — и цена: у двух планировок бывают одинаковые комнаты и площадь.
    await expect(
      page.getByRole("group", { name: "Наличие: Студия · 34,2 м², от $33 000", exact: true }),
    ).toBeVisible();

    await studio.getByRole("button", { name: "Нет в наличии" }).click();
    await expect(studio.getByRole("button", { name: "Нет в наличии" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("status").filter({ hasText: "Сохранено" })).toHaveText(
      "Сохранено: Студия · 34,2 м², от $33 000 — Нет в наличии",
    );
    await second.getByRole("button", { name: "Доступна" }).click();
    await expect(second.getByRole("button", { name: "Доступна" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const option = await studio.getByRole("button", { name: "Доступна" }).boundingBox();
    expect(option!.height).toBeGreaterThanOrEqual(page.viewportSize()!.width < 760 ? 44 : 36);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("Namuna: отказ базы — прежнее значение и текст у строки", async ({ page }) => {
    await openAvailability(page, MANAGER, "?demo=fail");
    const studio = availability(page, "Студия · 34,2 м²");
    await studio.getByRole("button", { name: "Нет в наличии" }).click();
    await expect(page.getByText("База не успела ответить — попробуйте ещё раз")).toBeVisible();
    await expect(studio.getByRole("button", { name: "Доступна" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(studio.getByRole("button", { name: "Нет в наличии" })).toHaveAccessibleDescription(
      "База не успела ответить — попробуйте ещё раз",
    );
  });

  test("руководитель: на Namuna Н7 над генератором; на «Планировках» галочки «Доступна» нет", async ({
    page,
  }) => {
    await openAvailability(page, "/dev/zhk", "");
    const panel = await page.getByRole("heading", { name: "Наличие по планировкам" }).boundingBox();
    const generator = await page.getByRole("heading", { name: "Генератор списка" }).boundingBox();
    expect(panel!.y).toBeLessThan(generator!.y);
    // «Планировки»: галочки нет, «нет в наличии» видно плашкой — меняется на «Квартирах».
    await page.goto(`/dev/zhk/${NAMUNA_ID}/planirovki?demo=variety`);
    await expect(page.getByLabel("Цена от, $").first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Доступна" })).toHaveCount(0);
    const badge = page.getByText("нет в наличии", { exact: true });
    await expect(badge).toHaveCount(1);
    await expect(badge.locator("xpath=..")).toHaveAttribute(
      "title",
      "Меняется на вкладке «Квартиры»",
    );
    // Плашки в своей колонке: не поверх поля «Цена от» (раньше колонка 220 px их не вмещала).
    const row = page.locator(".layout-row").filter({ has: badge });
    const price = (await row.getByLabel("Цена от, $").boundingBox())!;
    const badges = (await row.locator(".layout-row__badges").boundingBox())!;
    if (page.viewportSize()!.width >= 1100)
      expect(badges.x).toBeGreaterThanOrEqual(price.x + price.width);
    const icon = (await row.getByRole("button", { name: "Дублировать планировку" }).boundingBox())!;
    expect(icon.width).toBeGreaterThanOrEqual(32);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("скриншоты: список и «Квартиры» менеджера, наличие по планировкам", async ({
    page,
  }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.clock.setFixedTime(new Date("2026-10-21T09:46:00Z"));
    await page.goto(MANAGER);
    await expect(page.locator(".complex-list__row").first()).toBeVisible();
    // После гидратации: screenshot прячет курсор стилем, до неё React заметил бы чужой атрибут.
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${dir}/s12-manager-list.png`, caret: "initial" });
    await openList(page);
    await rowOf(page, "4")
      .getByRole("button", { name: /Сменить статус/ })
      .click();
    await page.getByRole("checkbox", { name: "Выбрать кв. 1", exact: true }).check();
    await page.screenshot({ path: `${dir}/s12-manager-units.png`, caret: "initial" });
    await openAvailability(page);
    await page.screenshot({ path: `${dir}/s12-manager-availability.png`, caret: "initial" });
    await openAvailability(page, "/dev/zhk");
    await page.screenshot({ path: `${dir}/s12-availability-head.png`, caret: "initial" });
    await page.goto(`/dev/zhk/${NAMUNA_ID}/planirovki?demo=variety`);
    await expect(page.getByText("нет в наличии", { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${dir}/s12-layouts-unavailable.png`, caret: "initial" });
  });
});
