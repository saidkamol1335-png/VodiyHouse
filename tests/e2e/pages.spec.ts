import { expect, test } from "./fixtures";
import { hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// Шаг 3.11: «Застройщикам» (форма застройщика, «Выбрать» формат), «О нас» (встреча в офисе),
// «Как купить» и /privacy. Заявки e2e — имя «E2E …», их удаляет global-teardown. Свой адрес
// посетителя — лимит заявок с адреса не задевает соседние файлы.
// Скриншоты — test-results/screens/<проект>/s311-*.png.

test.use({ extraHTTPHeaders: { "x-nf-client-connection-ip": `e2e-${crypto.randomUUID()}` } });

const shot = (name: string) => `test-results/screens/${test.info().project.name}/s311-${name}.png`;

test.describe("страницы 3.11", () => {
  test.skip(!hasCloud, NO_CLOUD);

  test("«Застройщикам»: «Выбрать» ставит формат; без компании — ошибка и фокус; заявка отправлена", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/dlya-zastroyshchikov");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Продавайте квартиры");
    await page.screenshot({ path: shot("partners"), fullPage: true, caret: "initial" });
    await page.getByRole("link", { name: "Выбрать: Реклама на сайте" }).click();
    await expect(page.getByRole("radio", { name: "Реклама на сайте" })).toBeChecked();
    await expect(page.getByLabel("Компания-застройщик")).toBeFocused();
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(page.getByText("Укажите компанию")).toBeVisible();
    await expect(page.getByLabel("Компания-застройщик")).toBeFocused();
    await page.getByLabel("Компания-застройщик").fill("E2E Строй");
    await page.getByLabel("Контактное лицо").fill("E2E Застройщик");
    await page.getByLabel("Телефон").fill(`90${String(Date.now() % 10_000_000).padStart(7, "0")}`);
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    await expect(page.getByText(/Номер заявки #\d+/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Ответим в течение рабочего дня.", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("«О нас»: цифры из базы, «Записаться на встречу» — окно просмотра с офисом", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/o-nas");
    await expect(page.getByRole("heading", { level: 1, name: "О Vodiy House" })).toBeVisible();
    await expect(page.locator(".about-hero__stat").first()).toContainText("4");
    await page.screenshot({ path: shot("about"), fullPage: true, caret: "initial" });
    await page.getByRole("button", { name: "Записаться на встречу" }).click();
    const dialog = page.getByRole("dialog", { name: "Запись на просмотр" });
    await expect(dialog.getByRole("radio", { name: "Офис Vodiy House" })).toBeChecked();
    expect(errors).toEqual([]);
  });

  test("«Как купить» и /privacy: шаги и разделы; ссылка из подвала", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/kak-kupit");
    await expect(page.locator(".site-steps__item")).toHaveCount(5);
    await page.getByRole("contentinfo").getByRole("link", { name: "Политика конфиденциальности" }).click();
    await expect(page).toHaveURL(/\/ru\/privacy$/);
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(6);
    await page.screenshot({ path: shot("privacy"), fullPage: true, caret: "initial" });
    expect(errors).toEqual([]);
  });
});
