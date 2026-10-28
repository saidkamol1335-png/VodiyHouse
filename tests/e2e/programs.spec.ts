import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Шаг 2.4 фазы 2: «Программы оплаты» руководителя на стенде /dev/programmy (DEMO мокапа CabProg) —
// панели и фильтр, тумблер и порядок, «проверено», правка с превью, новая программа, курс (Р6).
// Тот же экран, что у /admin/programmy; DEMO не меняется — ответ действия живёт до перезагрузки.

const STAND = "/dev/programmy";
const SIFAT = "Farg‘ona Sifat Qurilish";
const MARGILAN = "Marg‘ilon Invest";

const panels = (page: Page) => page.getByTestId("program-panel");
const panelOf = (page: Page, name: string) => page.getByRole("region", { name });
const cardsOf = (page: Page, name: string) => panelOf(page, name).getByTestId("program-card");
const toast = (page: Page) => page.locator(".action-toast__text");
const rateLine = (page: Page) => page.getByTestId("program-rate").locator("p");
const editor = (page: Page) => page.locator(".program-editor");

async function open(page: Page, path = STAND) {
  await page.goto(path);
  await expect(panels(page).first()).toBeVisible();
  // Клик до гидратации React не услышит.
  await page.waitForLoadState("networkidle");
}

