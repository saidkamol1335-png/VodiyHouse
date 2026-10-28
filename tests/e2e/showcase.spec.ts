import { expect, test, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// Шаг 3.16а: «Витрина» в кабинете против облака — руководитель создаёт подборку по фильтру, видит
// её в списке и удаляет; менеджеру раздел недоступен (PLAN п. 11). Без ключей — пропуск.

const LIST = "/admin/vitrina/podborki";

const rowOf = (page: Page, title: string) => page.locator(".showcase-list__row").filter({ hasText: title });

test.describe("кабинет · витрина · руководитель", () => {
  test.use({ storageState: cabinetState("head") });

  test("подборка по фильтру: создать → в списке «Выключено» → удалить", async ({ page }) => {
    test.skip(!hasCloud, NO_CLOUD);
    const errors = collectPageErrors(page);
    const title = `e2e Сданные ${Date.now().toString(36)}`;

    await page.goto(`${LIST}/novoe`);
    await page.locator("#collection-title-ru").fill(title);
    await page.locator("#collection-title-uz").fill(`e2e Topshirilgan ${Date.now().toString(36)}`);
    await page.getByLabel("Срок сдачи").selectOption("built");
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page).toHaveURL(/\/admin\/vitrina\/podborki\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByText(/\/novostroyki\?podborka=e2e-sdannye/)).toBeVisible();

    await page.goto(LIST);
    const row = rowOf(page, title);
    await expect(row).toBeVisible();
    await expect(row).toContainText("по фильтру");
    await expect(row).toContainText("Выключено");

    await row.click();
    await page.getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("button", { name: "Да, удалить" }).click();
    await expect(page).toHaveURL(/\/admin\/vitrina\/podborki$/, { timeout: 15_000 });
    await expect(rowOf(page, title)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe("кабинет · витрина · менеджер", () => {
  test.use({ storageState: cabinetState("manager") });

  test("раздел недоступен: «доступен руководителю», в меню пункта нет", async ({ page }) => {
    test.skip(!hasCloud, NO_CLOUD);
    await page.goto("/admin/vitrina");
    await expect(page.getByRole("heading", { name: "Раздел доступен руководителю" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Разделы кабинета" }).getByRole("link", { name: "Витрина" })).toHaveCount(0);
  });
});
