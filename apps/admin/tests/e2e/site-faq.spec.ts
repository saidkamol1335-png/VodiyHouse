import { expect, test } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";
import { site } from "./site";

// «Настройки → Частые вопросы» (правки 15.11, п. 7 + 23): менеджер ведёт общие вопросы Vodiy House —
// сайт показывает их на главной (после «Вы застройщик?») и на странице ЖК (перед формой). Запись в
// тестовом облаке общая — тест в конце очищает список: без вопросов блока на сайте нет.

const QUESTION = "Как Vodiy House зарабатывает? (e2e)";

test.describe("кабинет · общие частые вопросы → сайт", () => {
  test.beforeEach(() => test.skip(!hasCloud, NO_CLOUD));
  test.use({ storageState: cabinetState("manager") });

  test("менеджер добавляет вопрос — он на главной и на странице ЖК; пустой список — блока нет", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/nastroyki/voprosy");
    const form = page.locator("form.complex-tab");
    await expect(page.getByRole("heading", { name: "Частые вопросы о Vodiy House" })).toBeVisible();
    // Остатки прошлого прогона — убрать.
    for (let left = await form.getByRole("button", { name: "Убрать вопрос" }).count(); left > 0; left -= 1) {
      await form.getByRole("button", { name: "Убрать вопрос" }).first().click();
    }
    await form.getByRole("button", { name: "+ Добавить вопрос" }).click();
    const row = form.getByRole("group", { name: "Вопрос 1" });
    await row.getByLabel("Вопрос · RU").fill(QUESTION);
    await row.getByLabel("Ответ · RU").fill("Комиссию платит застройщик, для покупателя — бесплатно.");
    await row.getByLabel("Savol · UZ").fill("Vodiy House qanday daromad qiladi?");
    await row.getByLabel("Javob · UZ").fill("Komissiyani quruvchi to‘laydi, xaridor uchun bepul.");
    await form.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(form.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();

    await expect(async () => {
      await page.goto(site("/ru"));
      await expect(page.locator(".home-faq")).toContainText(QUESTION, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await page.locator(".home-faq").getByText(QUESTION).click();
    await expect(page.locator(".home-faq")).toContainText("Комиссию платит застройщик");
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.some((text) => text.includes('"FAQPage"') && text.includes(QUESTION))).toBe(true);
    await page.goto(site("/ru/novostroyki/demo-shodlik"));
    await expect(page.locator("#voprosy")).toContainText(QUESTION);

    await page.goto("/nastroyki/voprosy");
    await form.getByRole("button", { name: "Убрать вопрос" }).first().click();
    await form.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(form.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();
    await expect(async () => {
      await page.goto(site("/ru"));
      await expect(page.locator(".home-faq")).toHaveCount(0, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });
});
