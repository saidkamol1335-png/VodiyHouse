import { expect, test, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// «Настройки → Фильтр сайта» (06.11.2026): кнопки фильтра каталога в архив и обратно. Запись в
// тестовом облаке общая — тест сам возвращает всё, что убрал. Сайт прячет кнопки по той же записи
// (юниты apps/site: archive.test.ts, CatalogFilter.test.tsx).

const PAGE = "/nastroyki/filtr";

const chip = (page: Page, label: string) =>
  page.getByRole("button", { name: new RegExp(`^${label}: (в архив|вернуть на сайт)$`) });

/** Кнопка на месте (не в архиве) — после прошлых прогонов, упавших посередине. */
async function ensureOnSite(page: Page, label: string) {
  const button = chip(page, label);
  if ((await button.getAttribute("aria-pressed")) === "true") {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
  }
}

test.describe("кабинет · фильтр сайта", () => {
  test.beforeEach(() => test.skip(!hasCloud, NO_CLOUD));

  test.describe("руководитель", () => {
    test.use({ storageState: cabinetState("head") });

    test("кнопка «Ипотека» — в архив и обратно; блок «Цена» — целиком", async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.goto(PAGE);
      await expect(page.getByRole("heading", { name: "Кнопки фильтра на сайте" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Фильтр сайта" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      const payment = page.getByRole("region", { name: "Способ оплаты" });
      await expect(payment.getByRole("button", { name: /: в архив$/ })).toHaveCount(4);
      await ensureOnSite(page, "Ипотека");

      await chip(page, "Ипотека").click();
      await expect(page.getByTestId("action-toast")).toHaveText(
        "«Ипотека» — в архиве, на сайте скрыто",
      );
      await expect(chip(page, "Ипотека")).toHaveAttribute("aria-pressed", "true");
      const archive = page
        .locator(".admin-panel")
        .filter({ has: page.getByRole("heading", { name: "Архив", exact: true }) });
      await expect(archive.getByText("Ипотека", { exact: true })).toBeVisible();

      await page
        .getByRole("region", { name: "Цена квартиры, $" })
        .getByRole("button", { name: "Скрыть блок" })
        .click();
      await expect(page.getByText("Блок в архиве — на сайте его нет")).toBeVisible();
      await expect(archive.getByText("весь блок", { exact: false })).toBeVisible();
      await page.screenshot({
        path: `test-results/screens/${test.info().project.name}/s40-filter-archive.png`,
        fullPage: true,
      });

      // Обновление страницы — архив из базы, не из памяти страницы.
      await page.reload();
      await expect(chip(page, "Ипотека")).toHaveAttribute("aria-pressed", "true");
      await archive
        .getByRole("listitem")
        .filter({ hasText: "весь блок" })
        .getByRole("button", { name: "Вернуть" })
        .click();
      await expect(page.getByTestId("action-toast")).toHaveText(
        "«Цена квартиры, $» — снова на сайте",
      );
      await chip(page, "Ипотека").click();
      await expect(page.getByTestId("action-toast")).toHaveText("«Ипотека» — снова на сайте");
      await expect(chip(page, "Ипотека")).toHaveAttribute("aria-pressed", "false");
      expect(errors).toEqual([]);
    });
  });

  test.describe("менеджер", () => {
    test.use({ storageState: cabinetState("manager") });

    // Права менеджера — миграция 20261106120000 (в тестовом облаке с 06.11). Тест руководителя идёт
    // параллельно и пишет ту же запись — заодно проверка записи с версией (updated_at).
    test("вкладка «Фильтр сайта»: «Студия» — в архив и обратно", async ({ page }) => {
      await page.goto("/nastroyki");
      await expect(page).toHaveURL(/\/nastroyki\/spravochniki$/);
      await page.getByRole("link", { name: "Фильтр сайта" }).click();
      await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
      await ensureOnSite(page, "Студия");
      await chip(page, "Студия").click();
      await expect(page.getByTestId("action-toast")).toHaveText("«Студия» — в архиве, на сайте скрыто");
      await page.reload();
      await expect(chip(page, "Студия")).toHaveAttribute("aria-pressed", "true");
      await chip(page, "Студия").click();
      await expect(page.getByTestId("action-toast")).toHaveText("«Студия» — снова на сайте");
      await expect(chip(page, "Студия")).toHaveAttribute("aria-pressed", "false");
    });
  });
});
