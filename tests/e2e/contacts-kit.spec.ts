import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// «Настройки → Контакты» (Ф9) на стенде: пустая форма, как до ответа заказчика; действие — настоящие
// проверки без базы. Настоящая страница — под сессией руководителя в облаке.

const STAND = "/dev/kontakty";

test.describe("кабинет · контакты Vodiy House", () => {
  test("пустая форма сохраняется: без контактов кнопок на сайте нет", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(STAND);
    await expect(page.getByRole("heading", { name: "Контакты Vodiy House" })).toBeVisible();
    await page.getByRole("button", { name: "Сохранить контакты" }).click();
    await expect(page.getByRole("status")).toHaveText("Сохранено — на сайте уже новые контакты");
    expect(errors).toEqual([]);
  });

  test("неверные номер, бот и минуты — ошибки у полей, набранное на месте", async ({ page }) => {
    await page.goto(STAND);
    await page.getByLabel("Общий телефон").fill("+7 900 123 45 67");
    await page.getByLabel("Бот «Написать в Telegram»").fill("vodiyhouse");
    await page.getByLabel("«Перезвоним за N минут»").fill("0");
    await page.getByLabel("Часы работы · RU").fill("Пн–Сб");
    await page.getByRole("button", { name: "Сохранить контакты" }).click();
    await expect(page.getByText("Номер Узбекистана: +998 и 9 цифр")).toBeVisible();
    await expect(page.getByText("Имя бота: латиница, цифры и «_», кончается на bot")).toBeVisible();
    await expect(page.getByText("Целое число от 1 до 240")).toBeVisible();
    await expect(page.locator("#contacts-hours-error")).toHaveText("Нужен текст на узбекском");
    await expect(page.getByLabel("Общий телефон")).toHaveValue("+7 900 123 45 67");
    await expect(page.getByLabel("Общий телефон")).toHaveAttribute("aria-invalid", "true");
    await page.screenshot({ caret: "initial", path: `test-results/screens/${test.info().project.name}/s31-contacts-errors.png`, fullPage: true });
  });
});
