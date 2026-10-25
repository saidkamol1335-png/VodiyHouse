import { expect, test } from "@playwright/test";

// Базовые эффекты по решениям дизайн-интервью 19.10.2026 (docs/design-decisions.md).
test.describe("базовые эффекты", () => {
  test("Э1: линии колонок на сайте есть, в кабинете нет", async ({ page }) => {
    await page.goto("/uz");
    await expect(page.locator(".bg-columns")).toHaveCount(1);
    await page.goto("/admin");
    await expect(page.locator(".bg-columns")).toHaveCount(0);
  });

  test("Э2: стекло в full с blur, в lite — без", async ({ page }) => {
    await page.goto("/dev/preview?motion=full");
    const bar = page.locator(".effects-preview__bar");
    await expect(bar).toHaveCSS("backdrop-filter", /blur\(18px\)/);
    await page.goto("/dev/preview?motion=lite");
    await expect(bar).toHaveCSS("backdrop-filter", "none");
  });

  test("Э4: зерно в full статичное, в lite его нет", async ({ page }) => {
    await page.goto("/uz?motion=full");
    const grain = page.locator(".film-grain");
    await expect(grain).toBeVisible();
    await expect(grain).toHaveCSS("animation-name", "none");
    await page.goto("/uz?motion=lite");
    await expect(grain).toBeHidden();
  });

  test("Э3: подсветка за курсором — скриншоты full и lite", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "мышь — только десктоп");
    for (const motion of ["full", "lite"] as const) {
      await page.goto(`/dev/preview?motion=${motion}`);
      await expect(page.locator("html")).toHaveAttribute("data-motion", motion);
      const card = page.locator(".effects-preview__card").first();
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      if (!box) throw new Error("нет карточки");
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.35);
      await page.waitForTimeout(500);
      await page.locator(".effects-preview__cards").screenshot({
      caret: "initial",
        path: `test-results/screens/effects/spotlight-${motion}.png`,
      });
    }
  });
});
