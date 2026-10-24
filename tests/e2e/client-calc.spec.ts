import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 2.5: «Расчёт для клиента» на стенде /dev/programmy/raschet (DEMO мокапа: программы — как у
// «Программ оплаты», квартиры — числа мокапа r1 и MobFlat). Тот же экран, что /admin/programmy/raschet.

const STAND = "/dev/programmy/raschet";
const UNIT_88 = "00000000-0000-4000-8000-0000000e2005";

const total = (page: Page) => page.getByTestId("calc-total");
const head = (page: Page) => total(page).locator(".calc-total__value");
const row = (page: Page, label: string | RegExp) =>
  total(page).locator(".calc-total__row").filter({ hasText: label });
const money = (text: string) => new RegExp(`^${text.replace(/\$/g, "\\$").replace(/ /g, "\\s")}$`);

async function open(page: Page, query = "") {
  await page.goto(`${STAND}${query}`);
  await expect(total(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("кабинет · расчёт для клиента", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("мокап r1: кв. 88, взнос 50% → −6% — $1 511, скидка, сравнение; выбор живёт в адресе", async ({
    page,
  }) => {
    await open(page);
    await page.getByLabel(/Квартира · свободно: 6/).selectOption(UNIT_88);
    await page.getByRole("button", { name: /^50%\s*→ −6%/ }).click();
    await expect(head(page)).toHaveText(money("$1 511"));
    await expect(row(page, "Цена по прайсу").locator("dd")).toHaveText(money("$57 880"));
    await expect(row(page, "Скидка за взнос 50%").locator("dd")).toHaveText(/^−\$3\s473$/);
    await expect(row(page, "Цена со скидкой").locator("dd")).toHaveText(money("$54 407"));
    await expect(row(page, "Первоначальный взнос · 50%").locator("dd")).toHaveText(
      money("$27 204"),
    );
    await expect(total(page)).toContainText(/≈ 17\s847\s000 сум/);

    const compare = page.locator(".calc-compare__table");
    await expect(compare).toContainText("Все программы для этой квартиры");
    await expect(compare.locator("tr").filter({ hasText: "100% оплата" })).toContainText(
      /\$50\s934\s*выгоднее всего/,
    );
    await expect(compare.locator("tr").filter({ hasText: "Ипотека" })).toContainText(
      /\$456\/мес\s*меньше платёж/,
    );

    await expect(page).toHaveURL(new RegExp(`unit=${UNIT_88}.*down=50`));
    await page.reload();
    await expect(head(page)).toHaveText(money("$1 511"));
  });

  test("срок: 18 — «Свой» с подсказкой; 17 мес. — пересчёт; 24 при 50% — «можно максимум 18»", async ({
    page,
  }) => {
    await open(page, `?unit=${UNIT_88}&down=50`);
    await expect(
      page.getByText("Любое целое число месяцев: от 1 до 18 при взносе 50%"),
    ).toBeVisible();
    const months = page.getByLabel("Срок, мес.");
    await expect(months).toHaveValue("18");
    await page.getByRole("button", { name: "Меньше на месяц" }).click();
    await expect(months).toHaveValue("17");
    // $54 407,20 × 50% / 17 = $1 600,21
    await expect(head(page)).toHaveText(money("$1 600"));
    await months.fill("24");
    await expect(
      page.getByText("При взносе 50% можно максимум 18 мес. — считаем на 18 мес."),
    ).toBeVisible();
    await expect(head(page)).toHaveText(money("$1 511"));
  });

  test("PLAN §7: $100 000, взнос 50 %, свой срок 17 → в кабинете $2 765", async ({ page }) => {
    await open(page, "?mode=sum&sum=100000&in=USD&down=50&months=17");
    await expect(head(page)).toHaveText(money("$2 765"));
    await expect(row(page, "Цена со скидкой").locator("dd")).toHaveText(money("$94 000"));
  });

  test("100% оплата — «К оплате сразу», без взноса и срока; чип «100%» ведёт в неё", async ({
    page,
  }) => {
    await open(page, `?unit=${UNIT_88}`);
    await page.getByRole("button", { name: /^100%\s*→ −12%/ }).click();
    await expect(page.getByRole("radio", { name: /100% оплата/ })).toBeChecked();
    await expect(total(page).locator(".calc-total__label")).toHaveText("К оплате сразу");
    await expect(head(page)).toHaveText(money("$50 934"));
    await expect(page.getByLabel("Первоначальный взнос, %")).toHaveCount(0);
    await expect(page.locator(".calc-term")).toHaveCount(0);
  });

  test("банк в сумах: итог в сумах, $ | сум переключает, в сносках — курс ЦБ", async ({ page }) => {
    await open(page, `?unit=${UNIT_88}`);
    // Радио спрятано за карточкой — нажимают карточку, как человек.
    await page.locator(".calc-programs__card").filter({ hasText: "Рассрочка через банк" }).click();
    await expect(
      page.getByRole("radio", { name: /Ipoteka Bank.*Рассрочка через банк/ }),
    ).toBeChecked();
    await expect(head(page)).toHaveText(/сум$/);
    await expect(total(page)).toContainText("Курс ЦБ: 1 $ = 11 808,76 сум на 01.10.2026.");
    await total(page)
      .getByRole("group", { name: "Валюта итога" })
      .getByRole("button", { name: "$" })
      .click();
    await expect(head(page)).toHaveText(/^\$/);
    await expect(page).toHaveURL(/out=USD/);
  });

  test("площадь × цена м²: по умолчанию 60 м² × $690; 120 × 700 → стоимость $84 000", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("button", { name: "Площадь × цена м²" }).click();
    await expect(page.getByLabel("Площадь")).toHaveValue("60");
    await expect(page.getByLabel("Цена за м²")).toHaveValue("690");
    await page.getByLabel("Площадь").fill("120");
    await page.getByLabel("Цена за м²").fill("700");
    await expect(page.locator(".calc-price__total")).toHaveText(money("$84 000"));
  });

  test("застройщик — пилюлей: новый адрес и его квартиры", async ({ page }) => {
    await open(page);
    await page
      .getByRole("group", { name: "Застройщик" })
      .getByRole("button", { name: "Marg‘ilon Invest" })
      .click();
    await expect(page).toHaveURL(/developer=demo-margilan-invest/);
    await expect(page.getByLabel(/Квартира · свободно: 2/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /Ipak Yuli Bank.*Ипотека/ })).toBeVisible();
  });

  test("Telegram: текст на узбекском со скидкой, «Скопировано»", async ({ page }) => {
    await page.addInitScript(() => {
      const copied: string[] = [];
      Object.defineProperty(window, "__copied", { value: copied });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (text: string) => void copied.push(text) },
      });
    });
    await open(page, `?unit=${UNIT_88}&down=50`);
    await total(page)
      .getByRole("group", { name: "Язык сообщения" })
      .getByRole("button", { name: "UZ" })
      .click();
    await total(page).getByRole("button", { name: "Скопировать для Telegram" }).click();
    await expect(total(page).getByText("Скопировано — вставьте в Telegram")).toBeVisible();
    const text = await page.evaluate(
      () => (window as unknown as { __copied: string[] }).__copied[0],
    );
    expect(text).toContain("Quruvchidan muddatli to‘lov — Farg‘ona Sifat Qurilish");
    expect(text).toMatch(/50% boshlang‘ich to‘lov uchun chegirma \(6%\): −\$3\s473/);
    expect(text).toMatch(/Oylik to‘lov: \$1\s511/);
  });
});
