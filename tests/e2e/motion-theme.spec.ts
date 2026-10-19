import { expect, test } from "@playwright/test";

const html = (page: import("@playwright/test").Page) => page.locator("html");

test.describe("режимы анимации (CLAUDE.md §3)", () => {
  test("телефон 390 — lite", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "только для телефона");
    await page.goto("/uz");
    await expect(html(page)).toHaveAttribute("data-motion", "lite");
  });

  test("?motion=full включает full", async ({ page }) => {
    await page.goto("/uz?motion=full");
    await expect(html(page)).toHaveAttribute("data-motion", "full");
  });

  test("?motion=lite держит lite", async ({ page }) => {
    await page.goto("/uz?motion=lite");
    await expect(html(page)).toHaveAttribute("data-motion", "lite");
  });

  test("prefers-reduced-motion — none поверх ?motion=full", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/uz?motion=full");
    await expect(html(page)).toHaveAttribute("data-motion", "none");
    await context.close();
  });
});

test.describe("тема", () => {
  test("по умолчанию светлая", async ({ page }) => {
    await page.goto("/uz");
    await expect(html(page)).toHaveAttribute("data-theme", "light");
  });

  test("сохранённая тёмная ставится до гидрации — без мигания", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vh-theme", "dark"));
    // Блокируем JS-чанки приложения: работать может только скрипт в <head>.
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await page.goto("/uz");
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
  });

  test("кнопка на /dev/preview переключает тему и запоминает выбор", async ({ page }) => {
    await page.goto("/dev/preview");
    await page.getByRole("button", { name: /Тёмная/ }).click();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
  });
});
