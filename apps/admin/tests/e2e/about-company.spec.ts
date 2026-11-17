import { expect, test } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";
import { site } from "./site";

// «Настройки → О компании» (правки 15.11, п. 25): руководитель ведёт «История» и «Команда» страницы «О
// нас» сайта; сотрудник без отметки согласия не сохраняется. Записи в тестовом облаке общие — тест в
// конце очищает оба списка: без данных разделов на сайте нет.

const EVENT = "Открыли офис (e2e)";
const PERSON = "Азиз Каримов e2e";

test.describe("кабинет · «О компании» → сайт /o-nas", () => {
  test.beforeEach(() => test.skip(!hasCloud, NO_CLOUD));
  test.use({ storageState: cabinetState("head") });

  test("история и команда: согласие обязательно; на сайте — разделы, пусто — разделов нет", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/nastroyki/o-kompanii");
    const history = page.locator("form.complex-tab").filter({ has: page.getByRole("button", { name: "+ Добавить событие" }) });
    const team = page.locator("form.complex-tab").filter({ has: page.getByRole("button", { name: "+ Добавить сотрудника" }) });
    for (let left = await history.getByRole("button", { name: "Убрать событие" }).count(); left > 0; left -= 1) await history.getByRole("button", { name: "Убрать событие" }).first().click();
    for (let left = await team.getByRole("button", { name: "Убрать сотрудника" }).count(); left > 0; left -= 1) await team.getByRole("button", { name: "Убрать сотрудника" }).first().click();

    await history.getByRole("button", { name: "+ Добавить событие" }).click();
    const event = history.getByRole("group", { name: "Событие 1" });
    await event.getByLabel("Год").fill("2019");
    await event.getByLabel("Что случилось · RU").fill(EVENT);
    await event.getByLabel("Nima bo‘ldi · UZ").fill("Ofis ochdik (e2e)");
    await history.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(history.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();

    await team.getByRole("button", { name: "+ Добавить сотрудника" }).click();
    const person = team.getByRole("group", { name: "Сотрудник 1" });
    await person.getByLabel("Имя и фамилия").fill(PERSON);
    await person.getByLabel("Должность · RU").fill("Менеджер по продажам");
    await person.getByLabel("Lavozimi · UZ").fill("Sotuv menejeri");
    await team.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(person).toContainText("Без согласия сотрудника на сайт нельзя");
    await person.getByRole("checkbox", { name: /письменное согласие/ }).check();
    await team.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(team.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();

    await expect(async () => {
      await page.goto(site("/ru/o-nas"));
      await expect(page.locator(".about-history")).toContainText(EVENT, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.locator(".about-history")).toContainText("2019");
    await expect(page.locator(".about-team")).toContainText(PERSON);
    await expect(page.locator(".about-team")).toContainText("Менеджер по продажам");
    await expect(page.locator(".about-office")).toBeVisible();
    await page.locator(".about-history").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/pravki-1511-about.png` });

    await page.goto("/nastroyki/o-kompanii");
    await history.getByRole("button", { name: "Убрать событие" }).first().click();
    await history.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(history.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();
    await team.getByRole("button", { name: "Убрать сотрудника" }).first().click();
    await team.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(team.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();
    await expect(async () => {
      await page.goto(site("/ru/o-nas"));
      await expect(page.locator(".about-history, .about-team")).toHaveCount(0, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });
});
