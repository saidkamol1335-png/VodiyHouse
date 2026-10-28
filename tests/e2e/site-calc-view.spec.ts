import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Шаг 2.6: публичная /kalkulyator — без базы страница с шапкой и «калькулятор заработает…»
// (какое из двух состояний проверено — видно в отчёте); на сайте нет ни слова о скидках ни в
// HTML, ни в JS (PLAN §3.13); с заявками (шаг 3.7) — «Получить точный расчёт» у итога. Стенд — раскладка
// 390, «К расчёту ↓» в полосе, луч итога в full, смена языка с расчётом; скриншоты s26.

const STAND = "/dev/kalkulyator";
const DISCOUNT = /скидк|chegirma|discount/i;
const SHOT_TIME = new Date("2026-10-24T09:46:00Z");

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
/** Пункты шапки — за кнопкой меню: телефон и планшет (761–1279 px, приёмка 3а — 768). */
const hasMenuButton = (page: Page) => (page.viewportSize()?.width ?? 0) < 1280;
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Дождаться конца появления и смены темы; бесконечные (луч итога в full) не ждём. */
const settle = (page: Page) =>
  page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getTiming().iterations === Infinity,
      ),
  );

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
    test(`/${locale}/kalkulyator: шапка, пункт меню, ни слова о скидках в HTML и JS`, async ({
      page,
      request,
    }, testInfo) => {
      const scripts: string[] = [];
      page.on("response", (response) => {
        if (response.url().includes("/_next/static/") && response.url().endsWith(".js")) {
          scripts.push(response.url());
        }
      });
      await page.goto(`/${locale}/kalkulyator`);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const empty = page.locator(".site-calculator__empty");
      if (await empty.isVisible()) {
        testInfo.annotations.push({
          type: "без базы",
          description: "site_calc_screen недоступна — проверены шапка, пустое состояние, HTML и JS",
        });
      } else {
        await expect(page.getByTestId("calc-total")).toBeVisible();
        await expect(
          page.getByRole("button", { name: /Получить точный расчёт|Aniq hisob-kitobni olish/ }),
        ).toHaveCount(1);
      }
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
    await page.goto("/ru/kalkulyator?developer=demo-sifat&down=50");
    await page.waitForLoadState("networkidle");
    if (isPhone(page)) await menu(page, "ru").click();
    await page
      .getByRole("link", { name: /^(UZ|O‘zbekcha)$/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/uz\/kalkulyator\?developer=demo-sifat&down=50$/);
  });

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

  test("стенд без курса: программ банков в сумах нет — строка «курс недоступен»; пример банка скрыт", async ({
    page,
  }, testInfo) => {
    await page.goto(`${STAND}?rate=none`);
    await page.waitForLoadState("networkidle");
    const programs = page.getByRole("group", { name: "Программа оплаты" });
    await expect(programs).toContainText(
      "Курс недоступен — часть программ банков сейчас не показывается",
    );
    await expect(programs.getByRole("radio", { name: /Ipoteka Bank/ })).toHaveCount(0);
    await expect(programs.getByRole("radio", { name: /Рассрочка от застройщика/ })).toBeChecked();
    await expect(page.getByRole("link", { name: /Ipoteka Bank/ })).toHaveCount(0);
    await expect(page.getByTestId("calc-total").locator(".calc-total__value")).toBeVisible();
    await page.clock.setFixedTime(SHOT_TIME);
    await programs.scrollIntoViewIfNeeded();
    await settle(page);
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.screenshot({ path: `${dir}/s29-no-rate.png`, caret: "initial" });
  });

  test("стенд без застройщиков с программами: «заработает…», пункта «Калькулятор» в меню нет", async ({
    page,
  }, testInfo) => {
    await page.goto(`${STAND}?developers=none`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".site-calculator__empty")).toContainText("Калькулятор заработает");
    await expect(page.getByRole("link", { name: /120 м²/ })).toHaveCount(0);
    if (hasMenuButton(page)) await menu(page, "ru").click();
    await expect(page.getByRole("link", { name: "Застройщикам" }).first()).toBeVisible();
    // На телефоне имя пункта — «04 Калькулятор»: ищем по вхождению.
    await expect(page.getByRole("link", { name: "Калькулятор" })).toHaveCount(0);
    await settle(page);
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.screenshot({ path: `${dir}/s29-no-programs.png`, caret: "initial" });
    if (hasMenuButton(page)) return;
    // Планшет (761–1279 px): выпадающее меню — тот же список без пункта.
    await page.setViewportSize({ width: 1100, height: 900 });
    await menu(page, "ru").click();
    const tablet = page.locator(".tablet-menu");
    await expect(tablet.getByRole("link", { name: "Застройщикам" })).toBeVisible();
    await expect(tablet.getByRole("link", { name: "Калькулятор" })).toHaveCount(0);
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
    await settle(page);
    await page.screenshot({ path: `${dir}/s26-bank.png`, caret: "initial" });
    await page.getByRole("button", { name: "Получить точный расчёт" }).click();
    await expect(page.getByRole("dialog", { name: "Точный расчёт" })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${dir}/s26-lead.png`, caret: "initial" });
    await page.keyboard.press("Escape");
    await page.goto(`${STAND}/uz`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${dir}/s26-calc-uz.png`, caret: "initial" });
    await page.evaluate(() => {
      localStorage.setItem("vh-theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });
    // Кнопки и сегменты меняют цвет плавно — снимок после перехода, а не посреди него.
    await settle(page);
    await page.screenshot({ path: `${dir}/s26-calc-dark.png`, caret: "initial" });
    await page.evaluate(() => localStorage.setItem("vh-theme", "light"));
    await page.goto("/ru/kalkulyator");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${dir}/s26-public.png`, caret: "initial" });
  });
});
