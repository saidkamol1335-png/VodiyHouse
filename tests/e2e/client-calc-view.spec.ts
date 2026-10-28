import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Шаг 2.5: вкладки раздела, менеджер, раскладка 390 и липкая полоса (В7 B), скриншоты s25 для
// сверки с мокапами r1 (1440) и MobFlat* (390).

const HEAD = "/dev/programmy";
const MANAGER = "/dev/menedzher/programmy";
const UNIT_88 = "00000000-0000-4000-8000-0000000e2005";
const SHOT_TIME = new Date("2026-10-24T09:46:00Z");

const total = (page: Page) => page.getByTestId("calc-total");
const tabs = (page: Page) => page.getByRole("navigation", { name: "Разделы программ оплаты" });
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(total(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("кабинет · расчёт для клиента: раскладка и вкладки", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("вкладки «Программы · Расчёт для клиента» — отдельные адреса; менеджер тоже считает", async ({
    page,
  }) => {
    await page.goto(HEAD);
    await page.waitForLoadState("networkidle");
    await tabs(page).getByRole("link", { name: "Расчёт для клиента" }).click();
    await expect(page).toHaveURL(`${HEAD}/raschet`);
    await expect(tabs(page).getByRole("link", { name: "Расчёт для клиента" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await open(page, `${MANAGER}/raschet?unit=${UNIT_88}&down=50`);
    await expect(total(page).locator(".calc-total__value")).toHaveText(/^\$1\s511$/);
    await expect(page.getByRole("switch")).toHaveCount(0);
  });

  test("раскладка без горизонтальной прокрутки; на телефоне — полоса «Платёж в месяц»", async ({
    page,
  }) => {
    await open(page, `${HEAD}/raschet?unit=${UNIT_88}&down=50`);
    expect(await noHorizontalScroll(page)).toBe(0);
    const bar = page.locator(".calc-sticky-bar");
    if (!isPhone(page)) {
      await expect(bar).toBeHidden();
      return;
    }
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(/Платёж в месяц\s*\$1\s511/);
    await total(page).scrollIntoViewIfNeeded();
    await expect(bar).toHaveAttribute("data-hidden", "");
  });

  test("скриншоты s25: расчёт кв. 88, банк в сумах, сравнение, тёмная тема", async ({
    page,
  }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.clock.setFixedTime(SHOT_TIME);
    await open(page, `${HEAD}/raschet?unit=${UNIT_88}&down=50`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/s25-calc.png`, fullPage: true, caret: "initial" });
    await total(page).scrollIntoViewIfNeeded();
    if (isPhone(page)) {
      await expect(page.locator(".calc-sticky-bar")).toHaveAttribute("data-hidden", "");
    }
    // Полоса уезжает за 200 мс — снимаем, когда переход закончен (animations: disabled).
    await page.screenshot({
      path: `${dir}/s25-total.png`,
      caret: "initial",
      animations: "disabled",
    });
    await page.locator(".calc-programs__card").filter({ hasText: "Рассрочка через банк" }).click();
    await page.getByRole("button", { name: "Показать график платежей" }).click();
    await page.locator(".calc-schedule").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/s25-bank-schedule.png`, caret: "initial" });
    await page.locator(".calc-compare").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/s25-compare.png`, caret: "initial" });
    await page.evaluate(() => {
      localStorage.setItem("vh-theme", "dark");
      document.documentElement.dataset.theme = "dark";
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: `${dir}/s25-calc-dark.png`, caret: "initial" });
  });
});
