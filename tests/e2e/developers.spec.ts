import { expect, test, type Page } from "./fixtures";
import { hasCloud } from "./cloud";
import { collectPageErrors } from "./helpers";

// Шаг 3.15: застройщики — список с поиском (SiteDevs / MobDevs) и страница (SiteDev / MobDev) на DEMO
// из облака. Скриншоты — test-results/screens/<проект>/s315-*.png.

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/s315-${name}.png`, fullPage: true, caret: "initial" });

test.describe("застройщики", () => {
  test.skip(!hasCloud, "застройщики DEMO — в облаке");

  test("список: три застройщика DEMO по порядку руководителя, поиск сужает, пусто — подсказка", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/zastroyshchiki");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Застройщики");
    const rows = page.locator(".developers-list__row");
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText("Farg‘ona Sifat Qurilish");
    await expect(rows.first()).toContainText("1 новостройка на сайте");
    await expect(rows.first()).toContainText("с 2012 года");
    // Shodlik прошёл все проверки — галочка «Проверено» (подпись только диктору).
    await expect(rows.first().getByText("Проверено Vodiy House")).toBeAttached();
    await shot(page, "list");
    const search = page.getByRole("searchbox", { name: "Поиск по названию" });
    await search.fill("margilon");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Marg‘ilon Invest");
    await search.fill("zzz");
    await expect(page.getByText("Ничего не найдено")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("страница Sifat: первый экран, проверки, вкладки объектов, сданные объекты, условия → калькулятор, другие застройщики, консультация", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/zastroyshchiki/demo-sifat");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Farg‘ona Sifat Qurilish");
    await expect(page.getByText("Основан в 2012 году")).toBeVisible();
    await expect(page.getByText("Сдано квартир: 2 140")).toBeVisible();
    // На сайте у Sifat только Shodlik, и он строится: «Сдано» не пишем.
    await expect(page.getByText("Строится 1 ЖК")).toBeVisible();
    // Shodlik прошёл всё, сданные объекты проверены — плашка целиком, четыре пункта с датами.
    const checks = page.locator(".developer-about__checks");
    await expect(checks.locator("li")).toHaveCount(4);
    await expect(checks).toContainText("Проверено 12.09.2026");
    const tabs = page.getByRole("tablist", { name: "Объекты застройщика" });
    await expect(tabs.getByRole("tab", { name: /^Все/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".catalog-card")).toHaveCount(1);
    await tabs.getByRole("tab", { name: /^Сдано/ }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(0);
    await tabs.getByRole("tab", { name: /^Строится/ }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(1);
    await expect(page.locator(".developer-delivered__table tbody tr")).toHaveCount(2);
    await expect(page.locator(".developer-delivered__table")).toContainText("Перенос на 3 мес.");
    await expect(page.locator(".developer-programs__calc").first()).toHaveAttribute("href", /\/ru\/kalkulyator\?developer=demo-sifat&program=/);
    await expect(page.locator(".developer-others__card")).toHaveCount(2);
    await shot(page, "page");
    await page.getByRole("button", { name: "Получить консультацию" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Консультация по застройщику Farg‘ona Sifat Qurilish")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("чужой адрес — 404; со страницы ЖК ведёт ссылка «Подробнее о застройщике»", async ({ page }) => {
    const response = await page.goto("/ru/zastroyshchiki/net-takogo");
    expect(response?.status()).toBe(404);
    await page.goto("/ru/novostroyki/demo-shodlik");
    await expect(page.getByRole("link", { name: "Подробнее о застройщике" })).toHaveAttribute("href", "/ru/zastroyshchiki/demo-sifat");
  });
});
