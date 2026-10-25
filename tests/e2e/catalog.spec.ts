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

  test("фильтр: комнаты и цена в адресе, ссылка открывается на результатах, пусто — подсказка", async ({ page, isMobile }) => {
    await page.goto("/ru/novostroyki");
    if (isMobile) await page.getByRole("button", { name: "Фильтры" }).click();
    // Телефон: открытый фильтр — диалог на весь экран.
    const filter = page.getByRole(isMobile ? "dialog" : "complementary", { name: "Фильтры" });
    await filter.getByRole("group", { name: "Комнаты" }).getByRole("button", { name: "4+" }).click();
    await expect(page).toHaveURL(/komnat=4/);
    // 4-комн. в DEMO — только у Namuna и Yulduz.
    await expect(filter.getByRole("button", { name: "Показать 2 ЖК" })).toBeVisible();
    await filter.getByRole("button", { name: "Показать 2 ЖК" }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(2);
    await expect(page.getByText("Найдено 2 ЖК")).toBeVisible();
    await page.goto("/ru/novostroyki?do=1000");
    await expect(page.getByText("По вашему запросу ничего нет")).toBeVisible();
    await page.locator(".catalog-results__empty").getByRole("button", { name: "Сбросить" }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(4);
    await expect(page).toHaveURL(/\/ru\/novostroyki$/);
    await page.goto("/ru/novostroyki?sort=exp");
    await expect(page.locator(".catalog-card").first()).toContainText("ЖК Yulduz");
  });

  test("телефон: фильтр — диалог на весь экран, фокус внутрь и обратно, Escape закрывает", async ({ page, isMobile }) => {
    test.skip(!isMobile, "только телефон");
    await page.goto("/ru/novostroyki");
    await page.getByRole("button", { name: "Фильтры" }).click();
    const filter = page.locator(".catalog-filter--open");
    await expect(filter).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s34-filter-open.png` });
    await expect(page.getByRole("dialog", { name: "Фильтры" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Закрыть фильтры" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(filter).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Фильтры" })).toBeFocused();
  });

  test("фото листается: следующий кадр подгружается и не открывает ЖК", async ({ page, isMobile }) => {
    test.skip(isMobile, "стрелки — на десктопе");
    await page.goto("/ru/novostroyki");
    const card = page.locator(".catalog-card").first();
    await card.locator(".catalog-card__media").hover();
    await card.getByRole("button", { name: "Следующее фото" }).click();
    await expect(card.locator(".catalog-card__dots")).toHaveAttribute("aria-label", "Фото 2 из 5");
    await expect(page).toHaveURL(/\/ru\/novostroyki$/);
  });

  test("переход по ссылке внутри сайта: каталог без ошибок в консоли", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru");
    await page.locator("footer").getByRole("link", { name: "Новостройки" }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(4);
    expect(errors).toEqual([]);
  });

  test("UZ: названия и подписи на узбекском", async ({ page }) => {
    await page.goto("/uz/novostroyki");
    await expect(page.locator(".catalog-card").filter({ hasText: "Shodlik TJM" })).toContainText("ta qoldi");
  });
});
