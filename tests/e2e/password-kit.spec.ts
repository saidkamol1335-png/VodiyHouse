import { expect, test, type Page } from "./fixtures";
import { DEMO_TEMPORARY_PASSWORD } from "../../app/dev/parol/demo";
import { hasCloud } from "./cloud";
import { collectPageErrors } from "./helpers";

// Первая смена пароля (шаг 8, решение С4) на стенде /dev/parol: настоящая форма и ядро,
// Supabase подменён. Настоящий поток против облака — auth.spec.ts.
const PAGE = "/dev/parol";

async function fillPasswords(page: Page, current: string, password: string, confirm: string) {
  await page.getByLabel("Временный пароль", { exact: true }).fill(current);
  await page.getByLabel("Новый пароль", { exact: true }).fill(password);
  await page.getByLabel("Повторите новый пароль", { exact: true }).fill(confirm);
  await page.getByRole("button", { name: "Сохранить и войти" }).click();
}

const fieldErrors = (page: Page) => page.locator(".password-change-form .field__error");

test.describe("первая смена пароля", () => {
  test("карточка входа: заголовок, подсказка правила, «Выйти»; консоль чистая", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(PAGE);
    await expect(page.getByRole("heading", { level: 1, name: "Задайте свой пароль" })).toBeVisible();
    await expect(page.getByText("Не короче 10 символов")).toBeVisible();
    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
    await expect(page.getByRole("link", { name: "На сайт" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("короткий, несовпадение, совпадает с временным, неверный временный — ошибки у полей", async ({ page }) => {
    await page.goto(PAGE);
    await fillPasswords(page, DEMO_TEMPORARY_PASSWORD, "короткий", "короткий");
    await expect(fieldErrors(page)).toHaveText(["Не короче 10 символов"]);
    await fillPasswords(page, DEMO_TEMPORARY_PASSWORD, "мой-новый-пароль", "мой-другой-пароль");
    await expect(fieldErrors(page)).toHaveText(["Пароли не совпадают"]);
    await fillPasswords(page, DEMO_TEMPORARY_PASSWORD, DEMO_TEMPORARY_PASSWORD, DEMO_TEMPORARY_PASSWORD);
    await expect(fieldErrors(page)).toHaveText(["Совпадает с временным — придумайте другой"]);
    await fillPasswords(page, "не-тот-пароль", "мой-новый-пароль", "мой-новый-пароль");
    await expect(fieldErrors(page)).toHaveText(["Временный пароль не подходит"]);
    await expect(page).toHaveURL(/\/dev\/parol$/);
  });

  test("у каждого поля — свой «глаз»", async ({ page }) => {
    await page.goto(PAGE);
    for (const label of ["Временный пароль", "Новый пароль", "Повторите новый пароль"]) {
      const input = page.getByLabel(label, { exact: true });
      const field = page.locator(".field").filter({ has: input });
      await expect(input).toHaveAttribute("type", "password");
      await field.getByRole("button", { name: "Показать пароль" }).click();
      await expect(input).toHaveAttribute("type", "text");
      await field.getByRole("button", { name: "Показать пароль", pressed: true }).click();
      await expect(input).toHaveAttribute("type", "password");
    }
  });

  test("успех — в кабинет; пароли не попадают в адрес", async ({ page }) => {
    await page.goto(PAGE);
    await fillPasswords(page, DEMO_TEMPORARY_PASSWORD, "мой-новый-пароль", "мой-новый-пароль");
    // С ключами у стенда нет сессии: кабинет отправит на вход.
    await expect(page).toHaveURL(hasCloud ? /\/admin\/vhod$/ : /\/admin$/);
    expect(decodeURIComponent(page.url())).not.toContain("пароль");
  });

  test("/admin/parol в режиме разработки без ключей — сразу в кабинет", async ({ page }) => {
    test.skip(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), "с ключами — настоящий поток (auth.spec.ts)");
    await page.goto("/admin/parol");
    await expect(page).toHaveURL(/\/admin$/);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`скриншоты · ${theme}`, async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      await page.goto(PAGE);
      await fillPasswords(page, DEMO_TEMPORARY_PASSWORD, "короткий", "короткий");
      await expect(fieldErrors(page)).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      const folder = `test-results/screens/${testInfo.project.name}`;
      await page.screenshot({ caret: "initial", path: `${folder}/password-change-${theme}.png`, fullPage: true });
    });
  }
});
