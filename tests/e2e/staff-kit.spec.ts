import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// «Настройки → Сотрудники» (шаг 8, С1–С5) на стенде /dev/staff: DEMO мокапа, Supabase подменён.
// Настоящий список и действия против облака — staff.spec.ts.
const PAGE = "/dev/staff";
const isPhone = (projectName: string) => projectName === "mobile-390";

const row = (page: Page, name: string) => page.locator(".staff-list__row").filter({ hasText: name });

test.describe("«Сотрудники» — список", () => {
  test("строки DEMO: роль, состояние, даты; своя строка — «Это вы» без действий", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(PAGE);
    await expect(page.getByRole("heading", { level: 2, name: "Сотрудники" })).toBeVisible();
    await expect(page.locator(".staff-list__count")).toHaveText("6 сотрудников");
    await expect(page.locator(".staff-list__name")).toHaveText([
      "Азиз Рахимов",
      "Бахтиёр Каримов",
      "Дилноза Юсупова",
      "Сардор Алиев",
      "Жасур Тошматов",
      "Нигора Саидова",
    ]);

    await expect(row(page, "Азиз Рахимов")).toContainText("Ждёт первого входа");
    await expect(row(page, "Азиз Рахимов")).toContainText("Ещё не входил");
    await expect(row(page, "Сардор Алиев")).toContainText("Видеограф");
    await expect(row(page, "Нигора Саидова")).toContainText("Отключён");
    await expect(row(page, "Нигора Саидова").locator(".staff-list__warning")).toHaveCount(0);
    await expect(row(page, "Жасур Тошматов").locator(".staff-list__warning")).toHaveText(
      "Вход ещё не закрыт — нажмите «Отключить» ещё раз",
    );

    const self = row(page, "Бахтиёр Каримов");
    await expect(self).toContainText("Это вы");
    await expect(self).toContainText("Руководитель");
    // Даты — по Ташкенту: 20.10.2026 04:12 UTC → 09:12.
    await expect(self).toContainText("Вход 20.10.2026 09:12");
    await expect(self.locator(".staff-list__actions")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("телефон — карточки, без горизонтальной прокрутки", async ({ page }, testInfo) => {
    await page.goto(PAGE);
    const name = row(page, "Дилноза Юсупова").locator(".staff-list__name");
    const badges = row(page, "Дилноза Юсупова").locator(".staff-list__badges");
    const [nameBox, badgesBox] = [await name.boundingBox(), await badges.boundingBox()];
    if (isPhone(testInfo.project.name)) {
      expect(badgesBox!.y).toBeGreaterThan(nameBox!.y + nameBox!.height - 1);
    } else {
      expect(Math.abs(badgesBox!.y + badgesBox!.height / 2 - (nameBox!.y + nameBox!.height / 2))).toBeLessThan(24);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`скриншоты списка · ${theme}`, async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      await page.goto(PAGE);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      const folder = `test-results/screens/${testInfo.project.name}`;
      await page.screenshot({ path: `${folder}/staff-list-${theme}.png`, fullPage: true });
    });
  }
});
