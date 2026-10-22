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

  // Сохранённый full ставит скрипт в <head>: lite в конце доказывает, что определение отработало
  // (иначе тест прошёл бы и без него — сервер и так рисует lite). Lite здесь дают сигналы
  // (палец и ширина < 768), проба FPS у телефона не запускается — CPU ×4 для честности условий.
  test("390 с CPU ×4 без подсказки → lite (даже с сохранённым full)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "только телефон");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => localStorage.setItem("vh-motion", "full"));
    await page.goto("/uz");
    await expect(html(page)).toHaveAttribute("data-motion", "lite", { timeout: 5000 });
  });

  test("prefers-reduced-motion — none поверх ?motion=full", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/uz?motion=full");
    await expect(html(page)).toHaveAttribute("data-motion", "none");
    await context.close();
  });
});

// Кабинет — та же оболочка (RootDocument), но экраны свои: режим определяется и там, а none
// глушит анимации фазы 1 (пульс «live», вспышка пилюли).
test.describe("режимы анимации в кабинете", () => {
  for (const path of ["/admin/vhod", "/dev/glavnaya"]) {
    test(`${path}: без подсказки — 1440 → full, 390 → lite`, async ({ page }, testInfo) => {
      await page.goto(path);
      const expected = testInfo.project.name === "desktop-1440" ? "full" : "lite";
      await expect(html(page)).toHaveAttribute("data-motion", expected, { timeout: 5000 });
    });
  }

  test("reduced-motion — none: пульс «live» и вспышка пилюли не анимируются", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.clock.install();
    await page.goto("/dev/glavnaya?demo=change&motion=full");
    await expect(html(page)).toHaveAttribute("data-motion", "none");
    await page.waitForLoadState("networkidle");
    const ping = await page
      .locator(".live-status__dot")
      .evaluate((element) => getComputedStyle(element, "::after").animationName);
    expect(ping).toBe("none");
    await page.clock.runFor(65_000);
    const flash = page.locator(".stock-badge__flash").first();
    await expect(flash).toBeAttached();
    const timing = await flash.evaluate((element) => getComputedStyle(element).animationDuration);
    expect(Number.parseFloat(timing)).toBeLessThan(0.02);
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
