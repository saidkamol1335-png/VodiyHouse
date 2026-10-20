import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 10.2 фазы 1: «Настройки → Справочники» (Д6) и «Журнал» на служебных стендах. Значения
// справочников — начальные данные миграции; действия — настоящие проверки без базы.

const DICTIONARIES = "/dev/spravochniki";
const JOURNAL = "/dev/zhurnal";

const panel = (page: Page, title: string) =>
  page.locator(".dictionary-editor").filter({ has: page.getByRole("heading", { name: title }) });
const rowOf = (page: Page, title: string, name: string) =>
  panel(page, title).getByTestId("dictionary-row").filter({ hasText: name });
const formStatus = (page: Page, text: string | RegExp) =>
  page.locator(".form-status").filter({ hasText: text });

test.describe("кабинет · справочники и журнал", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("четыре справочника со значениями миграции", async ({ page }) => {
    await page.goto(DICTIONARIES);
    for (const [title, count] of [
      ["Города и районы", "19 значений"],
      ["Типы документов", "6 значений"],
      ["Темы деталей", "6 значений"],
      ["Уровни отделки", "4 значения"],
    ] as const) {
      await expect(panel(page, title).getByText(count)).toBeVisible();
    }
    await expect(rowOf(page, "Города и районы", "Фергана")).toContainText("Город");
  });

  test("правка на месте: перевод обязателен, «Сохранить» → «Сохранено»", async ({ page }) => {
    await page.goto(DICTIONARIES);
    await rowOf(page, "Уровни отделки", "Под ключ")
      .getByRole("button", { name: "Изменить" })
      .click();
    const editor = panel(page, "Уровни отделки");
    await editor.getByLabel("Название · RU").fill("Под ключ с мебелью");
    await editor.getByLabel("Nomi · UZ").fill("");
    await editor.getByRole("button", { name: "Сохранить" }).click();
    await expect(editor.locator(".field__error")).toHaveText("Нужен текст на узбекском");
    await editor.getByLabel("Nomi · UZ").fill("Mebel bilan kalit tayyor");
    await editor.getByLabel("Что входит · RU").fill("Ремонт, сантехника и кухня");
    await editor.getByLabel("Nima kiradi · UZ").fill("Ta’mir, santexnika va oshxona");
    await editor.getByRole("button", { name: "Сохранить" }).click();
    await expect(formStatus(page, "Сохранено")).toBeVisible();
  });

  test("удаление: используемое скрывается, неиспользуемое удаляется", async ({ page }) => {
    await page.goto(DICTIONARIES);
    await rowOf(page, "Города и районы", "Фергана")
      .getByRole("button", { name: "Удалить" })
      .click();
    await expect(page.getByText("Удалить «Фергана»?")).toBeVisible();
    await rowOf(page, "Города и районы", "Фергана").getByRole("button", { name: "Да" }).click();
    await expect(formStatus(page, "«Фергана» используется — скрыто, а не удалено")).toBeVisible();

    await rowOf(page, "Города и районы", "Коканд").getByRole("button", { name: "Удалить" }).click();
    await rowOf(page, "Города и районы", "Коканд").getByRole("button", { name: "Да" }).click();
    await expect(formStatus(page, "«Коканд» удалено")).toBeVisible();
  });

  test("«+ Добавить» и порядок стрелками", async ({ page }) => {
    await page.goto(DICTIONARIES);
    const topics = panel(page, "Темы деталей");
    await topics.getByRole("button", { name: "Добавить" }).click();
    await topics.getByLabel("Название · RU").fill("Безопасность");
    await topics.getByLabel("Nomi · UZ").fill("Xavfsizlik");
    await topics.getByRole("button", { name: "Добавить" }).click();
    await expect(formStatus(page, "Сохранено")).toBeVisible();

    const rows = topics.getByTestId("dictionary-row");
    await rows
      .nth(0)
      .getByRole("button", { name: /Перетащите/ })
      .press("ArrowDown");
    await expect(rows.nth(1)).toContainText("О проекте");
    await expect(formStatus(page, "Порядок сохранён")).toBeVisible();
  });

  test("журнал: записи DEMO с автором и полями", async ({ page }) => {
    await page.goto(JOURNAL);
    const entries = page.locator(".journal-list__entry");
    await expect(entries).toHaveCount(6);
    await expect(entries.nth(1)).toContainText("Сданный объект");
    await expect(entries.nth(1)).toContainText("Факт");
  });

  test("страницы не шире экрана", async ({ page }) => {
    for (const path of [DICTIONARIES, JOURNAL]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`скриншоты · ${theme}`, async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      const folder = `test-results/screens/${testInfo.project.name}`;
      for (const [name, path] of [
        ["dictionaries", DICTIONARIES],
        ["journal", JOURNAL],
      ] as const) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `${folder}/s10-settings-${name}-${theme}.png`,
          fullPage: true,
        });
      }
    });
  }
});
