import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors, imageFile } from "./helpers";

// Шаг 10 фазы 1: общие компоненты кабинета на служебной странице застройщика (/dev/admin-kit) —
// решения Д2–Д5: вкладки-адреса, RU и UZ рядом, плитка логотипа и зона фона, квартал + год.

const BASE = "/dev/admin-kit";

// Ошибка под зоной загрузки. Просто getByRole("alert") нельзя: в разработке Next.js держит
// на странице свой alert — объявление переходов.
const issueOf = (page: Page, inputId: string) =>
  page
    .locator(".media-drop")
    .filter({ has: page.locator(`#${inputId}`) })
    .getByRole("alert");

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("кабинет · компоненты застройщика", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("вкладки — отдельные адреса, активная подсвечена, «назад» работает", async ({ page }) => {
    await page.goto(BASE);
    const tabs = page.getByRole("navigation", { name: "Разделы застройщика" });
    await expect(page.getByText("Опубликован", { exact: true })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Основное" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await tabs.getByRole("link", { name: "Сданные объекты" }).click();
    await expect(page).toHaveURL(`${BASE}/obyekty`);
    await expect(tabs.getByRole("link", { name: "Сданные объекты" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(tabs.getByRole("link", { name: "Основное" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.goBack();
    await expect(page).toHaveURL(BASE);
    await expect(tabs.getByRole("link", { name: "Основное" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("RU и UZ: рядом на десктопе, друг под другом на телефоне", async ({ page }, testInfo) => {
    await page.goto(BASE);
    const ru = (await page.getByLabel("О компании · RU").boundingBox())!;
    const uz = (await page.getByLabel("Kompaniya haqida · UZ").boundingBox())!;
    if (testInfo.project.name === "desktop-1440") {
      expect(Math.abs(ru.y - uz.y)).toBeLessThan(2);
      expect(uz.x).toBeGreaterThan(ru.x + ru.width);
    } else {
      expect(uz.y).toBeGreaterThan(ru.y + ru.height);
    }
  });

  test("пустой перевод подсвечивается, счётчик и лимит под вёрстку", async ({ page }) => {
    await page.goto(BASE);
    const founders = page.getByLabel("Основатели · RU");
    await founders.fill("Инженеры-строители");
    await expect(page.getByText("Нужен текст на узбекском")).toBeVisible();
    await expect(page.getByText("18/200")).toBeVisible();
    await page.getByLabel("Asoschilar · UZ").fill("Quruvchi muhandislar");
    await expect(page.getByText("Нужен текст на узбекском")).toHaveCount(0);

    const about = page.getByLabel("О компании · RU");
    await about.fill("а".repeat(700));
    await expect(about).toHaveValue("а".repeat(600));
    await expect(page.getByText("600/600")).toHaveClass(/field__counter--near/);
  });

  test("сданные объекты: квартал + год → плашка «в срок / перенос»", async ({ page }) => {
    await page.goto(`${BASE}/obyekty`);
    const rows = page.getByTestId("project-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByTestId("project-status")).toHaveText("Сдан в срок");
    await expect(rows.nth(1).getByTestId("project-status")).toHaveText("Перенос на 3 мес.");

    const fact = rows.nth(1).getByRole("group", { name: "Факт" });
    await fact.getByLabel("Квартал").selectOption("3");
    await expect(rows.nth(1).getByTestId("project-status")).toHaveText("Перенос на 9 мес.");
    await expect(fact.locator('input[type="hidden"]')).toHaveValue("2023-09-30");

    await page.getByRole("button", { name: "Добавить объект" }).click();
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(2).getByTestId("project-status")).toHaveText("");
    await rows.nth(2).getByRole("button", { name: "Удалить объект" }).click();
    await expect(rows).toHaveCount(2);
  });

  test("логотип: плитка «+», превью, удаление; маленький — понятная ошибка", async ({ page }) => {
    await page.goto(BASE);
    const logo = page.locator("#developer-logo");
    await logo.setInputFiles(await imageFile(page, { width: 300, height: 300, type: "image/png" }));
    await expect(issueOf(page, "developer-logo")).toHaveText(/300 px .*от 400 px/);

    await logo.setInputFiles(await imageFile(page, { width: 800, height: 800, type: "image/png" }));
    await expect(issueOf(page, "developer-logo")).toHaveCount(0);
    await expect(page.locator(".media-drop__tile-image")).toBeVisible();
    await page.getByRole("button", { name: "Удалить" }).click();
    await expect(page.getByTestId("developer-logo-pick")).toBeVisible();
  });

  test("фон: зона загрузки → точка фокуса и три кадра", async ({ page }) => {
    await page.goto(BASE);
    const cover = page.locator("#developer-cover");
    await cover.setInputFiles(
      await imageFile(page, { width: 1200, height: 800, type: "image/jpeg" }),
    );
    await expect(issueOf(page, "developer-cover")).toHaveText(/1200 px .*от 2400 px/);

    await cover.setInputFiles(
      await imageFile(page, { width: 3000, height: 2000, type: "image/jpeg" }),
    );
    for (const frame of ["cover", "card", "phone"]) {
      await expect(page.getByTestId(`frame-${frame}`)).toBeVisible();
    }
    const stage = page.getByTestId("focus-stage");
    const box = (await stage.boundingBox())!;
    await stage.click({ position: { x: box.width - 2, y: box.height / 2 } });
    await expect(page.getByTestId("frame-phone")).toHaveCSS("object-position", "100% 50%");
    await expect(page.getByText("Заменить")).toBeVisible();
  });

  test("страницы не шире экрана", async ({ page }) => {
    for (const path of [BASE, `${BASE}/obyekty`]) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Разделы застройщика" })).toBeVisible();
      expect(await noHorizontalScroll(page)).toBe(0);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`скриншоты · ${theme}`, async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      await page.goto(BASE);
      await page.getByLabel("Основатели · RU").fill("Инженеры-строители");
      await page
        .locator("#developer-cover")
        .setInputFiles(await imageFile(page, { width: 3000, height: 2000, type: "image/jpeg" }));
      await expect(page.getByTestId("frame-phone")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const folder = `test-results/screens/${testInfo.project.name}`;
      await page.screenshot({ path: `${folder}/admin-kit-main-${theme}.png`, fullPage: true });
      await page.goto(`${BASE}/obyekty`);
      // Снимок до гидратации прячет курсор в полях раньше React, и тот видит чужую разметку.
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${folder}/admin-kit-projects-${theme}.png`, fullPage: true });
    });
  }
});
