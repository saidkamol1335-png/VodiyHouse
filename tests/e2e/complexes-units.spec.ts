import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 12.3: вкладка «Квартиры» на стенде /dev/zhk (DEMO): у Namuna блок «1» без списка —
// генератор (Н6), у Shodlik блоки A и B со списком — свёрнутые стояки (Н5). Действия стенда
// разбирают вход как настоящие, но квартиры DEMO не меняют.

const complexUrl = (n: number) => `/dev/zhk/00000000-0000-4000-8000-0000000000c${n}`;
const SHODLIK = `${complexUrl(1)}/kvartiry`;
const NAMUNA = `${complexUrl(2)}/kvartiry`;

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const position = (page: Page, n: number) =>
  page.locator(".risers-editor__position").filter({ hasText: `Позиция ${n}` });

const formStatus = (page: Page, text: string | RegExp) =>
  page.locator(".form-status").filter({ hasText: text });

test.describe("кабинет · ЖК · квартиры", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("генератор (Н6): живой итог, стояки под план, «Создать N квартир»", async ({ page }) => {
    await open(page, NAMUNA);
    const generator = page.locator(".units-generator");
    await expect(generator.getByRole("heading", { name: "Генератор списка" })).toBeVisible();
    await expect(generator.locator(".units-generator__total")).toContainText("120 квартир");
    await expect(generator.locator(".units-generator__total")).toContainText("№ 1–120");
    await expect(generator).toContainText("Без планировки: 120");
    await expect(generator).toContainText("ЖК на сайте");

    const layouts = [
      "Студия · 34,2 м²",
      "1-комн. · 48,6 м²",
      "1-комн. · 52,4 м²",
      "2-комн. · 71,3 м²",
    ];
    for (const [index, label] of layouts.entries()) {
      await position(page, index + 1)
        .getByLabel("Планировка")
        .selectOption({ label });
    }
    await expect(generator).not.toContainText("Без планировки");

    await page.getByLabel("Подъезды", { exact: true }).fill("3");
    await expect(generator.locator(".units-generator__total")).toContainText("180 квартир");
    await expect(generator).toContainText("Подъезд 3: № 121–180");

    await page.getByLabel("В подъездах по-разному").check();
    await page.getByLabel("Квартир на этаже · Подъезд 2", { exact: true }).fill("6");
    await expect(generator.locator(".units-generator__total")).toContainText("210 квартир");
    await expect(position(page, 6)).toBeVisible();
    // Новые позиции 5 и 6 — только во 2-м подъезде: 2 × 15 этажей без планировки.
    await expect(generator).toContainText("Без планировки: 30");
    // Выбранные планировки пережили смену плана.
    for (const [index, label] of layouts.entries()) {
      await expect(
        position(page, index + 1)
          .getByLabel("Планировка")
          .locator("option:checked"),
      ).toHaveText(label);
    }

    await page.getByLabel("Первый номер").fill("0");
    await expect(generator).toContainText("Первый номер — от 1 до 99 999");
    await expect(page.getByRole("button", { name: "Создать квартиры" })).toBeDisabled();
    await expect(position(page, 1)).toHaveCount(0);

    await page.getByLabel("Первый номер").fill("1");
    await page.getByRole("button", { name: "Создать 210 квартир" }).click();
    await expect(formStatus(page, "Создано: 210 квартир")).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("генератор: подъезд вне пределов и больше 5000 квартир — отказ на месте", async ({
    page,
  }) => {
    await open(page, NAMUNA);
    await page.getByLabel("Подъезды", { exact: true }).fill("");
    await expect(page.locator(".units-generator")).toContainText("Подъездов — от 1 до 50");
    await expect(page.locator(".units-generator")).not.toContainText(
      "Укажите квартиры на этаже для каждого подъезда",
    );
    await page.getByLabel("Подъезды", { exact: true }).fill("50");
    await page.getByLabel("Квартир на этаже", { exact: true }).fill("10");
    await expect(page.locator(".units-generator__total--error")).toContainText(
      /7.500 квартир — в блоке не больше 5.000/,
    );
    await expect(page.getByRole("button", { name: "Создать квартиры" })).toBeDisabled();
  });

  test("стояки (Н5): свёрнуты над списком; правка, «Отменить правки», сохранение", async ({
    page,
  }) => {
    await open(page, SHODLIK);
    await expect(page.locator(".units-block__listed")).toContainText(
      "Блок A · список из 88 квартир",
    );
    const toggle = page.getByRole("button", { name: "Стояки · 4 строки" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(position(page, 1)).toBeHidden();
    await toggle.click();
    const save = page.getByRole("button", { name: "Сохранить стояки" });
    await expect(save).toBeDisabled();

    await position(page, 2).getByRole("button", { name: "+ Разделить по этажам" }).click();
    await expect(page.getByRole("button", { name: "Стояки · 5 строк" })).toBeVisible();
    await position(page, 2).getByLabel("Этаж до").first().fill("12");
    await expect(position(page, 2).locator(".risers-editor__issue")).toHaveCount(2);
    await expect(position(page, 2).getByLabel("Этаж от").first()).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(position(page, 2).locator(".risers-editor__issue").first()).toContainText(
      "Пересекается",
    );
    await expect(save).toBeDisabled();
    await page.getByRole("button", { name: "Отменить правки" }).click();
    await expect(page.getByRole("button", { name: "Стояки · 4 строки" })).toBeVisible();

    await position(page, 1).getByLabel("Планировка").selectOption({ label: "2-комн. · 67,1 м²" });
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "Журнал" }).click();
    await expect(page).toHaveURL(/\/kvartiry$/);
    await save.click();
    await expect(formStatus(page, "Планировка поменялась у 22 квартир")).toBeVisible();
    await expect(save).toBeDisabled();
  });

  test("переключатель блоков — ссылки ?blok=, стояки уточняются для подъезда", async ({ page }) => {
    await open(page, SHODLIK);
    const switcher = page.getByRole("navigation", { name: "Блок" });
    await expect(switcher.getByRole("link", { name: /Блок A/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await switcher.getByRole("link", { name: /Блок B/ }).click();
    await expect(page).toHaveURL(/\?blok=/);
    await expect(page.locator(".units-block__listed")).toContainText("Блок B");
    await expect(switcher.getByRole("link", { name: /Блок B/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.getByRole("button", { name: /Стояки ·/ }).click();
    await position(page, 3).getByRole("button", { name: "+ Уточнить для подъезда" }).click();
    const refine = position(page, 3).locator(".risers-editor__row--refine");
    await refine.getByLabel(/^Подъезд/).selectOption({ label: "Подъезд 2" });
    await refine.getByLabel("Планировка").selectOption({ label: "3-комн. · 84,3 м²" });
    await page.getByRole("button", { name: "Сохранить стояки" }).click();
    // Позиция 3 подъезда 2 на эт. 2–12 — 11 квартир.
    await expect(formStatus(page, "Планировка поменялась у 11 квартир")).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("генератор: этаж набирается с клавиатуры, первый жилой ниже — стояки тянутся вниз", async ({
    page,
  }) => {
    await open(page, NAMUNA);
    const to = position(page, 1).getByLabel("Этаж до");
    await to.fill("");
    await to.pressSequentially("12");
    await expect(to).toHaveValue("12");
    await expect(position(page, 1).locator(".risers-editor__issue")).toHaveCount(0);
    await to.fill("16");

    await page.getByLabel("Первый жилой этаж").fill("1");
    await expect(position(page, 1).getByLabel("Этаж от")).toHaveValue("1");
    await expect(page.locator(".units-generator__total")).toContainText("128 квартир");
    await page.getByLabel("Первый жилой этаж").fill("10");
    await expect(position(page, 1).getByLabel("Этаж от")).toHaveValue("10");
  });

  test("генератор: «Уточнить» — следующий подъезд; один подъезд — общее поле", async ({ page }) => {
    await open(page, NAMUNA);
    const refine = position(page, 1).getByRole("button", { name: "+ Уточнить для подъезда" });
    await refine.click();
    await refine.click();
    const scopes = position(page, 1)
      .locator(".risers-editor__row--refine")
      .getByLabel(/^Подъезд/);
    await expect(scopes.nth(0)).toHaveValue("1");
    await expect(scopes.nth(1)).toHaveValue("2");
    await expect(refine).toHaveCount(0);
    await expect(position(page, 1).locator(".risers-editor__issue")).toHaveCount(0);

    await page.getByLabel("В подъездах по-разному").check();
    await page.getByLabel("Подъезды", { exact: true }).fill("1");
    await page.getByLabel("Квартир на этаже", { exact: true }).fill("3");
    await expect(page.locator(".units-generator__total")).toContainText("45 квартир");
  });

  test("стояки готового блока: убранная строка — «вне стояков», сохранение их не тронет", async ({
    page,
  }) => {
    await open(page, SHODLIK);
    await page.getByRole("button", { name: /Стояки ·/ }).click();
    await position(page, 2).getByRole("button", { name: "+ Разделить по этажам" }).click();
    await position(page, 2)
      .getByRole("button", { name: /^Убрать строку/ })
      .first()
      .click();
    // Позиция 2, эт. 2–11 в двух подъездах.
    await expect(page.locator(".units-risers__warning")).toContainText("Вне стояков: 20 мест");
  });

  test("скриншоты: генератор и стояки", async ({ page }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await open(page, NAMUNA);
    if (testInfo.project.name.startsWith("mobile")) {
      // «Создать N квартир» прилипает к низу экрана, пока генератор на экране (над ним с 12.6 —
      // «Наличие по планировкам»).
      await page.getByRole("heading", { name: "Генератор списка" }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "Создать 120 квартир" })).toBeInViewport();
    }
    await position(page, 1).getByLabel("Планировка").selectOption({ label: "Студия · 34,2 м²" });
    await position(page, 1).getByRole("button", { name: "+ Уточнить для подъезда" }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/s12-generator.png`, fullPage: true });

    await open(page, SHODLIK);
    await page.getByRole("button", { name: /Стояки ·/ }).click();
    await position(page, 2).getByRole("button", { name: "+ Разделить по этажам" }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/s12-risers.png`, fullPage: true });
  });
});
