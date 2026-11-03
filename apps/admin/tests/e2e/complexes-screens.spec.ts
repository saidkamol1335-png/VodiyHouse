import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Фаза D (PLAN §10, пп. 21–27): экраны 2–5 на стендах /dev/zhk (руководитель) и /dev/menedzher/zhk
// (менеджер) — вкладки списка и действия в строке, «Публикация» по роли, «Частые вопросы» на «О ЖК»,
// «Квартиры»: колонка «На сайте», «Только неполные», цена в строке, чек-лист формы квартиры.
// Действия стендов проверяют ввод как настоящие, базу не трогают.

const HEAD = "/dev/zhk";
const MANAGER = "/dev/menedzher/zhk";
const SHODLIK_ID = "00000000-0000-4000-8000-0000000000c1";
const GULZOR_ID = "00000000-0000-4000-8000-0000000000c5";

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const pills = (page: Page) => page.getByRole("group", { name: "Статус" }).getByRole("button");
const rowActions = (page: Page, name: string) =>
  page.getByRole("group", { name: `Действия с ЖК «${name}»` });
const panel = (page: Page, title: string) =>
  page.locator(".admin-panel").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });

test.describe("кабинет · ЖК · экраны фазы D", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("список (экран 2): вкладки «Все · На сайте · Скрытые · Черновики · Архив», значки строк", async ({ page }) => {
    await open(page, HEAD);
    await expect(pills(page)).toHaveText([/^Все\s*6$/, /^На сайте\s*5$/, /^Скрытые\s*0$/, /^Черновики\s*1$/, /^Архив\s*1$/]);
    const row = (name: string) => page.locator(".complex-list__row").filter({ hasText: `ЖК ${name}` });
    await expect(row("Shodlik").locator(".complex-list__status")).toHaveText("На сайте");
    await expect(row("Gulzor").locator(".complex-list__status")).toHaveText("Черновик");
    await pills(page).filter({ hasText: "Черновики" }).click();
    await expect(page.locator(".complex-list__row")).toHaveCount(1);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("действия руководителя в строке: «Скрыть», «В архив» с названием, из архива — «Восстановить» и «Удалить сейчас»", async ({
    page,
  }) => {
    await open(page, HEAD);
    const shodlik = rowActions(page, "Shodlik");
    await expect(shodlik.getByRole("button")).toHaveText(["Скрыть", "В архив"]);
    await shodlik.getByRole("button", { name: "Скрыть" }).click();
    await expect(shodlik.locator(".form-status")).toHaveText("Скрыт с сайта");

    const gulzor = rowActions(page, "Gulzor");
    await gulzor.getByRole("button", { name: "В архив" }).click();
    await expect(gulzor).toContainText("Отправить «Gulzor» в архив?");
    const confirm = gulzor.getByLabel("Чтобы подтвердить, введите название");
    await expect(confirm).toBeFocused();
    await confirm.fill("Gulzar");
    await gulzor.getByRole("button", { name: "Да, в архив" }).click();
    await expect(gulzor.locator(".form-status")).toContainText("Название введено не так");
    await confirm.fill("gulzor");
    await gulzor.getByRole("button", { name: "Да, в архив" }).click();
    await expect(gulzor.locator(".form-status")).toHaveText("Отправлен в архив");

    await pills(page).filter({ hasText: "Архив" }).click();
    const lola = rowActions(page, "Lola");
    await expect(lola.getByRole("button")).toHaveText(["Восстановить", "Удалить сейчас"]);
    await lola.getByRole("button", { name: "Удалить сейчас" }).click();
    await expect(lola).toContainText("Удалить ЖК «Lola» сейчас?");
    await expect(lola).toContainText("CSV квартир уйдёт вам в Telegram");
    await lola.getByLabel("Чтобы подтвердить, введите название").fill("Lol");
    await lola.getByRole("button", { name: "Да, удалить" }).click();
    await expect(lola.locator(".form-status")).toContainText("Название введено не так");
    await lola.getByLabel("Чтобы подтвердить, введите название").fill("LOLA");
    await lola.getByRole("button", { name: "Да, удалить" }).click();
    await expect(lola.locator(".form-status")).toHaveText("ЖК удалён");
    await lola.getByRole("button", { name: "Восстановить" }).click();
    await expect(lola.locator(".form-status").first()).toHaveText("Восстановлен как черновик");
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("менеджер: создание есть, вкладки без «Архива», действий в строке и «Порядка в каталоге» нет", async ({ page }) => {
    await open(page, MANAGER);
    await expect(page.getByRole("button", { name: "Добавить ЖК" })).toBeVisible();
    await expect(pills(page)).toHaveText([/^Все\s*6$/, /^На сайте\s*5$/, /^Скрытые\s*0$/, /^Черновики\s*1$/]);
    await expect(page.locator(".complex-list__actions")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Порядок в каталоге" })).toHaveCount(0);
    await expect(page.locator(".complex-list__status")).toHaveCount(6);
    await page.locator(".complex-list__row").filter({ hasText: "ЖК Shodlik" }).click();
    await expect(page).toHaveURL(new RegExp(`${MANAGER}/${SHODLIK_ID}$`));
  });

  test("«Публикация» менеджера: запрос руководителю с причиной, капсулы статуса нет", async ({ page }) => {
    await open(page, `${MANAGER}/${SHODLIK_ID}/publikatsiya`);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Состояние на сайте",
      "Чек-лист публикации",
      "Действия",
      "Предпросмотр",
      "Журнал изменений",
    ]);
    const actions = panel(page, "Действия");
    await expect(actions.getByRole("form", { name: "Статус на сайте" })).toHaveCount(0);
    await expect(actions.getByRole("button", { name: /Опубликовать|Скрыть с сайта|^В архив$/ })).toHaveCount(0);
    await expect(actions).toContainText("Публикует, скрывает и отправляет в архив руководитель");
    await expect(actions.getByRole("button")).toHaveText(["Запросить скрытие", "Запросить архив"]);
    await actions.getByLabel("Коротко: почему (необязательно)").fill("Застройщик просит убрать до новых цен");
    await actions.getByRole("button", { name: "Запросить скрытие" }).click();
    // Стенд без бота: запрос «сохранён», руководителю напомнить самому.
    await expect(actions.locator(".form-status")).toContainText("Запрос сохранён");
    // Журнал ЖК — на этой же вкладке и у менеджера.
    await expect(panel(page, "Журнал изменений").locator(".journal-list__entry").first()).toBeVisible();

    // Черновик: просить можно только публикацию.
    await open(page, `${MANAGER}/${GULZOR_ID}/publikatsiya`);
    await expect(panel(page, "Действия").getByRole("button")).toHaveText(["Запросить публикацию", "Запросить архив"]);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("«Публикация» руководителя: капсула статуса, предпросмотр 390/1440, журнал; формы запроса нет", async ({ page }) => {
    await open(page, `${HEAD}/${SHODLIK_ID}/publikatsiya`);
    const actions = panel(page, "Действия");
    await expect(actions.getByRole("form", { name: "Статус на сайте" })).toBeVisible();
    await expect(actions.getByRole("button", { name: /^Запросить/ })).toHaveCount(0);
    await expect(panel(page, "Предпросмотр").getByRole("button")).toHaveText(["Открыть 390", "Открыть 1440"]);
    await expect(panel(page, "Журнал изменений").locator(".journal-list__entry").first()).toBeVisible();
  });

  test("менеджер открывает все вкладки ЖК; старых адресов вкладок нет", async ({ page }) => {
    await open(page, `${MANAGER}/${SHODLIK_ID}`);
    const tabs = page.getByRole("navigation", { name: "Разделы ЖК" });
    await expect(tabs.getByRole("link")).toHaveCount(8);
    await tabs.getByRole("link", { name: "Блоки и оплата" }).click();
    await expect(page).toHaveURL(new RegExp(`${MANAGER}/${SHODLIK_ID}/bloki$`));
    await expect(page.getByTestId("block-card")).toHaveCount(2);
    // Запросом, а не в браузере: страница 404 в разработке пишет в консоль свои предупреждения.
    for (const segment of ["video", "detali", "predprosmotr", "zhurnal"]) {
      expect((await page.request.get(`${HEAD}/${SHODLIK_ID}/${segment}`)).status(), segment).toBe(404);
    }
  });

  test("«О ЖК»: «Частые вопросы» — без UZ ошибка строки, с UZ «Сохранено»", async ({ page }) => {
    await open(page, `${HEAD}/${SHODLIK_ID}/o-zhk`);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Описание", "Детали проекта", "Видео", "Частые вопросы"]);
    const faq = panel(page, "Частые вопросы");
    await expect(faq).toContainText("Вопросов пока нет.");
    await faq.getByRole("button", { name: "+ Добавить вопрос" }).click();
    const row = faq.getByRole("group", { name: "Вопрос 1" });
    await row.getByLabel("Вопрос · RU").fill("Есть ли рассрочка?");
    await row.getByLabel("Ответ · RU").fill("Да, до 24 месяцев от застройщика.");
    await faq.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(row).toContainText("Нужен текст на узбекском");
    await row.getByLabel("Savol · UZ").fill("Muddatli to‘lov bormi?");
    await row.getByLabel("Javob · UZ").fill("Ha, quruvchidan 24 oygacha.");
    await faq.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(faq.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();
    await expect(row).not.toContainText("Нужен текст");
    expect(await noHorizontalScroll(page)).toBe(0);
  });
});

test.describe("кабинет · квартиры · экраны 4–5", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  const units = (query = "") => `${HEAD}/${SHODLIK_ID}/kvartiry${query}`;
  const rows = (page: Page) => page.locator(".units-row");
  const rowOf = (page: Page, number: string) =>
    rows(page).filter({ has: page.locator(".units-row__number", { hasText: new RegExp(`^${number}$`) }) });

  async function openUnits(page: Page, query = "") {
    await page.goto(units(query));
    await expect(rows(page).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
  }

  test("«На сайте» у каждой квартиры; «Только неполные · N» оставляет N строк и снимается", async ({ page }) => {
    await openUnits(page, "?demo=variety");
    const site = page.locator(".units-row__site");
    await expect(site.first()).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) >= 760) {
      await expect(page.getByRole("columnheader", { name: "На сайте" })).toBeVisible();
    }
    await expect(page.locator(".units-row__site:not(.units-row__site--on)").first()).toContainText("нет");
    const toggle = page.getByRole("button", { name: /^Только неполные · \d+$/ });
    const count = Number(/(\d+)$/.exec((await toggle.textContent())!)![1]);
    const total = await rows(page).count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(total);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(rows(page)).toHaveCount(count);
    await expect(page.locator(".units-row__site--on")).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(rows(page)).toHaveCount(total);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("цена в строке: поле, Enter — «Сохранено · Отменить»; Esc — без сохранения", async ({ page }) => {
    await openUnits(page);
    const row = rowOf(page, "3");
    await row.getByRole("button", { name: "Цена кв. 3 — изменить" }).click();
    const input = row.getByRole("textbox", { name: /^Цена кв\. 3/ });
    await expect(input).toBeFocused();
    await input.press("Escape");
    await expect(row.getByRole("status")).toHaveCount(0);
    await row.getByRole("button", { name: "Цена кв. 3 — изменить" }).click();
    await input.fill("750");
    await input.press("Enter");
    const saved = row.getByRole("status").filter({ hasText: "Сохранено" });
    await expect(saved).toBeVisible();
    await expect(saved.getByRole("button", { name: "Отменить" })).toBeVisible();
  });

  test("форма квартиры (экран 5): «На сайт: N из 5» и превью карточки меняются до сохранения", async ({ page }) => {
    await openUnits(page);
    await rowOf(page, "1").getByRole("button", { name: /Статус и правка/ }).click();
    await page.getByRole("button", { name: "Изменить квартиру" }).click();
    const aside = page.getByRole("complementary", { name: "Квартира на сайте" });
    await expect(aside).toBeVisible();
    // Кв. 1 продана: всё, кроме «в продаже».
    await expect(aside).toContainText("На сайт: 4 из 5");
    await expect(aside.locator(".unit-edit__check")).toHaveCount(5);
    await expect(aside.locator(".unit-edit__card-title")).toHaveText("1-комн. · 42,5 м²");
    await expect(aside.locator(".unit-edit__card-kicker")).toContainText("Блок A");
    // На 390 чек-лист — под полями, на 1440 — рядом.
    const form = (await page.locator(".unit-edit").boundingBox())!;
    const box = (await aside.boundingBox())!;
    if ((page.viewportSize()?.width ?? 0) < 760) expect(box.width).toBeGreaterThan(form.width * 0.8);
    else expect(box.width).toBeLessThan(form.width * 0.6);
    expect(await noHorizontalScroll(page)).toBe(0);
  });
});
