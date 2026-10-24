import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 2.4: менеджер читает «Программы оплаты» (PLAN §5) на /dev/menedzher/programmy; раскладка
// на 390 без горизонтальной прокрутки; скриншоты s24 для сверки с мокапом CabProg.

const HEAD = "/dev/programmy";
const MANAGER = "/dev/menedzher/programmy";
const SIFAT = "Farg‘ona Sifat Qurilish";
const SHOT_TIME = new Date("2026-10-24T09:46:00Z");

const panels = (page: Page) => page.getByTestId("program-panel");
const editor = (page: Page) => page.locator(".program-editor");
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(panels(page).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("кабинет · программы оплаты: просмотр и раскладка", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("менеджер: те же карточки и курс — без тумблеров, правки и кнопок курса", async ({
    page,
  }) => {
    await open(page, MANAGER);
    const nav = page.getByRole("navigation", { name: "Разделы кабинета" });
    await expect(nav.getByRole("link", { name: "Программы оплаты" })).toBeVisible();
    await expect(page.getByTestId("program-card")).toHaveCount(11);
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(page.getByTestId("program-card").first()).toContainText("На сайте");
    for (const name of [
      "Изменить",
      "Программа",
      "Зафиксировать курс",
      "Обновить курс ЦБ",
      "Условия проверены сегодня",
    ])
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
    await expect(page.getByTestId("program-rate")).toContainText("Курс ЦБ: 1 $ = 11");
  });

  test("раскладка: экран и открытая правка без горизонтальной прокрутки", async ({ page }) => {
    await open(page, HEAD);
    expect(await noHorizontalScroll(page)).toBe(0);
    const scheme = page.getByRole("region", { name: SIFAT }).getByTestId("program-card").nth(1);
    await scheme.getByRole("button", { name: "Изменить" }).click();
    await expect(editor(page)).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(0);
    const box = await editor(page).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test("скриншоты s24: экран, правка, новая программа, менеджер, тёмная тема", async ({
    page,
  }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.clock.setFixedTime(SHOT_TIME);
    await open(page, HEAD);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/s24-programs.png`, fullPage: true, caret: "initial" });

    const sifat = page.getByRole("region", { name: SIFAT });
    await sifat
      .getByTestId("program-card")
      .nth(1)
      .getByRole("button", { name: "Изменить" })
      .click();
    await editor(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/s24-editor.png`, caret: "initial" });
    await page.keyboard.press("Escape");

    await sifat.getByRole("button", { name: "Программа" }).click();
    await sifat
      .getByRole("group", { name: "Вид новой программы" })
      .getByRole("button", { name: "Рассрочка через банк" })
      .click();
    await editor(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/s24-new-bank.png`, caret: "initial" });

    await open(page, MANAGER);
    await page.screenshot({ path: `${dir}/s24-manager.png`, caret: "initial" });
    // Ключ — как у приложения (THEME_STORAGE_KEY), атрибут — чтобы не перезагружать страницу.
    await page.evaluate(() => {
      localStorage.setItem("vh-theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });
    await page.screenshot({ path: `${dir}/s24-manager-dark.png`, caret: "initial" });
  });
});
