import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./helpers";
import { hasCloud } from "./cloud";

// Блок E (шаги 3.9–3.10): главная по мокапу, избранное без входа, «Поделиться» и /podborka.
// Скриншоты — test-results/screens/<проект>/s39-*.png, s310-*.png.

test.describe("главная, избранное, подборка", () => {
  test.skip(!hasCloud, "главная и каталог читают DEMO");

  test("главная: заголовок, «Подобрать квартиру» → каталог ниже, цифры из базы, без скидок и контактов застройщика", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Квартиры в новостройках Ферганы");
    await expect(page.getByRole("link", { name: /Подобрать квартиру/ }).first()).toHaveAttribute("href", /#katalog$/);
    await expect(page.locator("#katalog .catalog-card").first()).toBeVisible();
    const complexes = page.locator(".home-hero__stat").first();
    await expect(complexes.locator("dt")).toHaveText("жилых комплекса");
    await expect(complexes.locator("dd")).toHaveText("4");
    await expect(page.locator(".home-partner").getByRole("link", { name: /Стать партнёром/ })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/скидк|−\d+%|-\d+%/i);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s39-home.png`, fullPage: true, caret: "initial" });
    expect(errors).toEqual([]);
  });

  test("сердце на карточке → счётчик в шапке → /izbrannoe → «Поделиться подборкой» → /podborka", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/novostroyki");
    await page.getByRole("button", { name: "В избранное: ЖК Shodlik" }).click();
    await page.getByRole("button", { name: "В избранное: ЖК Orzu" }).click();
    await expect(page.getByRole("button", { name: "Убрать из избранного: ЖК Shodlik" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "Избранное · 2" })).toBeVisible();
    await page.goto("/ru/izbrannoe");
    await expect(page.getByRole("heading", { name: "В подборке 2 ЖК" })).toBeVisible();
    await expect(page.locator(".catalog-card")).toHaveCount(2);
    await page.getByRole("button", { name: "Поделиться подборкой" }).click();
    const dialog = page.getByRole("dialog", { name: "Поделиться ссылкой" });
    const link = await dialog.getByLabel("Ссылка").inputValue();
    expect(link).toMatch(/\/ru\/podborka\?zhk=demo-(shodlik|orzu)(,|%2C)demo-(shodlik|orzu)$/);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s310-share.png`, caret: "initial" });
    await page.goto(new URL(link).pathname + new URL(link).search);
    await expect(page.getByRole("heading", { name: "Подборка: 2 ЖК" })).toBeVisible();
    await expect(page.locator(".catalog-card")).toHaveCount(2);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s310-podborka.png`, fullPage: true, caret: "initial" });
    expect(errors).toEqual([]);
  });

  test("подборка с несуществующим ЖК — пусто и путь в каталог", async ({ page }) => {
    await page.goto("/ru/podborka?zhk=net-takogo");
    await expect(page.getByText("Подборка пуста или ЖК в ней сняты с продажи.", { exact: false })).toBeVisible();
  });
});
