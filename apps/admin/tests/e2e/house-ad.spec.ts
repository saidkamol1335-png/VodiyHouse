import { expect, test } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// «Витрина → Реклама» (06.11.2026): выключатель своей рекламы Vodiy House. Запись в тестовом облаке
// общая — тест возвращает «показывать», как было.

test.describe("кабинет · своя реклама Vodiy House", () => {
  test.beforeEach(() => test.skip(!hasCloud, NO_CLOUD));
  test.use({ storageState: cabinetState("head") });

  test("выключить и включить: состояние переживает обновление страницы", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/vitrina/reklama");
    await expect(page.getByRole("heading", { name: "Своя реклама Vodiy House" })).toBeVisible();
    const toggle = page.getByRole("switch", { name: "Своя реклама Vodiy House на сайте" });
    if ((await toggle.getAttribute("aria-checked")) === "false") {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
    }
    await toggle.click();
    await expect(page.getByTestId("action-toast")).toHaveText(
      "Своя реклама выключена — на сайте её больше нет",
    );
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("house-ad-now")).not.toContainText("на главной своя реклама");
    await page.screenshot({
      path: `test-results/screens/${test.info().project.name}/s41-house-ad.png`,
      fullPage: true,
    });
    await toggle.click();
    await expect(page.getByTestId("action-toast")).toHaveText(
      "Своя реклама снова показывается на сайте",
    );
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(errors).toEqual([]);
  });
});
