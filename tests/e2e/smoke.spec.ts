import { expect, test } from "@playwright/test";
import { collectPageErrors, PUBLIC_PAGES } from "./helpers";

test.describe("каркас открывается", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path}: заголовок, язык документа, чистая консоль`, async ({ page }) => {
      const errors = collectPageErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", path.slice(1));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("/admin: экран входа, кабинет на русском", async ({ page }) => {
    const errors = collectPageErrors(page);
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { name: "Вход для сотрудников" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("язык", () => {
  test("/ без выбора — на /uz", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/uz$/);
  });

  test("выбор запоминается: после /ru корень ведёт на /ru", async ({ page }) => {
    await page.goto("/ru");
    await page.goto("/");
    await expect(page).toHaveURL(/\/ru$/);
  });

  test("язык браузера не учитывается (ТЗ 1.5)", async ({ browser }) => {
    const context = await browser.newContext({ locale: "ru-RU", extraHTTPHeaders: { "Accept-Language": "ru" } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/uz$/);
    await context.close();
  });

  test("неизвестная страница — 404", async ({ page }) => {
    const response = await page.goto("/uz/net-takoy-stranicy");
    expect(response?.status()).toBe(404);
  });
});
