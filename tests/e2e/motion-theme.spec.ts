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

  // Приёмка §3: автоопределение без ?motion — 1440 с мышью → full, 390 с CPU ×4 → lite.
  test("1440 без подсказки: сигналы + проба FPS → full", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "только десктоп");
    await page.goto("/uz");
    await expect(html(page)).toHaveAttribute("data-motion", "full", { timeout: 5000 });
  });

  test("390 с CPU ×4 без подсказки → lite", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "только телефон");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto("/uz");
    await page.waitForTimeout(1000);
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
