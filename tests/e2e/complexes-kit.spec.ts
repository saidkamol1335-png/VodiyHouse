import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 11 фазы 1: «ЖК» на служебном стенде (/dev/zhk, DEMO мокапа) — список (в. 5), создание,
// статус и готовность (И8, И9), вкладки «Основное», «Блоки», «Планировки», «Фото» (И1–И6).
// Те же компоненты, что у /admin/zhk; действия стенда — настоящие проверки форм без базы.

const LIST = "/dev/zhk";
const complexUrl = (n: number) => `${LIST}/00000000-0000-4000-8000-0000000000c${n}`;
const MARGILON_INVEST = "00000000-0000-4000-8000-0000000000d2";

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const rowOf = (page: Page, name: string) =>
  page.locator(".complex-list__row").filter({ hasText: `ЖК ${name}` });

test.describe("кабинет · ЖК · список", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("строки как «Остатки по ЖК»: комнаты, «свободно N», плашки; «Все» без архива", async ({
    page,
  }) => {
    await page.goto(LIST);
    await expect(page.locator(".complex-list__row")).toHaveCount(6);
    const shodlik = rowOf(page, "Shodlik");
    await expect(shodlik).toContainText("Фергана · Farg‘ona Sifat Qurilish");
    await expect(shodlik.locator(".complex-list__rooms")).toHaveText("1к 14 · 2к 22 · 3к 5");
    await expect(shodlik.locator(".complex-list__stock")).toHaveText("свободно 41");
    await expect(rowOf(page, "Namuna").locator(".complex-list__rooms")).toHaveText(
      "Ст 13 · 1к 18 · 2к 18 · 3к 13 · 4+ 3",
    );
    // Блок без списка квартир: тип без числа, «свободно N+».
    await expect(rowOf(page, "Gulzor").locator(".complex-list__rooms")).toHaveText(
      "Ст ✓ · 2к 5 · 3к 7",
    );
    await expect(rowOf(page, "Gulzor").locator(".complex-list__stock")).toHaveText("свободно 12+");
    const bahor = rowOf(page, "Bahor");
    await expect(bahor.locator(".complex-list__stock .badge")).toHaveClass(/badge--amber/);
    await expect(bahor).toContainText("Не на сайте: застройщик не опубликован");
  });

  test("поиск без апострофа и по городу; архив — своей пилюлей", async ({ page }) => {
    await page.goto(LIST);
    const rows = page.locator(".complex-list__row");
    await page.getByLabel("Поиск ЖК").fill("коканд");
    await expect(rows).toHaveCount(1);
    await page.getByLabel("Поиск ЖК").fill("NAVROZ");
    await expect(rows).toHaveCount(2);
    await page.getByLabel("Поиск ЖК").fill("");
    await page
      .getByRole("group", { name: "Статус" })
      .getByRole("button", { name: /Архив/ })
      .click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("удалится 13.11.2026");
  });

  test("ЖК застройщика: ?zastroyshchik= — только его, крестик — весь список", async ({ page }) => {
    await page.goto(`${LIST}?zastroyshchik=${MARGILON_INVEST}`);
    await expect(page.locator(".complex-list__row")).toHaveCount(2);
    await page.getByRole("link", { name: /Застройщик: Marg‘ilon Invest/ }).click();
    await expect(page).toHaveURL(LIST);
    await expect(page.locator(".complex-list__row")).toHaveCount(6);
  });

  test("«+ Добавить ЖК»: застройщик и название; UZ подставляется латиницей", async ({ page }) => {
    await page.goto(LIST);
    await page.getByRole("button", { name: "Добавить ЖК" }).click();
    await page.getByRole("button", { name: "Создать черновик" }).click();
    await expect(page.locator(".field__error", { hasText: "Выберите застройщика" })).toBeVisible();
    await expect(page.locator(".field__error", { hasText: "Заполните поле" })).toBeVisible();

    await page.getByLabel("Название · RU").fill("Шодлик Сити");
    await expect(page.getByLabel("Nomi · UZ")).toHaveValue("Shodlik Siti");
    await page.getByLabel("Nomi · UZ").fill("Shodlik City");
    await page.getByLabel("Название · RU").fill("Шодлик");
    await expect(page.getByLabel("Nomi · UZ")).toHaveValue("Shodlik City");

    await page.getByLabel("Застройщик").selectOption({ label: "Kamalak Development" });
    await page.getByRole("button", { name: "Создать черновик" }).click();
    await expect(page).toHaveURL(complexUrl(5));
  });

  test("страница не шире экрана", async ({ page }) => {
    await page.goto(LIST);
    await page.waitForLoadState("networkidle");
    expect(await noHorizontalScroll(page)).toBe(0);
  });
});

const SHODLIK = complexUrl(1);
const GULZOR = complexUrl(5);

/** Плашка ответа формы (role=status / role=alert) внутри формы, а не объявление Next.js. */
const formStatus = (page: Page, text: string | RegExp) =>
  page.locator(".form-status").filter({ hasText: text });

