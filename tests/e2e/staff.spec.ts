import { expect, test, type Page } from "@playwright/test";
import { cabinetState, hasCloud, NO_CLOUD, signIn } from "./cloud";

// «Настройки → Сотрудники» против облака (шаг 8): руководитель — сохранённая сессия,
// сотрудник — свой контекст браузера. Только 1440: каждый сценарий входит заново.
test.skip(!hasCloud, NO_CLOUD);
test.use({ storageState: cabinetState("head"), permissions: ["clipboard-read", "clipboard-write"] });
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop-1440", "входы — только на 1440"));

const row = (page: Page, text: string) => page.locator(".staff-list__row").filter({ hasText: text });

/** Создаёт сотрудника через форму и возвращает показанный один раз пароль. */
async function createStaff(page: Page, fullName: string, email: string): Promise<string> {
  await page.goto("/admin/nastroyki");
  await page.getByRole("button", { name: "Добавить сотрудника" }).click();
  await page.getByLabel("Имя и фамилия").fill(fullName);
  await page.getByLabel("Email для входа").fill(email);
  await page.getByRole("button", { name: "Создать и показать пароль" }).click();
  const value = page.locator(".staff-password__value");
  await expect(value).toHaveText(/^\S{12}$/);
  return (await value.textContent()) ?? "";
}

const uniqueEmail = (label: string) => `e2e-${process.env.E2E_RUN_ID ?? "run"}-${label}@example.com`;

test("создание → пароль один раз → после «Готово» и перезагрузки его нет → новичок входит им", async ({ page, browser }) => {
  const email = uniqueEmail("created");
  const password = await createStaff(page, "E2E Созданный", email);
  await page.getByRole("button", { name: "Скопировать для Telegram" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`Временный пароль: ${password}`);
  await page.getByRole("button", { name: "Готово" }).click();
  await page.reload();
  expect(await page.content()).not.toContain(password);
  await expect(row(page, email)).toContainText("Ждёт первого входа");

  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await signIn(staffPage, email, password);
  await expect(staffPage).toHaveURL(/\/admin\/parol$/);
  await staff.close();
});

test("тот же email второй раз — ошибка у поля", async ({ page }) => {
  const email = uniqueEmail("twice");
  await createStaff(page, "E2E Дважды", email);
  await page.getByRole("button", { name: "Готово" }).click();
  await page.getByRole("button", { name: "Добавить сотрудника" }).click();
  await page.getByLabel("Имя и фамилия").fill("E2E Дважды");
  await page.getByLabel("Email для входа").fill(email);
  await page.getByRole("button", { name: "Создать и показать пароль" }).click();
  await expect(page.locator(".staff-create .field__error")).toHaveText(["Сотрудник с таким email уже есть"]);
});

test("отключение закрывает вход сразу; включение возвращает", async ({ page, browser }) => {
  const email = uniqueEmail("toggle");
  const password = await createStaff(page, "E2E Отключаемый", email);
  await page.getByRole("button", { name: "Готово" }).click();

  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await signIn(staffPage, email, password);

  await row(page, email).getByRole("button", { name: "Отключить" }).click();
  await row(page, email).getByRole("button", { name: "Да" }).click();
  await expect(row(page, email).getByRole("status")).toContainText("доступ отключён");

  await staffPage.goto("/admin/parol");
  await expect(staffPage).toHaveURL(/\/admin\/vhod/);
  await signIn(staffPage, email, password).catch(() => undefined);
  await expect(staffPage.locator(".login-form .form-status--error")).toHaveText("Неверный email или пароль");

  await page.reload();
  await row(page, email).getByRole("button", { name: "Включить" }).click();
  await expect(row(page, email).getByRole("status")).toContainText("доступ включён");
  await signIn(staffPage, email, password);
  await expect(staffPage).toHaveURL(/\/admin\/parol$/);
  await staff.close();
});

test("«Новый пароль»: старый не подходит, новый ведёт на смену пароля", async ({ page, browser }) => {
  const email = uniqueEmail("reset");
  const oldPassword = await createStaff(page, "E2E Сброс", email);
  await page.getByRole("button", { name: "Готово" }).click();
  await row(page, email).getByRole("button", { name: "Новый пароль" }).click();
  await row(page, email).getByRole("button", { name: "Да" }).click();
  const value = row(page, email).locator(".staff-password__value");
  await expect(value).toHaveText(/^\S{12}$/);
  const newPassword = (await value.textContent()) ?? "";

  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await signIn(staffPage, email, oldPassword).catch(() => undefined);
  await expect(staffPage.locator(".login-form .form-status--error")).toHaveText("Неверный email или пароль");
  await signIn(staffPage, email, newPassword);
  await expect(staffPage).toHaveURL(/\/admin\/parol$/);
  await staff.close();
});

test("своя строка — «Это вы», без действий", async ({ page }) => {
  await page.goto("/admin/nastroyki");
  const self = page.locator(".staff-list__row").filter({ hasText: "Это вы" });
  await expect(self).toHaveCount(1);
  await expect(self.getByRole("button")).toHaveCount(0);
});
