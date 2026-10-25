import { expect, test, type Page } from "@playwright/test";
import { hasCloud } from "./cloud";
import { collectPageErrors } from "./helpers";

// Шаг 2.6: /kalkulyator на стенде /dev/kalkulyator (DEMO мокапа через тот же преобразователь
// ответа базы): шаги 01–04, примеры SiteCalc1 и SiteCalc2, без скидок (PLAN §3.13), окно
// «Получить точный расчёт» (заявка «Расчёт», шаг 3.7), текст для Telegram со ссылкой.

const STAND = "/dev/kalkulyator";
// Свой адрес посетителя: лимит «5 заявок с адреса за 10 минут» (ТЗ 10.2) — на тест, а не на прогон.
test.use({ extraHTTPHeaders: { "x-nf-client-connection-ip": `e2e-${crypto.randomUUID()}` } });
const total = (page: Page) => page.getByTestId("calc-total");
const head = (page: Page) => total(page).locator(".calc-total__value");
// Подпись — с начала строки: «Стоимость» не должна совпасть с «Итоговая стоимость».
const row = (page: Page, label: string) =>
  total(page)
    .locator(".calc-total__row")
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}`) }) })
    .locator("dd");
const amount = (text: string) => new RegExp(`^${text.replace(/\$/g, "\\$").replace(/ /g, "\\s")}$`);

async function open(page: Page, query = "", path = STAND) {
  await page.goto(`${path}${query}`);
  await expect(total(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("сайт · калькулятор", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("шаги 01–04 и пример SiteCalc1: 120 м² × $700, Ipoteka Bank 20 % · 24 мес.", async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator(".calc-step__title")).toHaveText([
      /01\s*Застройщик/,
      /02\s*Программа оплаты/,
      /03\s*Стоимость квартиры/,
      /04\s*Взнос и срок/,
    ]);
    await page.getByRole("link", { name: /120 м² · 2 года/ }).click();
    await expect(head(page)).toHaveText(amount("39 617 000 сум"));
    await expect(total(page)).toContainText(/≈ \$3\s355/);
    await expect(row(page, "Стоимость")).toHaveText(amount("991 936 000 сум"));
    await expect(row(page, "Проценты банка")).toHaveText(amount("157 264 000 сум"));
    await expect(row(page, "Переплата")).toHaveText(amount("166 700 000 сум"));
    await expect(row(page, "Итоговая стоимость")).toHaveText(amount("1 158 636 000 сум"));
    await total(page)
      .getByRole("group", { name: "Валюта итога" })
      .getByRole("button", { name: "$" })
      .click();
    await expect(head(page)).toHaveText(amount("$3 355"));
  });

  test("PLAN §7: $100 000, взнос 50 %, свой срок 17 → на сайте $2 941, без строк скидки", async ({
    page,
  }) => {
    await open(page, "?mode=sum&sum=100000&in=USD&down=50&months=17");
    await expect(head(page)).toHaveText(amount("$2 941"));
    await expect(row(page, "Первоначальный взнос · 50%")).toHaveText(amount("$50 000"));
    await expect(page.locator("main")).not.toContainText(/скидк/i);
    await expect(page.locator(".calc-down__chip-badge")).toHaveCount(0);
  });

  test("окно «Получить точный расчёт»: контекст расчёта, проверка полей, заявка «Расчёт» уходит", async ({
    page,
  }) => {
    await open(page);
    await total(page).getByRole("button", { name: "Получить точный расчёт" }).click();
    const dialog = page.getByRole("dialog", { name: "Точный расчёт" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".lead-dialog__context")).toContainText("Рассрочка от застройщика");
    await dialog.getByRole("button", { name: "Отправить" }).click();
    await expect(dialog.getByText("Укажите имя")).toBeVisible();
    await expect(dialog.getByText("Укажите номер телефона")).toBeVisible();
    // Фокус — на первое неверное поле: диктор читает его ошибку.
    await expect(dialog.getByLabel("Имя")).toBeFocused();
    await dialog.getByLabel("Имя").fill("E2E Расчёт");
    await dialog.getByLabel("Телефон").fill("90 12");
    await dialog.getByRole("button", { name: "Отправить" }).click();
    await expect(dialog.getByText("Номер в формате +998 XX XXX XX XX")).toBeVisible();
    await expect(dialog.getByLabel("Телефон")).toBeFocused();
    await dialog.getByLabel("Телефон").fill(`90${String(Date.now()).slice(-7)}`);
    await dialog.getByRole("button", { name: "Отправить" }).click();
    // С базой — «Заявка отправлена»; без неё сервер заявок не принимает и честно говорит об этом.
    await expect(dialog.getByText(hasCloud ? "Заявка отправлена" : "Заявки сейчас не принимаются", { exact: false })).toBeVisible({
      timeout: 15_000,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("Telegram: текст без скидок и со ссылкой на этот расчёт", async ({ page }) => {
    await page.addInitScript(() => {
      const copied: string[] = [];
      Object.defineProperty(window, "__copied", { value: copied });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (text: string) => void copied.push(text) },
      });
    });
    await open(page, "?mode=sum&sum=100000&in=USD&down=50&months=17");
    await total(page).getByRole("button", { name: "Скопировать для Telegram" }).click();
    await expect(total(page).getByText("Скопировано — вставьте в Telegram")).toBeVisible();
    const text = await page.evaluate(
      () => (window as unknown as { __copied: string[] }).__copied[0],
    );
    expect(text).toMatch(/Платёж в месяц: \$2\s941/);
    expect(text).toMatch(/Расчёт: http:\/\/localhost:\d+\/dev\/kalkulyator\?.*months=17/);
    expect(text).not.toMatch(/скидк/i);
  });

  test("ссылка в Telegram воспроизводит расчёт по умолчанию — с программой, площадью и сроком", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (text: string) => void localStorage.setItem("copied", text) },
      });
    });
    await open(page);
    const before = await head(page).textContent();
    await total(page).getByRole("button", { name: "Скопировать для Telegram" }).click();
    const text = await page.evaluate(() => localStorage.getItem("copied") ?? "");
    const link = /Расчёт: (\S+)/.exec(text)![1]!;
    expect(link).toMatch(
      /developer=demo-sifat.*program=.*mode=area.*area=60.*m2=\d+.*down=30.*months=36/,
    );
    await page.goto(link);
    await expect(head(page)).toHaveText(before!);
  });

  test("пример: отмечен, пока расчёт совпадает; повторный клик сбрасывает правки", async ({
    page,
  }) => {
    await open(page);
    const example = page.getByRole("link", { name: /120 м² · 2 года/ });
    await example.click();
    await expect(head(page)).toHaveText(amount("39 617 000 сум"));
    await expect(example).toHaveAttribute("aria-current", "true");
    await page
      .getByRole("region", { name: "Срок" })
      .getByRole("button", { name: /^12 мес\./ })
      .click();
    await expect(head(page)).not.toHaveText(amount("39 617 000 сум"));
    await expect(example).not.toHaveAttribute("aria-current", "true");
    await example.click();
    await expect(head(page)).toHaveText(amount("39 617 000 сум"));
    await expect(example).toHaveAttribute("aria-current", "true");
  });

  test("«Назад» после правки возвращает прошлый расчёт, «Вперёд» — поправленный", async ({
    page,
  }) => {
    await open(page);
    const before = await head(page).textContent();
    const example = page.getByRole("link", { name: /120 м² · 2 года/ });
    await example.click();
    await expect(head(page)).toHaveText(amount("39 617 000 сум"));
    await page
      .getByRole("region", { name: "Срок" })
      .getByRole("button", { name: /^12 мес\./ })
      .click();
    const edited = await head(page).textContent();
    expect(edited).not.toBe("39 617 000 сум");
    await page.goBack();
    await expect(head(page)).toHaveText(before!);
    await expect(example).not.toHaveAttribute("aria-current", "true");
    await page.goForward();
    await expect(head(page)).toHaveText(edited!);
  });

  test("по-узбекски: заголовок, шаги, so‘m и текст без русских слов", async ({ page }) => {
    await open(page, "", `${STAND}/uz`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Kalkulyator: muddatli to‘lov va ipoteka",
    );
    await expect(page.locator(".calc-step__title").first()).toHaveText(/01\s*Quruvchi/);
    await page.getByRole("link", { name: /120 m² · 2 yil/ }).click();
    await expect(head(page)).toHaveText(amount("39 617 000 so‘m"));
    await expect(page.locator(".payment-calculator")).not.toContainText(/[а-яё]/i);
  });
});