test.describe("кабинет · ЖК · страница", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("вкладки — адреса; у черновика точки там, где не хватает данных", async ({ page }) => {
    await page.goto(GULZOR);
    const tabs = page.getByRole("navigation", { name: "Разделы ЖК" });
    await expect(tabs.getByRole("link")).toHaveText([
      /Основное/,
      /Блоки/,
      /Планировки/,
      "Квартиры",
      /Фото/,
      "Журнал",
    ]);
    await expect(tabs.locator(".admin-tabs__dot")).toHaveCount(4);
    await expect(tabs.getByRole("link", { name: /Фото/ })).toHaveAttribute(
      "href",
      `${GULZOR}/foto`,
    );
    await page.goto(SHODLIK);
    // У опубликованного строки готовности и точек нет.
    await expect(page.locator(".admin-tabs__dot")).toHaveCount(0);
    await expect(page.locator(".complex-readiness")).toHaveCount(0);
  });

  test("готовность (И9): «1 из 8», список — ссылки на вкладки, «нужно ещё 5»", async ({ page }) => {
    await page.goto(GULZOR);
    const toggle = page.getByRole("button", { name: /Для публикации: 1 из 8/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const list = page.locator(".complex-readiness__list");
    await expect(list.locator("li")).toHaveCount(8);
    await expect(list.getByRole("link", { name: /Блок со сроком сдачи/ })).toHaveAttribute(
      "href",
      `${GULZOR}/bloki`,
    );
    await expect(list).toContainText("нужно ещё 5");
  });

  test("публикация (И8): панель с галочкой 1.2; без данных — чего не хватает", async ({ page }) => {
    await page.goto(GULZOR);
    await page.getByRole("button", { name: "Опубликовать" }).click();
    const panel = page.locator(".complex-publish");
    await expect(panel).toContainText("Опубликовать ЖК?");
    const submit = panel.getByRole("button", { name: "Опубликовать на сайте" });
    await expect(submit).toBeDisabled();
    await panel.getByRole("checkbox", { name: /Проверено по правилу 1\.2/ }).check();
    await submit.click();
    await expect(formStatus(page, /Чтобы опубликовать, не хватает:/)).toContainText(
      "точка на карте",
    );
  });

  test("архив — только с верным названием (RU или UZ)", async ({ page }) => {
    await page.goto(GULZOR);
    await page.getByRole("button", { name: "В архив" }).click();
    const confirm = page.getByLabel("Чтобы подтвердить, введите название");
    await confirm.fill("Gulzar");
    await page.getByRole("button", { name: "Да, в архив" }).click();
    await expect(formStatus(page, "Название введено не так")).toBeVisible();
    await confirm.fill("gulzor");
    await page.getByRole("button", { name: "Да, в архив" }).click();
    await expect(formStatus(page, "Отправлен в архив")).toBeVisible();
  });

  test("«Основное»: три панели; контакты в тексте и кривая точка — ошибки, потом «Сохранено»", async ({
    page,
  }) => {
    await page.goto(SHODLIK);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "О ЖК",
      "Расположение",
      "Проверено Vodiy House",
    ]);
    await expect(page.getByText("Этажность считается по блокам: 12 этажей.")).toBeVisible();
    await expect(page.getByLabel("Потолки, м")).toHaveValue("3,0");

    await page.getByLabel("Ориентир · RU").fill("звоните +998 90 123 45 67");
    await page.getByLabel("Координаты или ссылка на карту").fill("рядом с парком");
    await expect(
      page.locator(".point-field").getByText(/Не получилось найти координаты/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(page.getByText(/В тексте контакты/)).toBeVisible();

    await page.getByLabel("Ориентир · RU").fill("напротив центрального парка");
    await page
      .getByLabel("Координаты или ссылка на карту")
      .fill("https://yandex.uz/maps/?pt=71.7843,40.3842&z=17");
    await expect(page.locator(".point-field__coords")).toHaveText(
      "40.384200° с. ш. · 71.784300° в. д.",
    );
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(formStatus(page, "Сохранено")).toBeVisible();
  });

  test("точка вне области — подсказка; класс сбрасывается крестиком", async ({ page }) => {
    await page.goto(SHODLIK);
    await page.getByLabel("Координаты или ссылка на карту").fill("71.7843, 40.3842");
    await expect(page.getByText(/широта и долгота перепутаны/)).toBeVisible();
    const classes = page.getByRole("radiogroup", { name: "Класс" });
    await expect(classes.getByRole("radio", { name: "Комфорт" })).toBeChecked();
    await classes.getByRole("button", { name: "Сбросить" }).click();
    await expect(classes.getByRole("radio", { checked: true })).toHaveCount(0);
  });

  test("несохранённые правки: переход по вкладке спрашивает «Уйти без сохранения?»", async ({
    page,
  }) => {
    await page.goto(SHODLIK);
    await page.getByLabel("До центра, мин").fill("9");
    let asked = "";
    page.once("dialog", (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await page
      .getByRole("navigation", { name: "Разделы ЖК" })
      .getByRole("link", { name: "Журнал" })
      .click();
    expect(asked).toContain("Уйти без сохранения?");
    await expect(page).toHaveURL(SHODLIK);
  });

  test("страница не шире экрана", async ({ page }) => {
    for (const url of [SHODLIK, GULZOR]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      expect(await noHorizontalScroll(page), url).toBe(0);
    }
  });
});