test.describe("кабинет · программы оплаты: руководитель", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("панели застройщиков и фильтр: адрес ?developer= переживает обновление", async ({
    page,
  }) => {
    await open(page);
    await expect(panels(page)).toHaveCount(3);
    await expect(cardsOf(page, SIFAT)).toHaveCount(4);
    await expect(panelOf(page, SIFAT)).toContainText(
      "1 ЖК · включено 4 из 4 · обновлено 01.10.2026",
    );
    await expect(rateLine(page)).toHaveText(/^Курс ЦБ: 1 \$ = 11\s808,76 сум · 01\.10\.2026$/);

    const filter = page.getByRole("group", { name: "Застройщики" });
    await filter.getByRole("button", { name: MARGILAN }).click();
    await expect(panels(page)).toHaveCount(1);
    await expect(page).toHaveURL(`${STAND}?developer=demo-margilan-invest`);
    await page.reload();
    await expect(panels(page)).toHaveCount(1);
    await expect(filter.getByRole("button", { name: MARGILAN })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.waitForLoadState("networkidle");
    await filter.getByRole("button", { name: "Все застройщики" }).click();
    await expect(panels(page)).toHaveCount(3);
    await expect(page).toHaveURL(STAND);
  });

  test("тумблер: выключить — полоса и счётчик; стрелки меняют порядок", async ({ page }) => {
    await open(page);
    const sifat = panelOf(page, SIFAT);
    const full = sifat.getByRole("switch", { name: "100% оплата: на сайте" });
    await expect(full).toHaveAttribute("aria-checked", "true");
    await full.click();
    await expect(full).toHaveAttribute("aria-checked", "false");
    await expect(toast(page)).toHaveText(
      "Выключено: 100% оплата — пропало из калькулятора на сайте",
    );
    await expect(sifat).toContainText("включено 3 из 4");
    await expect(
      sifat.getByRole("switch", { name: "Ipoteka Bank · Ипотека: на сайте" }),
    ).toBeVisible();

    const first = cardsOf(page, SIFAT).first();
    await expect(first.getByRole("button", { name: "Выше" })).toBeDisabled();
    await first.getByRole("button", { name: "Ниже" }).click();
    await expect(cardsOf(page, SIFAT).first()).toContainText("Рассрочка от застройщика");
    await expect(cardsOf(page, SIFAT).nth(1)).toContainText("100% оплата");
  });

  test("«Рассчитать» и «Расчёт для клиента» открывают расчёт с программой и застройщиком (Р1 A)", async ({
    page,
  }) => {
    await open(page);
    const bank = "Ipoteka Bank · Рассрочка через банк";
    await panelOf(page, SIFAT)
      .getByRole("link", { name: `Рассчитать: ${bank}` })
      .click();
    await expect(page).toHaveURL(/\/dev\/programmy\/raschet\?developer=demo-sifat&program=[\w-]+$/);
    await expect(
      page.getByRole("radio", { name: /Ipoteka Bank.*Рассрочка через банк/ }),
    ).toBeChecked();

    await open(page);
    await panelOf(page, MARGILAN)
      .getByRole("link", { name: `Расчёт для клиента: ${MARGILAN}` })
      .click();
    await expect(page).toHaveURL(`${STAND}/raschet?developer=demo-margilan-invest`);
    await expect(
      page.getByRole("group", { name: "Застройщик" }).getByRole("button", { name: MARGILAN }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("несохранённая правка: «Расчёт для клиента» и «Рассчитать» сначала спрашивают", async ({
    page,
  }) => {
    await open(page);
    const sifat = panelOf(page, SIFAT);
    await cardsOf(page, SIFAT).nth(1).getByRole("button", { name: "Изменить" }).click();
    await editor(page).getByLabel("Взнос от, %").first().fill("40");
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toBe("Уйти без сохранения?");
      void dialog.dismiss();
    });
    await sifat.getByRole("link", { name: `Расчёт для клиента: ${SIFAT}` }).click();
    await expect(editor(page)).toBeVisible();
    await expect(page).toHaveURL(STAND);
    page.once("dialog", (dialog) => void dialog.accept());
    await sifat
      .getByRole("link", { name: "Рассчитать: Ipoteka Bank · Рассрочка через банк" })
      .click();
    await expect(page).toHaveURL(/\/dev\/programmy\/raschet\?developer=demo-sifat&program=/);
  });

  test("выключенную программу не посчитать: «Рассчитать» пропадает вместе с тумблером", async ({
    page,
  }) => {
    await open(page);
    const sifat = panelOf(page, SIFAT);
    await expect(sifat.getByRole("link", { name: /^Рассчитать: / })).toHaveCount(4);
    await sifat.getByRole("switch", { name: "100% оплата: на сайте" }).click();
    await expect(sifat.getByRole("link", { name: "Рассчитать: 100% оплата" })).toHaveCount(0);
    await expect(sifat.getByRole("link", { name: /^Рассчитать: / })).toHaveCount(3);
  });

  test("условия старше 60 дней → «Условия проверены сегодня» снимает метку", async ({ page }) => {
    // DEMO обновлено 01.10.2026; стенд отвечает настоящим временем — оно моложе 60 дней.
    await page.clock.setFixedTime(new Date(Math.max(Date.parse("2026-12-01"), Date.now())));
    await open(page);
    const sifat = panelOf(page, SIFAT);
    await expect(sifat.getByText("Условия старше 60 дней")).toBeVisible();
    await sifat.getByRole("button", { name: "Условия проверены сегодня" }).click();
    await expect(toast(page)).toHaveText(`Отмечено: условия ${SIFAT} проверены сегодня`);
    await expect(sifat.getByText("Условия старше 60 дней")).toHaveCount(0);
    await expect(panelOf(page, MARGILAN).getByText("Условия старше 60 дней")).toBeVisible();
  });

  test("правка: ошибка под полем, «Сохранено», превью; Escape спрашивает", async ({ page }) => {
    await open(page);
    const scheme = cardsOf(page, SIFAT).nth(1);
    await scheme.getByRole("button", { name: "Изменить" }).click();
    const minDown = editor(page).getByLabel("Взнос от, %").first();
    await expect(minDown).toHaveValue("30");
    await minDown.fill("3o");
    await editor(page).getByRole("button", { name: "Сохранить" }).click();
    await expect(minDown).toHaveAttribute("aria-invalid", "true");
    await expect(editor(page).getByText("Только число")).toBeVisible();
    await expect(editor(page).getByText("Проверьте поля и сохраните ещё раз")).toBeVisible();

    await minDown.fill("35");
    await expect(page.getByTestId("program-preview")).toContainText("взнос 35%");
    await editor(page).getByRole("button", { name: "Сохранить" }).click();
    await expect(editor(page).getByText("Сохранено")).toBeVisible();
    await expect(minDown).not.toHaveAttribute("aria-invalid", "true");

    await minDown.fill("40");
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toBe("Уйти без сохранения?");
      void dialog.dismiss();
    });
    await page.keyboard.press("Escape");
    await expect(editor(page)).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.keyboard.press("Escape");
    await expect(editor(page)).toHaveCount(0);
    // Фокус — обратно на «Изменить» той же карточки, а не на body.
    await expect(
      scheme.getByRole("button", { name: "Изменить: Рассрочка от застройщика" }),
    ).toBeFocused();
  });

  test("новая программа: вид → поля → «Пример» в превью → выключенная карточка", async ({
    page,
  }) => {
    await open(page);
    const sifat = panelOf(page, SIFAT);
    await sifat.getByRole("button", { name: "Программа" }).click();
    await sifat
      .getByRole("group", { name: "Вид новой программы" })
      .getByRole("button", { name: "Рассрочка с наценкой" })
      .click();
    // Пустой черновик: ни «0 мес.», ни «→ ∞/мес» — «Пример» появится, когда будет срок.
    await expect(page.getByTestId("program-preview")).not.toContainText("Пример");
    await expect(page.getByTestId("program-preview")).not.toContainText("0 мес.");
    await editor(page).getByLabel("Минимальный взнос, %").fill("20");
    await editor(page).getByLabel("Срок, мес.").fill("24");
    await editor(page).getByLabel("Наценка, % за срок").fill("12");
    // 60 м² × $690 = $41 400; взнос 20% → $33 120 × 1,12 / 24 = $1 545,60 → $1 546.
    await expect(page.getByTestId("program-preview")).toContainText(
      /Пример: 60 м² × \$690, взнос 20%, 24 мес\. → \$1\s546\/мес/,
    );
    await editor(page).getByRole("button", { name: "Сохранить" }).click();
    await expect(editor(page)).toHaveCount(0);
    await expect(toast(page)).toHaveText("Сохранено");
    await expect(cardsOf(page, SIFAT)).toHaveCount(5);
    await expect(
      sifat.getByRole("switch", { name: "Рассрочка с наценкой: на сайте" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  test("курс: проверка ввода, «Зафиксировать» меняет пример банка в сумах, «Вернуть курс ЦБ»", async ({
    page,
  }) => {
    await open(page);
    const bank = cardsOf(page, SIFAT).nth(2).locator(".program-card__example");
    const cbuExample = await bank.textContent();
    const rate = page.getByTestId("program-rate");
    await rate.getByRole("button", { name: "Зафиксировать курс" }).click();
    const input = rate.getByLabel("Курс, сум за 1 $");
    for (const [value, issue] of [
      ["", "Введите курс"],
      ["12.650.5", "Только цифры, копейки — через запятую"],
      ["500", "Курс — от 1 000 до 100 000 сум за доллар"],
    ]) {
      await input.fill(value!);
      await rate.getByRole("button", { name: "Сохранить" }).click();
      await expect(rate.getByText(issue!)).toBeVisible();
    }
    await input.fill("12 650,5");
    await rate.getByRole("button", { name: "Сохранить" }).click();
    await expect(toast(page)).toHaveText("Курс зафиксирован");
    await expect(rateLine(page)).toContainText(/Курс: 1 \$ = 12\s650,50 сум · зафиксирован/);
    await expect(rate.getByText("ручной")).toBeVisible();
    await expect(page.locator(".payment-programs__notice")).toContainText("по ручному курсу");
    await expect(cardsOf(page, SIFAT).nth(2)).toContainText(
      /Валюта\s*сум, по курсу на \d{2}\.\d{2}\.\d{4}/,
    );
    await expect(bank).not.toHaveText(cbuExample!);

    await rate.getByRole("button", { name: "Вернуть курс ЦБ" }).click();
    await rate
      .getByRole("group", { name: "Вернуть курс ЦБ?" })
      .getByRole("button", { name: "Да" })
      .click();
    await expect(toast(page)).toHaveText("Снова действует курс ЦБ");
    await expect(rateLine(page)).toHaveText(/^Курс ЦБ: 1 \$ = 11\s808,76 сум/);
    await expect(bank).toHaveText(cbuExample!);
  });
});
