import { expect, test } from "@playwright/test";
import { hasCloud } from "./cloud";
import { collectPageErrors } from "./helpers";

// Приёмка 3а — пункты чек-листа ТЗ 17.1, которых нет в других спеках: фильтры локации, оплаты и срока
// в адресе; навигатор страницы ЖК подсвечивает раздел и прокручивает без перезагрузки; подсказки «?»
// у документов и отделки открываются на телефоне. Каталог и ЖК — DEMO из облака.

test.describe("приёмка 3а · ТЗ 17.1", () => {
  test.skip(!hasCloud, "страницы читают DEMO из облака");

  test("фильтры: город, способ оплаты и срок сдачи — в адресе; по ссылке открываются выбранными", async ({ page, isMobile }) => {
    await page.goto("/ru/novostroyki");
    if (isMobile) await page.getByRole("button", { name: "Фильтры" }).click();
    const filter = page.getByRole(isMobile ? "dialog" : "complementary", { name: "Фильтры" });
    await filter.getByLabel("Город и район").selectOption("fergana");
    await expect(page).toHaveURL(/gorod=fergana/);
    await filter.getByRole("group", { name: "Способ оплаты" }).getByRole("button", { name: "Рассрочка" }).click();
    await expect(page).toHaveURL(/oplata=inst/);
    await filter.getByRole("button", { name: "Сдан", exact: true }).click();
    await expect(page).toHaveURL(/srok=built/);
    const address = page.url();
    await page.goto(address);
    if (isMobile) await page.getByRole("button", { name: /Фильтры/ }).click();
    await expect(filter.getByLabel("Город и район")).toHaveValue("fergana");
    await expect(filter.getByRole("group", { name: "Способ оплаты" }).getByRole("button", { name: "Рассрочка" })).toHaveAttribute("aria-pressed", "true");
    await expect(filter.getByRole("button", { name: "Сдан", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("навигатор ЖК: переход к разделу без перезагрузки, раздел подсвечен", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/novostroyki/demo-shodlik");
    await page.evaluate(() => Object.assign(window, { e2eSamePage: true }));
    const nav = page.getByRole("navigation", { name: "Разделы страницы" });
    await nav.getByRole("link", { name: "Документы" }).click();
    await expect(page.locator("#dokumenty")).toBeInViewport();
    await expect(nav.getByRole("link", { name: "Документы" })).toHaveAttribute("aria-current", "true");
    expect(await page.evaluate(() => (window as unknown as { e2eSamePage?: boolean }).e2eSamePage)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("подсказки «?» у документов и отделки открываются нажатием (телефон)", async ({ page }) => {
    await page.goto("/ru/novostroyki/demo-shodlik");
    for (const section of ["#dokumenty", "#o-zhk"]) {
      const hint = page.locator(`${section} .term-hint`).first();
      if ((await hint.count()) === 0) continue;
      await hint.scrollIntoViewIfNeeded();
      await hint.click();
      await expect(hint).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(`#${await hint.getAttribute("aria-controls")}`)).toBeVisible();
    }
    await expect(page.locator("#dokumenty .term-hint")).not.toHaveCount(0);
  });
});
