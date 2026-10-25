import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./helpers";
import { hasCloud } from "./cloud";

// Каталог (шаг 3.4) на DEMO из облака: карточки по мокапу .jc, без скидок, только контакты VH.
// Скриншоты — test-results/screens/<проект>/s34-catalog-*.png.

test.describe("каталог /novostroyki", () => {
  test.skip(!hasCloud, "каталог читает DEMO из облака");

  test("карточки DEMO: класс, застройщик, «Проверено», типы с остатком, цена «от», без скидок", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/novostroyki");
    const cards = page.locator(".catalog-card");
    await expect(cards).toHaveCount(4);
    const shodlik = cards.filter({ hasText: "ЖК Shodlik" });
    await expect(shodlik.getByRole("link", { name: "ЖК Shodlik" })).toHaveAttribute("href", "/ru/novostroyki/demo-shodlik");
    await expect(shodlik).toContainText("Комфорт");
    await expect(shodlik.getByRole("img", { name: "Проверено Vodiy House" })).toBeVisible();
    await expect(shodlik).toContainText("Есть сданные · остальные до 4 кв. 2027");
    await expect(shodlik).toContainText(/1-комн\. от 42,5 м²\s*осталось 14/);
    await expect(shodlik).toContainText(/от \$\d/);
    await expect(page.locator("main")).not.toContainText(/скидк|−\d+%|-\d+%/i);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s34-catalog-ru.png`, fullPage: true });
    expect(errors).toEqual([]);
  });

  test("UZ: названия и подписи на узбекском", async ({ page }) => {
    await page.goto("/uz/novostroyki");
    await expect(page.locator(".catalog-card").filter({ hasText: "Shodlik TJM" })).toContainText("ta qoldi");
  });
});
