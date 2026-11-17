import { expect, test, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors, imageFile } from "./helpers";
import { site } from "./site";

// Реклама — баннер (правки 15.11, п. 4 + 13): руководитель создаёт рекламу, без картинки для ПК «На
// сайте» не включить; картинки — с отметкой правила 1.2 и в пропорции кадра; на сайте — баннер с меткой
// «Реклама» и «Оставить заявку» (заявка типа «Реклама») на главной и после 6-й карточки каталога.
// Запись в тестовом облаке общая — тест удаляет её в конце. Плюс выключатель «Скидки на сайте».

const LIST = "/vitrina/reklama";

const rowOf = (page: Page, title: string | RegExp) => page.getByRole("link", { name: typeof title === "string" ? `Открыть ${title}` : title });

/** Удалить рекламу из списка (и хвосты прошлых упавших прогонов). */
async function deleteAds(page: Page, title: string | RegExp) {
  await page.goto(LIST);
  while ((await rowOf(page, title).count()) > 0) {
    await rowOf(page, title).first().click();
    await page.locator(".showcase-form__delete").getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("button", { name: "Да, удалить" }).click();
    await expect(page).toHaveURL(/\/vitrina\/reklama$/, { timeout: 15_000 });
  }
}

test.describe("кабинет · реклама-баннер → сайт", () => {
  test.beforeEach(() => test.skip(!hasCloud, NO_CLOUD));
  test.use({ storageState: cabinetState("head") });

  test("баннер: без картинки — не на сайт; ПК и телефон с 1.2; главная и каталог; удалить", async ({ page }) => {
    test.setTimeout(150_000);
    const errors = collectPageErrors(page);
    const title = `e2e Баннер ${Date.now().toString(36)}`;
    await deleteAds(page, /^Открыть e2e Баннер /);

    await page.goto(`${LIST}/novoe`);
    await page.getByLabel("Застройщик").selectOption({ label: "Farg‘ona Sifat Qurilish" });
    await page.locator("#ad-title-ru").fill(title);
    await page.locator("#ad-title-uz").fill(`e2e Banner ${Date.now().toString(36)}`);
    await page.getByRole("switch", { name: "На сайте" }).click();
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page.getByText("Сначала загрузите картинку для ПК")).toBeVisible();
    await page.getByRole("switch", { name: "На сайте" }).click();
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page).toHaveURL(/\/vitrina\/reklama\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // Не та пропорция — отказ до загрузки; затем 3:1 для ПК и 4:5 для телефона, каждая с отметкой 1.2.
    const desktop = page.locator("#ad-banner");
    await expect(desktop).toBeDisabled();
    await page.locator("#ad-banner-rule12").check();
    await desktop.setInputFiles(await imageFile(page, { width: 2400, height: 1600, type: "image/jpeg" }));
    await expect(page.getByText(/Нужна пропорция 3:1/)).toBeVisible();
    await desktop.setInputFiles(await imageFile(page, { width: 2400, height: 800, type: "image/jpeg" }));
    await expect(page.locator("#ad-banner-rule12")).not.toBeChecked({ timeout: 20_000 });
    await page.locator("#ad-banner_mobile-rule12").check();
    await page.locator("#ad-banner_mobile").setInputFiles(await imageFile(page, { width: 1080, height: 1350, type: "image/jpeg" }));
    await expect(page.locator("#ad-banner_mobile-rule12")).not.toBeChecked({ timeout: 20_000 });

    await page.getByRole("switch", { name: "На сайте" }).click();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.locator(".showcase-form").getByText("Сохранено")).toBeVisible();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/pravki-1511-ad-form.png`, fullPage: true });

    // Главная: баннер с меткой и кнопкой заявки; застройщик — подписью, контактов застройщика нет.
    const banner = page.locator("#reklama .ad-banner").filter({ has: page.locator(`img[alt="${title}"]`) });
    await expect(async () => {
      await page.goto(site("/ru"));
      await expect(banner).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 40_000 });
    await expect(banner.locator(".ad-banner__tag")).toHaveText("Реклама");
    await expect(banner).toContainText("Farg‘ona Sifat Qurilish");
    await banner.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/pravki-1511-ad-home.png`, caret: "initial" });
    await banner.getByRole("button", { name: "Оставить заявку" }).click();
    const dialog = page.getByRole("dialog", { name: "Заявка по рекламе" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");

    // Каталог: баннер — сразу после 6-й карточки, во всю строку.
    await page.goto(site("/ru/novostroyki"));
    const slot = page.locator(".catalog-grid > .ad-banner").first();
    await expect(slot).toBeVisible();
    expect(await slot.evaluate((node) => [...node.parentElement!.children].indexOf(node))).toBe(6);
    await slot.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/pravki-1511-ad-catalog.png`, caret: "initial" });

    await deleteAds(page, title);
    await expect(rowOf(page, title)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("«Скидки на сайте»: по умолчанию выключено; включено — выгода за 100% в расчёте под планировкой (п. 21); вернуть", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/vitrina/spetspredlozheniya");
    const toggle = page.getByRole("switch", { name: "Показывать скидки на сайте" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    // Выключено: «100% оплата» DEMO-застройщика (12% в программе) — без выгоды.
    const calcOf = async () => {
      await page.goto(site("/ru/novostroyki/demo-shodlik#planirovki"));
      await page.waitForLoadState("networkidle");
      await page.locator(".complex-layout__calc").first().click();
      const calc = page.locator("dialog.flat-calc");
      await expect(calc).toHaveAttribute("open", "");
      return calc;
    };
    await expect(await calcOf()).not.toContainText("100% оплата · −12%");
    await page.goto("/vitrina/spetspredlozheniya");
    await toggle.click();
    await expect(page.getByTestId("action-toast")).toHaveText("Спецпредложения со скидкой снова на сайте");
    await expect(async () => {
      const calc = await calcOf();
      await expect(calc).toContainText("100% оплата · −12%", { timeout: 2_000 });
    }).toPass({ timeout: 40_000 });
    const calc = page.locator("dialog.flat-calc");
    await calc.getByText("100% оплата · −12%").first().click();
    await expect(calc).toContainText("Выгода при 100% оплате");
    await expect(calc).toContainText("Цена при 100% оплате");
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/pravki-1511-full-benefit.png`, caret: "initial" });
    await page.goto("/vitrina/spetspredlozheniya");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(page.getByTestId("action-toast")).toHaveText("Скидки скрыты — спецпредложений со скидкой на сайте больше нет");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});
