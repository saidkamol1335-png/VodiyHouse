import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 2.6: публичная /kalkulyator — без облака страница с шапкой и «калькулятор заработает…»;
// на сайте нет ни слова о скидках ни в HTML, ни в JS (PLAN §3.13). Стенд — раскладка 390,
// «К расчёту ↓» в полосе, луч итога в full; скриншоты s26.

const STAND = "/dev/kalkulyator";
const DISCOUNT = /скидк|chegirma|discount/i;
const SHOT_TIME = new Date("2026-10-24T09:46:00Z");

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("сайт · страница калькулятора", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  for (const locale of ["ru", "uz"] as const) {
    test(`/${locale}/kalkulyator: шапка, пункт меню, ни слова о скидках в HTML и JS`, async ({
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
      if (isPhone(page)) {
        await page
          .getByRole("button", { name: locale === "ru" ? "Открыть меню" : "Menyuni ochish" })
          .click();
      }
      const nav = page.getByRole("link", { name: locale === "ru" ? "Калькулятор" : "Kalkulyator" });
      await expect(nav.first()).toHaveAttribute("aria-current", "page");
      expect(await page.content()).not.toMatch(DISCOUNT);
      for (const url of scripts)
        expect(await (await request.get(url)).text(), url).not.toMatch(DISCOUNT);
    });
  }

  test("стенд: без горизонтальной прокрутки; на телефоне «К расчёту ↓» ведёт к итогу", async ({
    page,
  }) => {
    await page.goto(`${STAND}?mode=sum&sum=100000&in=USD&down=50`);
    await page.waitForLoadState("networkidle");
    expect(await noHorizontalScroll(page)).toBe(0);
    const bar = page.locator(".calc-sticky-bar");
    if (!isPhone(page)) return expect(bar).toBeHidden();
    // Взнос 50 % — у схемы «до 18 мес.»: $50 000 / 18.
    await expect(bar).toContainText(/Платёж в месяц\s*\$2\s778/);
    await bar.getByRole("button", { name: "К расчёту" }).click();
    await expect(page.getByTestId("calc-total")).toBeInViewport();
    await expect(bar).toHaveAttribute("data-hidden", "");
  });

  test("луч итога — только в full; в lite его нет", async ({ page }) => {
    await page.goto(`${STAND}?motion=full`);
    await page.waitForLoadState("networkidle");
    const beam = page.getByTestId("calc-total").locator(".beam");
    await expect(beam).toHaveCSS("display", "block");
    await page.goto(`${STAND}?motion=lite`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("calc-total").locator(".beam")).toHaveCSS("display", "none");
  });

  test("скриншоты s26: стенд (ru, uz, тёмная), пример банка, окно заявки, публичная страница", async ({
    page,
  }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.clock.setFixedTime(SHOT_TIME);
    await page.goto(STAND);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/s26-calc.png`, fullPage: true, caret: "initial" });
    await page.getByRole("link", { name: /120 м² · 2 года/ }).click();
    // Переход по примеру — клиентский: networkidle наступает раньше, чем новый итог на экране.
    await expect(page.getByTestId("calc-total").locator(".calc-total__value")).toHaveText(
      /^39\s617\s000\sсум$/,
    );
    await page.getByTestId("calc-total").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${dir}/s26-bank.png`,
      caret: "initial",
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Получить точный расчёт" }).click();
    await expect(page.getByRole("dialog", { name: "Точный расчёт" })).toBeVisible();
    await page.waitForFunction(() =>
      // Бесконечные (луч итога в full) не ждём — только появление окна.
      document
        .getAnimations()
        .every(
          (animation) =>
            animation.playState !== "running" ||
            animation.effect?.getTiming().iterations === Infinity,
        ),
    );
    await page.screenshot({
      path: `${dir}/s26-lead.png`,
      caret: "initial",
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.goto(`${STAND}/uz`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${dir}/s26-calc-uz.png`, caret: "initial" });
    await page.evaluate(() => {
      localStorage.setItem("vh-theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });
    await page.screenshot({ path: `${dir}/s26-calc-dark.png`, caret: "initial" });
    await page.evaluate(() => localStorage.setItem("vh-theme", "light"));
    await page.goto("/ru/kalkulyator");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${dir}/s26-public-empty.png`, caret: "initial" });
  });
});
