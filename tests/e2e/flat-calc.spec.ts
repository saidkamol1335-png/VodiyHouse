import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Шаг 2.7: «Расчёт для этой квартиры» на стенде /dev/raschet-kvartiry (DEMO мокапа через тот же
// преобразователь, что ответ site_layout_calc()): на 1440 — панель под карточками (SiteJkCalc1),
// на телефоне — шторка (MobFlat, MobFlatTerm); без скидок (PLAN §3.13).

const STAND = "/dev/raschet-kvartiry";
const LAYOUT_64 = "00000000-0000-4000-8000-0000000e1001";
const LAYOUT_78 = "00000000-0000-4000-8000-0000000e1002";
const UNIT_43 = "00000000-0000-4000-8000-0000000e2002";
const UNIT_88 = "00000000-0000-4000-8000-0000000e2005";
const SCHEME = "00000000-0000-4000-8000-000000000102";
const IPOTEKA = "00000000-0000-4000-8000-000000000103";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const flat = (page: Page) => page.locator("dialog.flat-calc");
const head = (page: Page) => flat(page).locator(".calc-total__value");
const amount = (text: string) => new RegExp(`^${text.replace(/\$/g, "\\$").replace(/ /g, "\\s")}$`);

async function open(page: Page, query: string) {
  await page.goto(`${STAND}?${query}`);
  await expect(flat(page)).toHaveAttribute("open", "");
  await page.waitForLoadState("networkidle");
}

test.describe("сайт · расчёт для этой квартиры", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("«Рассчитать оплату» открывает расчёт планировки; × закрывает и возвращает фокус", async ({
    page,
  }) => {
    await page.goto(STAND);
    await page.waitForLoadState("networkidle");
    const opener = page.getByRole("button", { name: "Рассчитать оплату" }).nth(1);
    await opener.click();
    await expect(page).toHaveURL(new RegExp(`plan=${LAYOUT_78}`));
    const dialog = page.getByRole("dialog", { name: "3-комн. · 78 м²" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "3-комн. · 78 м²" })).toBeFocused();
    // Шире телефона — панель на месте страницы, на телефоне — модальная шторка.
    expect(await flat(page).evaluate((element) => element.matches(":modal"))).toBe(isPhone(page));
    await expect(dialog.locator(".flat-calc__price")).toContainText(/\$54\s930/);
    await expect(dialog.locator(".flat-calc__price")).toContainText(
      /Кв\. 8 · 3 эт\. · \$704\/м² · ≈ 648\s655\s000 сум/,
    );
    await dialog.getByRole("button", { name: "Закрыть расчёт" }).click();
    await expect(flat(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/plan=/);
    await expect(opener).toBeFocused();
  });

  test("SiteJkCalc1: Ipoteka Bank 20 % · 24 мес. → 25 907 000 сум, итог 758 184 000 сум", async ({
    page,
  }) => {
    await open(page, `plan=${LAYOUT_78}&program=${IPOTEKA}&down=20&months=24`);
    await expect(head(page)).toHaveText(amount("25 907 000 сум"));
    await expect(flat(page).locator(".calc-total")).toContainText(/≈ \$2\s194/);
    const total = flat(page).locator(".calc-total__row").filter({ hasText: "Итоговая стоимость" });
    await expect(total.locator("dd")).toHaveText(amount("758 184 000 сум"));
    await expect(flat(page)).not.toContainText(/скидк/i);
  });

  test("другая квартира — цена в шапке и расчёт по ней; ?plan= в адресе остаётся", async ({
    page,
  }) => {
    await open(page, `plan=${LAYOUT_78}`);
    if (isPhone(page)) {
      await flat(page).getByText("№ 88").click();
    } else {
      await flat(page).getByLabel("Квартира · свободно: 2").selectOption(UNIT_88);
    }
    await expect(flat(page).locator(".flat-calc__price-value")).toHaveText(amount("$57 880"));
    await expect(page).toHaveURL(new RegExp(`plan=${LAYOUT_78}.*unit=${UNIT_88}`));
  });

  test("MobFlatTerm: кв. 43, схема 50 % и свои 17 мес. → $1 401; Telegram — со ссылкой", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const copied: string[] = [];
      Object.defineProperty(window, "__copied", { value: copied });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (text: string) => void copied.push(text) },
      });
    });
    await open(page, `plan=${LAYOUT_64}&unit=${UNIT_43}&program=${SCHEME}&down=50&months=17`);
    await expect(flat(page).locator(".flat-calc__price-value")).toHaveText(amount("$47 640"));
    await expect(head(page)).toHaveText(amount("$1 401"));
    await flat(page).getByRole("button", { name: "Скопировать для Telegram" }).click();
    await expect(flat(page).getByText("Скопировано — вставьте в Telegram")).toBeVisible();
    const text = await page.evaluate(
      () => (window as unknown as { __copied: string[] }).__copied[0],
    );
    expect(text).toMatch(/кв\. 43, 12 эт\., 64,2 м²/);
    expect(text).not.toMatch(/скидк/i);
    // Ссылка открывает тот же расчёт: та же квартира, программа, взнос и свой срок.
    const link = /Расчёт: (\S+)/.exec(text ?? "")![1]!;
    expect(link).toMatch(new RegExp(`${STAND}\\?plan=${LAYOUT_64}&`));
    for (const part of [`unit=${UNIT_43}`, `program=${SCHEME}`, "down=50", "months=17"]) {
      expect(link).toContain(part);
    }
    await page.goto(link);
    await expect(flat(page).locator(".flat-calc__price-value")).toHaveText(amount("$47 640"));
    await expect(head(page)).toHaveText(amount("$1 401"));
  });

  test("телефон: шторка, «К расчёту ↓» ведёт к итогу внутри неё, Escape закрывает", async ({
    page,
  }) => {
    test.skip(!isPhone(page), "шторка — только на телефоне");
    await open(page, `plan=${LAYOUT_64}&unit=${UNIT_43}`);
    await expect(flat(page).getByRole("radio", { name: /№ 43/ })).toBeChecked();
    const bar = flat(page).locator(".calc-sticky-bar");
    // Шторку прокрутили: полоса — у низа экрана, «Закрыть» — у верха (MobFlatTerm).
    await flat(page).evaluate((element) => element.scrollTo({ top: 400 }));
    const viewport = page.viewportSize()!;
    await expect
      .poll(async () => {
        const box = await bar.boundingBox();
        return box ? Math.round(box.y + box.height) : null;
      })
      .toBe(viewport.height);
    await expect(flat(page).getByRole("button", { name: "Закрыть расчёт" })).toBeInViewport();
    // Наверх шторки: оттуда «К расчёту ↓» ведёт к итогу (у итога полоса прячется).
    await flat(page).evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(bar).not.toHaveAttribute("data-hidden", "");
    await bar.getByRole("button", { name: "К расчёту" }).click();
    const total = flat(page).getByTestId("calc-total");
    await expect(total).toBeInViewport();
    await expect(total).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(flat(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/plan=/);
    // Открыли по адресу — фокус возвращается на «Рассчитать оплату» этой планировки.
    await expect(page.getByRole("button", { name: "Рассчитать оплату" }).first()).toBeFocused();
  });

  test("открыто по адресу: Escape закрывает и панель на 1440, фокус — на её «Рассчитать оплату»", async ({
    page,
  }) => {
    await open(page, `plan=${LAYOUT_78}`);
    await page.keyboard.press("Escape");
    await expect(flat(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/plan=/);
    await expect(page.getByRole("button", { name: "Рассчитать оплату" }).nth(1)).toBeFocused();
  });

  test("окно заявки внутри расчёта: закрыли его — расчёт квартиры остаётся открытым", async ({
    page,
  }) => {
    await open(page, `plan=${LAYOUT_78}`);
    await flat(page).getByRole("button", { name: "Получить точный расчёт" }).click();
    const lead = page.getByRole("dialog", { name: "Точный расчёт" });
    await expect(lead).toBeVisible();
    await lead.getByRole("button", { name: "Закрыть" }).click();
    await expect(lead).toBeHidden();
    await expect(flat(page)).toHaveAttribute("open", "");
    await expect(page).toHaveURL(new RegExp(`plan=${LAYOUT_78}`));
  });

  test("окно заявки внутри расчёта: Escape закрывает только его", async ({ page }) => {
    await open(page, `plan=${LAYOUT_78}`);
    await flat(page).getByRole("button", { name: "Получить точный расчёт" }).click();
    const lead = page.getByRole("dialog", { name: "Точный расчёт" });
    await expect(lead).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(lead).toBeHidden();
    await expect(flat(page)).toHaveAttribute("open", "");
    await expect(page).toHaveURL(new RegExp(`plan=${LAYOUT_78}`));
  });

  test("телефон: строка заголовка шторки — над чертежом и липкая; итог встаёт под неё", async ({
    page,
  }) => {
    test.skip(!isPhone(page), "шторка — только на телефоне");
    await open(page, `plan=${LAYOUT_64}`);
    const bar = flat(page).locator(".flat-calc__bar");
    const plan = flat(page).locator(".flat-calc__plan img");
    await expect(plan).toBeVisible();
    await expect(plan).toHaveJSProperty("complete", true);
    const [barBox, planBox] = [await bar.boundingBox(), await plan.boundingBox()];
    expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(planBox!.y + 1);
    await flat(page).locator(".calc-sticky-bar").getByRole("button", { name: "К расчёту" }).click();
    const total = flat(page).getByTestId("calc-total");
    await expect(total).toBeFocused();
    // Строка осталась у верха шторки, итог — под ней с зазором 16 px (высота строки — один раз).
    const gap = async () => {
      const [top, head] = [await total.boundingBox(), await bar.boundingBox()];
      return Math.round(top!.y - (head!.y + head!.height));
    };
    await expect.poll(gap).toBeLessThanOrEqual(20);
    expect(await gap()).toBeGreaterThanOrEqual(12);
    const sheetTop = (await flat(page).boundingBox())!.y;
    // Строка — у верхнего края шторки (под её рамкой в 1 px).
    expect(Math.abs((await bar.boundingBox())!.y - sheetTop)).toBeLessThanOrEqual(2);
  });

  test("закрыли и сразу снова «Рассчитать оплату» той же планировки — расчёт открыт", async ({
    page,
  }) => {
    await page.goto(STAND);
    await page.waitForLoadState("networkidle");
    const opener = page.getByRole("button", { name: "Рассчитать оплату" }).nth(1);
    await opener.click();
    await expect(flat(page)).toHaveAttribute("open", "");
    await flat(page).getByRole("button", { name: "Закрыть расчёт" }).click();
    await opener.click();
    await expect(flat(page)).toHaveAttribute("open", "");
    await expect(page).toHaveURL(new RegExp(`plan=${LAYOUT_78}`));
  });

  test("по-узбекски: шапка расчёта и ни одного русского слова", async ({ page }) => {
    await page.goto(`${STAND}/uz?plan=${LAYOUT_78}`);
    await expect(flat(page)).toHaveAttribute("open", "");
    await expect(flat(page).locator(".eyebrow")).toHaveText("Shu kvartira uchun hisob-kitob");
    await expect(flat(page)).toContainText("3-xonali · 78 m²");
    await expect(flat(page)).not.toContainText(/[а-яё]/i);
  });
});
