import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// /kalkulyator — риелторский калькулятор (PLAN §10, п. 48): работает всегда, и без базы (тогда без
// $ | сум), пункт меню есть всегда; на сайте нет ни слова о скидках ни в HTML, ни в JS (PLAN §3.13).
// Раскладка 390 без прокрутки вбок, «К расчёту ↓» в полосе, луч итога в full, смена языка с
// расчётом; скриншоты s26 одним прогоном.

const DISCOUNT = /скидк|chegirma|discount/i;
const SHOT_TIME = new Date("2026-11-04T09:46:00Z");

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
/** Пункты шапки — за кнопкой меню: телефон и планшет (761–1279 px, приёмка 3а — 768). */
const hasMenuButton = (page: Page) => (page.viewportSize()?.width ?? 0) < 1280;
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const menu = (page: Page, locale: "ru" | "uz") =>
  page.getByRole("button", { name: locale === "ru" ? "Открыть меню" : "Menyuni ochish" });

test.describe("сайт · страница калькулятора", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  for (const locale of ["ru", "uz"] as const) {
    test(`/${locale}/kalkulyator: шапка, итог, пункт меню, ни слова о скидках в HTML и JS`, async ({
      page,
      request,
    }) => {
      const scripts: string[] = [];
      page.on("response", (response) => {
        if (response.url().includes("/_next/static/") && response.url().endsWith(".js")) {
          scripts.push(response.url());
        }
      });
      await page.goto(`/${locale}/kalkulyator`);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByTestId("calc-total").locator(".calc-total__value")).toBeVisible();
      await expect(page.getByRole("tab")).toHaveCount(3);
      await expect(
        page.getByRole("button", { name: /Получить точный расчёт|Aniq hisob-kitobni olish/ }),
      ).toHaveCount(1);
      if (hasMenuButton(page)) await menu(page, locale).click();
      const nav = page.getByRole("link", { name: locale === "ru" ? "Калькулятор" : "Kalkulyator" });
      await expect(nav.first()).toHaveAttribute("aria-current", "page");
      expect(scripts.length).toBeGreaterThan(0);
      expect(await page.content()).not.toMatch(DISCOUNT);
      for (const url of scripts)
        expect(await (await request.get(url)).text(), url).not.toMatch(DISCOUNT);
    });
  }

  test("смена языка не теряет расчёт: параметры адреса переходят на /uz", async ({ page }) => {
    await page.goto("/ru/kalkulyator?tab=installment&months=36");
    await page.waitForLoadState("networkidle");
    if (isPhone(page)) await menu(page, "ru").click();
    await page
      .getByRole("link", { name: /^(UZ|O‘zbekcha)$/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/uz\/kalkulyator\?tab=installment&months=36$/);
    await expect(page.getByRole("tab", { name: "Muddatli to‘lov" })).toHaveAttribute("aria-selected", "true");
  });

  test("без горизонтальной прокрутки; на телефоне «К расчёту ↓» ведёт к итогу", async ({ page }) => {
    await page.goto("/ru/kalkulyator?tab=installment&months=24");
    await page.waitForLoadState("networkidle");
    expect(await noHorizontalScroll(page)).toBe(0);
    const bar = page.locator(".calc-sticky-bar");
    if (!isPhone(page)) return expect(bar).toBeHidden();
    // 600 млн − взнос 120 млн = 480 млн / 24 мес.
    await expect(bar).toContainText(/Платёж в месяц\s*20 млн сум/);
    await bar.getByRole("button", { name: "К расчёту" }).click();
    const total = page.getByTestId("calc-total");
    await expect(total).toBeInViewport();
    // Полоса стала inert — фокус на итоге, а не в body; итог не под липкой шапкой.
    await expect(total).toBeFocused();
    await expect(bar).toHaveAttribute("data-hidden", "");
    const [header, top] = await Promise.all([
      page.locator(".site-header").evaluate((element) => element.getBoundingClientRect().bottom),
      total.evaluate((element) => element.getBoundingClientRect().top),
    ]);
    expect(top).toBeGreaterThanOrEqual(header);
  });

  test("луч итога — только в full; в lite его нет", async ({ page }) => {
    await page.goto("/ru/kalkulyator?motion=full");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("calc-total").locator(".beam")).toHaveCSS("display", "block");
    await page.goto("/ru/kalkulyator?motion=lite");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("calc-total").locator(".beam")).toHaveCSS("display", "none");
  });

  test("скриншоты s26: ипотека (ru, uz), рассрочка, «Сколько могу купить», график, окно заявки", async ({
    page,
  }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    // ?motion=none — без анимаций: фон и появление страницы сайта не дожидаемся (как у s315).
    const shot = (name: string, fullPage = false) =>
      page.screenshot({ path: `${dir}/s26-${name}.png`, fullPage, caret: "initial" });
    await page.clock.setFixedTime(SHOT_TIME);
    await page.goto("/ru/kalkulyator?motion=none");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await shot("calc", true);
    await page.getByRole("tab", { name: "Рассрочка" }).click();
    await shot("installment");
    await page.getByRole("tab", { name: "Сколько могу купить" }).click();
    await shot("afford");
    await page.getByRole("tab", { name: "Ипотека" }).click();
    await page.getByRole("button", { name: "Показать график платежей" }).click();
    await page.locator(".calc-schedule__table").scrollIntoViewIfNeeded();
    await shot("schedule");
    await page.getByRole("button", { name: "Получить точный расчёт" }).click();
    await expect(page.getByRole("dialog", { name: "Точный расчёт" })).toBeVisible();
    await shot("lead");
    await page.keyboard.press("Escape");
    await page.goto("/uz/kalkulyator?motion=none");
    await page.waitForLoadState("networkidle");
    await shot("calc-uz");
  });
});
