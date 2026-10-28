import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Шаг 3.16а: «Витрина» на служебном стенде (/dev/vitrina, DEMO как в supabase/demo/seed.sql) —
// вкладки и списки со статусами периода, очередь рекламы (Г1 A), формы с правилами: переводы,
// правило 1.2, «нет скидок», ЖК. Те же компоненты, что у /admin/vitrina; действия стенда — настоящие
// проверки форм без базы.

const BASE = "/dev/vitrina";
const SPECIAL = `${BASE}/spetspredlozheniya/00000000-0000-4000-8000-00000000f0a1`;

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Ошибка под парой RU | UZ или под отметками ЖК — внутри формы, не объявление Next.js. */
const issueOf = (page: Page, text: string | RegExp) => page.locator(".field__error").filter({ hasText: text });

test.describe("кабинет · витрина (стенд)", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("вкладки и список спецпредложений: 4 записи, «Старт продаж» ждёт своего дня, «На сайте» — 3", async ({ page }) => {
    await page.goto(`${BASE}/spetspredlozheniya`);
    const tabs = page.getByRole("navigation", { name: "Разделы витрины" });
    await expect(tabs.getByRole("link")).toHaveText(["Спецпредложения", "Подборки", "Реклама"]);
    await expect(tabs.getByRole("link", { name: "Спецпредложения" })).toHaveAttribute("aria-current", "page");

    const rows = page.locator(".showcase-list__row");
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: "Старт продаж второй очереди Yulduz" })).toContainText(/Ждёт/);
    await expect(rows.filter({ hasText: "Кухонный гарнитур в подарок" })).toContainText("Farg‘ona Sifat Qurilish · 1 ЖК");

    await page.getByRole("group", { name: "Показ" }).getByRole("button", { name: /На сайте/ }).click();
    await expect(rows).toHaveCount(3);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("реклама: одно место на главной — при пересечении периодов список говорит, кто покажется первым (Г1 A)", async ({ page }) => {
    await page.goto(`${BASE}/reklama`);
    const rows = page.locator(".showcase-list__row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("первой покажется эта");
    await expect(rows.nth(1)).toContainText("первой покажется она");
    await expect(rows.nth(1)).toContainText(/Ждёт/);
  });

  test("форма спецпредложения: «скидка» и контакты не проходят, без ЖК — отказ; исправленная — «Сохранено»", async ({ page }) => {
    await page.goto(SPECIAL);
    await expect(page.getByRole("heading", { level: 2, name: "Спецпредложение" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Подарок", includeHidden: true })).toBeChecked();

    await page.locator("#special-title-ru").fill("Скидка 15% при 100% оплате");
    await page.locator("#special-text-ru").fill("Звоните +998 90 123 45 67");
    await page.locator("#special-text-uz").fill("Qo‘ng‘iroq qiling +998 90 123 45 67");
    await page.getByRole("checkbox", { name: "Shodlik" }).uncheck();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(issueOf(page, "На сайте скидок нет")).toBeVisible();
    await expect(issueOf(page, "правило 1.2")).toBeVisible();
    await expect(issueOf(page, "Отметьте хотя бы один ЖК")).toBeVisible();

    await page.locator("#special-title-ru").fill("Кухонный гарнитур в подарок");
    await page.locator("#special-text-ru").fill("");
    await page.locator("#special-text-uz").fill("");
    await page.getByRole("checkbox", { name: "Shodlik" }).check();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();
    await expect(page.locator(".field__error")).toHaveCount(0);
  });

  test("новая подборка: вручную без ЖК — отказ, по фильтру «Сдан» — создана, адрес на сайте с ?podborka=", async ({ page }) => {
    await page.goto(`${BASE}/podborki/novoe`);
    await expect(page.getByRole("heading", { level: 2, name: "Новая подборка" })).toBeVisible();
    await expect(page.getByText("появится после сохранения")).toBeVisible();

    await page.locator("#collection-title-ru").fill("Сданные дома");
    await page.locator("#collection-title-uz").fill("Topshirilgan uylar");
    // Переключатели вида — скрытые радио под подписями: нажимаем подпись.
    await page.getByText("ЖК вручную", { exact: true }).click();
    await expect(page.getByRole("checkbox", { name: /Shodlik/ })).toBeVisible();
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(issueOf(page, "Отметьте хотя бы один ЖК")).toBeVisible();

    await page.getByText("По фильтру", { exact: true }).click();
    await page.getByLabel("Срок сдачи").selectOption("built");
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page).toHaveURL(/\/dev\/vitrina\/podborki\/00000000-0000-4000-8000-00000000f0c1$/);
    await expect(page.getByText("/novostroyki?podborka=demo-sdannye-doma")).toBeVisible();
    await expect(page.getByText("Адрес каталога: /novostroyki?srok=built")).toBeVisible();
  });
});
