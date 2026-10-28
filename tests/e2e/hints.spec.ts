import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Шаг 2.8: подсказки «?» к терминам калькулятора (ТЗ 4.4, мокап .hintbtn) — по нажатию под
// термином пояснение в 1–2 предложения; тексты — справочник hints (на стендах — черновики из
// кода, как в миграции). Редактор — «Настройки → Справочники → Подсказки «?»».

const STAND = "/dev/kalkulyator";
const BANK_EXAMPLE = /120 м² · 2 года/;

const hint = (page: Page, term: string) =>
  page.getByRole("button", { name: `Что значит «${term}»?` });

test.describe("подсказки «?»", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("«Первоначальный взнос»: нажатие раскрывает пояснение, повторное — прячет", async ({
    page,
  }) => {
    await page.goto(STAND);
    const button = hint(page, "Первоначальный взнос");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const text = page.getByText("Сумма, которую вы платите сразу при покупке.", { exact: false });
    await expect(text).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(text).toBeVisible();
    await button.click();
    await expect(text).toBeHidden();
  });

  test("итог: вид программы и строки банка — с «?»; клавиатурой тоже", async ({ page }) => {
    await page.goto(STAND);
    const total = page.getByTestId("calc-total");
    await expect(hint(page, "Рассрочка от застройщика")).toBeVisible();
    await page.getByRole("link", { name: BANK_EXAMPLE }).click();
    await expect(total.getByRole("button", { name: /Рассрочка через банк/ })).toBeVisible();
    for (const term of ["Проценты банка", "Оценка квартиры", "Комиссия банка", "Переплата"]) {
      await expect(total.getByRole("button", { name: `Что значит «${term}»?` })).toBeVisible();
    }
    const overpayment = total.getByRole("button", { name: "Что значит «Переплата»?" });
    await overpayment.focus();
    await page.keyboard.press("Enter");
    await expect(overpayment).toHaveAttribute("aria-expanded", "true");
    await expect(total.getByText(/сверх цены квартиры/)).toBeVisible();
  });

  test("по-узбекски: «?» и пояснение на узбекском", async ({ page }) => {
    await page.goto(`${STAND}/uz`);
    const button = page.getByRole("button", { name: "«Boshlang‘ich to‘lov» nima degani?" });
    await button.click();
    await expect(page.getByText(/Xarid paytida darhol to‘lanadigan summa/)).toBeVisible();
  });

  test("кабинет: те же подсказки в «Расчёте для клиента»", async ({ page }) => {
    await page.goto("/dev/programmy/raschet");
    await hint(page, "Первоначальный взнос").click();
    await expect(page.getByText(/Сумма, которую вы платите сразу/)).toBeVisible();
  });

  test("«Справочники»: набор подсказок из кода, правка проверяет оба языка", async ({ page }) => {
    await page.goto("/dev/spravochniki");
    const rows = page.getByTestId("hint-row");
    await expect(rows).toHaveCount(11);
    // «Переплата» — последняя в наборе; после «Изменить» её текст уходит в поля — ищем по месту.
    const row = rows.last();
    await row.getByRole("button", { name: "Изменить подсказку «Переплата»" }).click();
    const uz = row.getByLabel("Izoh");
    await uz.fill("");
    await row.getByRole("button", { name: "Сохранить" }).click();
    await expect(row.getByText("Нужен текст на узбекском")).toBeVisible();
    await uz.fill("Kvartira narxidan ortiq to‘laydiganingiz.");
    await row.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Подсказка сохранена — на сайте уже новый текст")).toBeVisible();
  });

  test("скриншоты s28: «?» у взноса раскрыт, строки итога банка, редактор", async ({
    page,
  }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.goto(STAND);
    await page.waitForLoadState("networkidle");
    await hint(page, "Первоначальный взнос").click();
    await page.locator(".calc-down").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/s28-hint-down.png`, caret: "initial" });
    await page.getByRole("link", { name: BANK_EXAMPLE }).click();
    const total = page.getByTestId("calc-total");
    await total.getByRole("button", { name: "Что значит «Переплата»?" }).click();
    await total.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/s28-hint-total.png`, caret: "initial" });
    await page.goto("/dev/spravochniki");
    await page.getByTestId("hint-row").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/s28-hints-editor.png`, caret: "initial" });
  });
});
