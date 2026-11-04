import { expect, test, type Page } from "./fixtures";
import { hasCloud } from "./cloud";
import { collectPageErrors } from "./helpers";

// Риелторский /kalkulyator (PLAN §10, п. 48, образец uysot.uz): вкладки «Ипотека · Рассрочка ·
// Сколько могу купить», условия вводит посетитель; итог сверен с uysot (04.11.2026), график с
// датами, параметры в адресе, заявка «Расчёт» со строками и текст для Telegram со ссылкой.

// Свой адрес посетителя: лимит «5 заявок с адреса за 10 минут» (ТЗ 10.2) — на тест, а не на прогон.
test.use({ extraHTTPHeaders: { "x-nf-client-connection-ip": `e2e-${crypto.randomUUID()}` } });

const NOW = new Date("2026-11-04T09:00:00Z");
const total = (page: Page) => page.getByTestId("calc-total");
const head = (page: Page) => total(page).locator(".calc-total__value");
// Подпись — с начала строки: «Стоимость» не должна совпасть с «Итоговая стоимость».
const row = (page: Page, label: string) =>
  total(page)
    .locator(".calc-total__row")
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}`) }) })
    .locator("dd");
const amount = (text: string) => new RegExp(`^${text.replace(/\$/g, "\\$").replace(/ /g, "\\s")}$`);
const tab = (page: Page, name: string) => page.getByRole("tab", { name });

async function open(page: Page, query = "", locale = "ru") {
  await page.clock.setFixedTime(NOW);
  await page.goto(`/${locale}/kalkulyator${query}`);
  await expect(total(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("сайт · риелторский калькулятор", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("ипотека как у uysot: 600 млн, взнос 100 млн, 20 лет, 17,5 % → 7 525 000 сум; график с датами", async ({
    page,
  }) => {
    await open(page, "?sum=600000000&first=100000000&years=20&rate=17.5");
    await expect(tab(page, "Ипотека")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".calc-step__title")).toHaveText([
      /01\s*Стоимость квартиры/,
      /02\s*Первоначальный взнос/,
      /03\s*Срок и ставка/,
    ]);
    await expect(head(page)).toHaveText(amount("7 525 000 сум"));
    await expect(row(page, "Сумма кредита")).toHaveText(amount("500 000 000 сум"));
    await expect(row(page, "Проценты банка")).toHaveText(amount("1 305 930 000 сум"));
    await expect(page.getByLabel("Взнос", { exact: true })).toHaveValue(/^100\s000\s000$/);
    await expect(page.locator(".realtor-calc").getByText("16,7% от стоимости")).toBeVisible();
    await page.getByRole("button", { name: "Показать график платежей" }).click();
    const first = page.locator(".calc-schedule__table tbody tr").first();
    await expect(first.locator("th")).toHaveText("1");
    await expect(first.locator(".calc-schedule__cell--date")).toHaveText("01.12.2026");
    await expect(page.getByRole("button", { name: "Показать все 240" })).toBeVisible();
  });

  test("ввод: сумма, кнопка взноса 30 %, срок и тип платежа — итог и адрес следуют", async ({ page }) => {
    await open(page);
    await expect(head(page)).toHaveText(amount("7 558 000 сум"));
    await page.getByLabel("Сумма", { exact: true }).fill("800000000");
    await page.getByRole("button", { name: "30 %" }).click();
    await expect(page.getByLabel("Взнос", { exact: true })).toHaveValue(/^240\s000\s000$/);
    await expect(page.getByRole("button", { name: "30 %" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "10 лет" }).click();
    await page.getByLabel("Ставка банка").fill("24");
    await expect(head(page)).toHaveText(amount("12 347 000 сум"));
    await page.getByRole("button", { name: /Дифференцированный/ }).click();
    await expect(total(page).locator(".calc-total__label")).toHaveText("Первый платёж");
    await expect(row(page, "Последний платёж")).toBeVisible();
    await expect(page).toHaveURL(/sum=800000000.*first=240000000.*years=10.*rate=24.*method=differentiated/);
    // Адрес воспроизводит расчёт: после «обновить» — тот же итог.
    const shown = await head(page).textContent();
    await page.reload();
    await expect(head(page)).toHaveText(shown!);
  });

  test("ставка пустая — подсказка вместо итога; площадь × цена м² считает стоимость", async ({ page }) => {
    await open(page);
    await page.getByLabel("Ставка банка").fill("");
    await expect(total(page).locator(".calc-total__problem")).toHaveText("Введите ставку банка — посчитаем платёж");
    await page.getByLabel("Ставка банка").fill("0");
    await expect(head(page)).toHaveText(amount("2 667 000 сум"));
    await page.getByRole("button", { name: "Площадь × цена м²" }).click();
    await page.getByLabel("Площадь").fill("64,2");
    await page.getByLabel("Цена за м²").fill("7700000");
    await expect(page.locator(".realtor-calc__summary")).toContainText(/494\s340\s000\sсум/);
    await expect(row(page, "Стоимость")).toHaveText(amount("494 340 000 сум"));
  });

  test("рассрочка: месяцы и наценка; без наценки строк «Наценка» и «Переплата» нет", async ({ page }) => {
    await open(page);
    await tab(page, "Рассрочка").click();
    await expect(page.locator(".calc-step__title").nth(2)).toHaveText(/03\s*Срок и наценка/);
    await page.getByRole("button", { name: "12 мес." }).click();
    await expect(head(page)).toHaveText(amount("40 000 000 сум"));
    await expect(row(page, "Наценка")).toHaveCount(0);
    await page.getByLabel("Наценка застройщика").fill("10");
    await expect(row(page, "Наценка")).toHaveText(amount("48 000 000 сум"));
    await expect(head(page)).toHaveText(amount("44 000 000 сум"));
    await expect(page).toHaveURL(/tab=installment.*months=12.*markup=10/);
  });

  test("сколько могу купить: платёж в месяц → цена квартиры; клавиши ← → по вкладкам", async ({ page }) => {
    await open(page);
    await tab(page, "Ипотека").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Сколько могу купить")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "Сколько могу купить")).toBeFocused();
    await expect(page.locator(".calc-step__title").first()).toHaveText(/01\s*Платёж в месяц/);
    await expect(total(page).locator(".calc-total__label")).toHaveText("Квартира по карману до");
    await expect(row(page, "Платёж в месяц")).toHaveText(amount("8 000 000 сум"));
    await page.getByLabel("Сколько готовы платить в месяц").fill("7524709");
    await page.getByLabel("Взнос", { exact: true }).fill("100000000");
    await page.getByRole("button", { name: "20 лет" }).click();
    // Обратный расчёт к uysot: платёж 7 524 709 сум на 20 лет под 17,5 % + взнос 100 млн ≈ 600 млн.
    await expect(head(page)).toHaveText(amount("600 000 000 сум"));
  });

  test("окно «Получить точный расчёт»: контекст расчёта, заявка «Расчёт» уходит", async ({ page }) => {
    await open(page);
    await total(page).getByRole("button", { name: "Получить точный расчёт" }).click();
    const dialog = page.getByRole("dialog", { name: "Точный расчёт" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".lead-dialog__context")).toContainText(/Ипотека · Аннуитетный · 7\s558\s000\sсум/);
    await dialog.getByLabel("Имя").fill("E2E Риелторский расчёт");
    await dialog.getByLabel("Телефон").fill(`90${String(Date.now()).slice(-7)}`);
    await dialog.getByRole("button", { name: "Отправить" }).click();
    // С базой — «Заявка отправлена»; без неё сервер заявок не принимает и честно говорит об этом.
    await expect(dialog.getByText(hasCloud ? "Заявка отправлена" : "Заявки сейчас не принимаются", { exact: false })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Telegram: строки итога, срок, платёж и ссылка, которая воспроизводит расчёт", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (text: string) => void localStorage.setItem("copied", text) },
      });
    });
    await open(page, "?tab=installment&months=36&markup=12");
    const before = await head(page).textContent();
    await total(page).getByRole("button", { name: "Скопировать для Telegram" }).click();
    await expect(total(page).getByText("Скопировано — вставьте в Telegram")).toBeVisible();
    const text = await page.evaluate(() => localStorage.getItem("copied") ?? "");
    expect(text.split("\n")[0]).toBe("Рассрочка");
    expect(text).toMatch(/Срок: 36 мес\./);
    expect(text).toMatch(/Наценка \(12% за срок · 36 мес\.\)/);
    expect(text).not.toMatch(/скидк/i);
    const link = /Расчёт: (\S+)/.exec(text)![1]!;
    expect(link).toMatch(/\/ru\/kalkulyator\?tab=installment&price=sum&sum=600000000.*months=36.*markup=12/);
    await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
    await expect(head(page)).toHaveText(before!);
  });

  test("/uz: вкладки и итог по-узбекски; старая ссылка ?developer= открывает калькулятор", async ({ page }) => {
    await open(page, "?developer=demo-sifat&program=x&down=50", "uz");
    await expect(page.getByRole("tab")).toHaveText(["Ipoteka", "Muddatli to‘lov", "Qancha narxli uy olaman"]);
    await expect(total(page).locator(".calc-total__label")).toHaveText("Oylik to‘lov");
    await expect(head(page)).toHaveText(amount("7 558 000 so‘m"));
  });
});
