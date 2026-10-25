import { expect, test, type Page, type Request } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 12.5: массовая панель, правка строки, «+ Квартира», «Удалить список блока» на стенде
// /dev/zhk (DEMO Shodlik, блок A — 88 квартир: свободных 12, брони 2). DEMO не меняется: ответ
// действия ложится в список на экране, а новое чтение вернуло бы сид — проверяем сразу после ответа.

const SHODLIK = "/dev/zhk/00000000-0000-4000-8000-0000000000c1/kvartiry";

const rows = (page: Page) => page.locator(".units-row");
const bulk = (page: Page) => page.locator(".units-bulk");
const bar = (page: Page) => page.locator(".units-undo");
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 760;
const pill = (page: Page, name: string) =>
  page.getByRole("group", { name: "Статус" }).getByRole("button", { name: new RegExp(`^${name}`) });
const rowOf = (page: Page, number: string) =>
  rows(page).filter({
    has: page.locator(".units-row__number", { hasText: new RegExp(`^${number}$`) }),
  });
const check = (page: Page, number: string) =>
  page.getByRole("checkbox", { name: `Выбрать кв. ${number}`, exact: true });

async function open(page: Page, url: string = SHODLIK) {
  await page.goto(url);
  await expect(rows(page).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

function trackActions(page: Page) {
  const posts: Request[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) posts.push(request);
  });
  return posts;
}

/** «Уйти без сохранения?» должен появиться — и получить «Нет»; не появился — тест упадёт по таймауту. */
const dismissNextDialog = (page: Page) =>
  page.waitForEvent("dialog").then((dialog) => dialog.dismiss());

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ответ действия приходит внутри перехода на другой блок — по событиям, а не по часам: действие
 * отпускается после начала перехода (RSC-запрос страницы) и кадра на data-switching, а переход —
 * только после ответа действия (и кадра на его отрисовку).
 */
async function slowBlockSwitch(page: Page) {
  let started!: () => void;
  let answered!: () => void;
  const navigation = new Promise<void>((resolve) => (started = resolve));
  const action = new Promise<void>((resolve) => (answered = resolve));
  await page.route(`**${SHODLIK}*`, async (route) => {
    const request = route.request();
    const headers = request.headers();
    if (request.method() === "GET" && headers["rsc"] === "1" && !headers["next-router-prefetch"]) {
      started();
      await Promise.race([action, sleep(5000)]);
      await sleep(200);
    } else if (request.method() === "POST") {
      await Promise.race([navigation, sleep(5000)]);
      await sleep(100);
      await route.fulfill({ response: await route.fetch() });
      return answered();
    }
    await route.continue();
  });
}

async function step(page: Page, name: string) {
  await bulk(page).getByRole("button", { name, exact: true }).click();
}

test.describe("кабинет · ЖК · квартиры: правки руководителя", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("галочки: «Выбрать все N по фильтру» добавляет, вне фильтра считается, «×» снимает", async ({
    page,
  }) => {
    await open(page);
    await check(page, "1").check();
    await expect(bulk(page)).toContainText("Выбрано: 1 квартира");
    await pill(page, "Свободны").click();
    await expect(bulk(page)).toContainText("1 вне фильтра");
    await page.getByRole("button", { name: "Выбрать все 12 по фильтру" }).click();
    await expect(bulk(page)).toContainText("Выбрано: 13 квартир");
    await expect(bulk(page)).toContainText("1 вне фильтра");
    if (!isMobile(page)) {
      await pill(page, "Все").click();
      const head = page.getByRole("checkbox", { name: "Выбрать показанные" });
      await expect
        .poll(() => head.evaluate((input: HTMLInputElement) => input.indeterminate))
        .toBe(true);
    }
    await bulk(page).getByRole("button", { name: "Снять выделение" }).click();
    await expect(bulk(page)).toHaveCount(0);
  });

  test("массовый статус: строки и счётчики сразу, скрытые выделенные остаются скрытыми", async ({
    page,
  }) => {
    await open(page);
    await check(page, "1").check();
    await pill(page, "Свободны").click();
    await expect(rows(page)).toHaveCount(12);
    const free = await rows(page).locator(".units-row__number").allTextContents();
    await check(page, free[0]!).check();
    await check(page, free[1]!).check();
    await step(page, "Статус");
    await bulk(page)
      .getByRole("group", { name: "Статус выбранных" })
      .getByRole("button", { name: "бронь" })
      .click();
    await expect(bar(page)).toContainText("3 квартиры → бронь");
    await expect(pill(page, "Свободны")).toContainText("10");
    await expect(rows(page)).toHaveCount(12);
    await expect(rowOf(page, "1")).toHaveCount(0);
    await expect(bulk(page)).toContainText("1 вне фильтра");
  });

  test("цена за м²: пример, ошибка суммы без запроса, строка «… · $650/м²»", async ({ page }) => {
    await open(page);
    const posts = trackActions(page);
    await check(page, "1").check();
    await check(page, "2").check();
    await step(page, "Цена");
    await bulk(page).getByText("за м²", { exact: true }).click();
    const value = bulk(page).getByLabel("Цена за м², $");
    await value.fill("31,000");
    await bulk(page).getByRole("button", { name: "Поставить цену" }).click();
    await expect(bulk(page)).toContainText("Нужно целое число");
    // Отказ до запроса — фокус на поле суммы (оно связано с текстом ошибки), и повторно тоже.
    await expect(value).toBeFocused();
    await bulk(page).getByRole("button", { name: "Поставить цену" }).click();
    await expect(value).toBeFocused();
    expect(posts).toHaveLength(0);
    await value.fill("650");
    await expect(bulk(page)).toContainText("Кв. 1: 42,5 м² × 650 = $27 625");
    await bulk(page).getByRole("button", { name: "Поставить цену" }).click();
    await expect(bar(page)).toContainText("Цена поменялась у 2 квартир");
    await expect(rowOf(page, "1").locator(".units-row__per-m2")).toHaveText("$650/м²");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.postData()).toContain("per_m2");
  });

  test("отказ правки, пришедший во время перехода на другой блок, — строкой в полосе", async ({
    page,
  }) => {
    test.slow();
    await open(page, `${SHODLIK}?demo=fail`);
    // Переход медленный (RSC блока B — 2 с), отказ правки приходит внутри него: форма уходящего
    // блока ещё смонтирована, но inert и исчезнет вместе с блоком — отказ должен уйти в полосу.
    await slowBlockSwitch(page);
    await check(page, "1").check();
    await step(page, "Цена");
    await bulk(page).getByText("за квартиру", { exact: true }).click();
    await bulk(page).getByLabel("Цена квартиры, $").fill("50000");
    await bulk(page).getByRole("button", { name: "Поставить цену" }).click();
    await page
      .getByRole("navigation", { name: "Блок" })
      .getByRole("link", { name: /Блок B/ })
      .click();
    await expect(page.locator(".units-block__listed")).toContainText("Блок B", { timeout: 15_000 });
    await expect(bar(page)).toContainText("Блок A · Не поставили цену");
    // Диктору — по блоку, где прозвучало (A, переход ещё шёл): после смены блока текст тот же.
    const live = page.locator(".complex-units + [role=status]");
    await expect(live).toContainText("Не поставили цену");
    await expect(live).not.toContainText("Блок A ·");
    // Обработчики маршрута с задержками не должны пережить тест (ошибка «страница закрыта»).
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("отделка: вариант выбирают явно; «Под ключ», затем «как в блоке»", async ({ page }) => {
    test.skip(isMobile(page), "отделка блока на карточке не показывается — проверяем в таблице");
    await open(page);
    await check(page, "1").check();
    await step(page, "Отделка");
    const apply = bulk(page).getByRole("button", { name: "Поставить отделку" });
    await expect(apply).toBeDisabled();
    await bulk(page).getByLabel("Отделка").selectOption({ label: "Под ключ" });
    await apply.click();
    await expect(rowOf(page, "1").locator(".units-row__finishing")).toHaveText("Под ключ");
    await step(page, "Отделка");
    await bulk(page).getByLabel("Отделка").selectOption({ label: "Как в блоке (Черновая)" });
    await bulk(page).getByRole("button", { name: "Поставить отделку" }).click();
    await expect(rowOf(page, "1").locator(".units-row__finishing")).toHaveText(
      "Черновая · как в блоке",
    );
  });

  test("удаление: вопрос с бронями, строки ушли; весь список — к «Удалить список блока»", async ({
    page,
  }) => {
    await open(page);
    await pill(page, "Бронь").click();
    await expect(rows(page)).toHaveCount(2);
    const reserved = (await rows(page).locator(".units-row__number").first().textContent())!;
    await check(page, reserved).check();
    await pill(page, "Все").click();
    await check(page, "1").check();
    await step(page, "Удалить");
    await expect(bulk(page)).toContainText("Удалить 2 квартиры?");
    await expect(bulk(page)).toContainText(`Бронь: № ${reserved}`);
    await expect(bulk(page)).toContainText("Сайт сразу перестанет их показывать.");
    await bulk(page).getByRole("button", { name: "Да, удалить" }).click();
    await expect(bar(page)).toContainText("Удалено: 2 квартиры");
    await expect(page.locator(".units-block__listed")).toContainText("список из 86 квартир");
    await expect(rowOf(page, "1")).toHaveCount(0);

    await page.getByRole("button", { name: /Выбрать все 86 по фильтру/ }).click();
    await step(page, "Удалить");
    await expect(bulk(page)).toContainText("Выбран весь список");
    await bulk(page).getByRole("button", { name: "К «Удалить список блока»" }).click();
    await expect(
      page.getByRole("button", { name: "Удалить список блока", exact: true }),
    ).toBeFocused();
  });

  test("правка строки: только правленые поля, номер-дубль — без запроса, Esc спрашивает", async ({
    page,
  }) => {
    await open(page);
    const posts = trackActions(page);
    await rowOf(page, "1")
      .getByRole("button", { name: /Статус и правка/ })
      .click();
    await page.getByRole("button", { name: "Изменить квартиру" }).click();
    const number = page.getByLabel("Номер", { exact: true });
    await expect(number).toBeFocused();
    await number.fill("2");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.locator(".unit-edit")).toContainText("Квартира с таким номером уже есть");
    // Отказ до запроса — фокус на неверное поле (оно связано с текстом ошибки), и повторно тоже.
    await expect(number).toBeFocused();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(number).toBeFocused();
    expect(posts).toHaveLength(0);

    const asked = dismissNextDialog(page);
    await page.keyboard.press("Escape");
    await asked;
    await expect(page.locator(".unit-edit")).toBeVisible();

    await number.fill("1А");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(bar(page)).toContainText("Кв. 1А: сохранено");
    await expect(rowOf(page, "1А")).toHaveCount(1);
    expect(posts).toHaveLength(1);
    const body = posts[0]!.postData() ?? "";
    expect(body).toContain("1А");
    expect(body).not.toContain("finishingId");
  });

  test("«+ Квартира»: место занято — ошибка; свободное — добавлена, форма остаётся", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("button", { name: "+ Квартира" }).click();
    const form = page.getByRole("form", { name: "Новая квартира" });
    await form.getByLabel("Подъезд").fill("1");
    await form.getByLabel("Этаж").fill("2");
    await form.getByLabel("Позиция").fill("1");
    await form.getByRole("button", { name: "Добавить" }).click();
    await expect(form).toContainText("Место занято: кв. 1");
    await expect(form.getByLabel("Подъезд")).toBeFocused();
    await form.getByLabel("Позиция").fill("5");
    await expect(form.getByLabel("Номер")).toHaveValue("89");
    await form.getByRole("button", { name: "Добавить" }).click();
    await expect(form).toContainText("Добавлена кв. 89");
    // «Добавить» была недоступна, пока шёл запрос: фокус вернулся на неё, а не на body.
    await expect(form.getByRole("button", { name: "Добавить" })).toBeFocused();
    await expect(form.getByLabel("Номер")).toHaveValue("90");
    await expect(page.locator(".units-block__listed")).toContainText("список из 89 квартир");
    await expect(rowOf(page, "89")).toHaveCount(1);
  });

  test("«Удалить список блока»: название — регистр любой; уведомление вместо списка", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("button", { name: "Удалить список блока" }).click();
    const submit = page.getByRole("button", { name: "Удалить список" });
    const name = page.getByLabel("Введите название блока: A");
    await name.fill("Б");
    await expect(submit).toBeDisabled();
    await name.fill("а");
    await submit.click();
    await expect(page.locator(".units-notice")).toContainText("Список блока A удалён: 88 квартир");
    await expect(page.locator(".units-notice")).toBeFocused();
    await expect(rows(page)).toHaveCount(0);
  });

  test("отказы: «база не успела» — в шаге, шаг открыт; «не делает хуже» — чего лишится ЖК", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}?demo=fail`);
    await check(page, "1").check();
    await step(page, "Цена");
    await bulk(page)
      .getByLabel(/Цена квартиры/)
      .fill("40 000");
    await bulk(page).getByRole("button", { name: "Поставить цену" }).click();
    await expect(bulk(page)).toContainText("База не успела ответить");
    await expect(bulk(page).getByRole("button", { name: "Поставить цену" })).toBeVisible();

    await open(page, `${SHODLIK}?demo=notready`);
    await check(page, "1").check();
    await step(page, "Цена");
    await bulk(page).getByText("без цены", { exact: true }).click();
    await bulk(page).getByRole("button", { name: "Снять цену" }).click();
    await expect(bulk(page)).toContainText("Нельзя: опубликованный ЖК потерял бы");
  });

  test("фокус не падает на body: «×» панели, «Выбрать все» и «Снять выделение»", async ({
    page,
  }) => {
    await open(page);
    const summary = page.locator(".units-list__summary");
    await check(page, "1").check();
    await bulk(page).getByRole("button", { name: "Снять выделение" }).click();
    await expect(summary).toBeFocused();
    await page.getByRole("button", { name: "Выбрать все 88 по фильтру" }).click();
    await expect(
      page.locator(".units-list__select-button", { hasText: "Снять выделение" }),
    ).toBeFocused();
    await page.locator(".units-list__select-button", { hasText: "Снять выделение" }).click();
    await expect(page.getByRole("button", { name: "Выбрать все 88 по фильтру" })).toBeFocused();
  });

  test("правка открыта и изменена — смена фильтра спрашивает; «Нет» — форма и фокус на месте", async ({
    page,
  }) => {
    await open(page);
    await rowOf(page, "1")
      .getByRole("button", { name: /Статус и правка/ })
      .click();
    await page.getByRole("button", { name: "Изменить квартиру" }).click();
    await page.getByLabel("Номер", { exact: true }).fill("1Б");
    // Диалог был, «Нет» оставил и фильтр, и форму; фокус — там, где нажимали, а не на body.
    let asked = dismissNextDialog(page);
    await pill(page, "Свободны").click();
    await asked;
    await expect(pill(page, "Свободны")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".unit-edit")).toBeVisible();
    asked = dismissNextDialog(page);
    const cancel = page.getByRole("button", { name: "Отмена" });
    await cancel.click();
    await asked;
    await expect(page.locator(".unit-edit")).toBeVisible();
    await expect(cancel).toBeFocused();
  });

  test("«Удалить список блока»: «Отмена», пока шёл запрос, — отказ строкой в полосе", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}?demo=fail`);
    // Ответ действия задерживается: «Отмена» успевает раньше.
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"])
        await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.getByRole("button", { name: "Удалить список блока" }).click();
    await page.getByLabel("Введите название блока: A").fill("A");
    await page.getByRole("button", { name: "Удалить список", exact: true }).click();
    await page.getByRole("button", { name: "Отмена" }).click();
    await expect(page.getByRole("button", { name: "Удалить список блока" })).toBeFocused();
    await expect(bar(page)).toContainText("Не удалили список блока.");
    await expect(bar(page)).toContainText("База не успела ответить");
  });

  test("док виден — у страницы отступ прокрутки: Tab не уводит фокус под панель", async ({
    page,
  }) => {
    await open(page);
    const padding = () => page.evaluate(() => document.documentElement.style.scrollPaddingBottom);
    expect(await padding()).toBe("");
    await check(page, "1").check();
    await expect
      .poll(padding)
      .toMatch(
        /calc\(min\(\d+(\.\d+)?px, var\(--units-dock-cover-max\)\) \+ var\(--units-dock-gap\)\)/,
      );
    await bulk(page).getByRole("button", { name: "Снять выделение" }).click();
    await expect.poll(padding).toBe("");
  });

  test("390: правка чётной и выбранной строки — во всю карточку, «Сохранить» над доком", async ({
    page,
  }) => {
    test.skip(!isMobile(page), "телефон");
    await open(page);
    await check(page, "2").check();
    await rowOf(page, "2")
      .getByRole("button", { name: /Статус и правка/ })
      .click();
    await page.getByRole("button", { name: "Изменить квартиру" }).click();
    const detail = page.locator(".unit-detail");
    // Базовый класс блока у зебры: без него раскрытие в карточке теряло вид блока.
    await expect(detail).toHaveClass(/(^|\s)unit-detail(\s|$)/);
    await expect(detail).toHaveClass(/unit-detail--alt/);
    await expect(detail).toHaveClass(/unit-detail--selected/);
    const card = (await rowOf(page, "2").boundingBox())!;
    const form = (await page.locator(".unit-edit").boundingBox())!;
    expect(form.width).toBeGreaterThan(card.width - 40);
    const save = page.getByRole("button", { name: "Сохранить" });
    await save.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => {
        const saveBox = (await save.boundingBox())!;
        const dockTop = (await bulk(page).boundingBox())!.y;
        return saveBox.y + saveBox.height <= dockTop;
      })
      .toBe(true);
  });

  test("390: галочка и кнопки ≥ 44 px, панель не закрывает последнюю карточку", async ({
    page,
  }) => {
    test.skip(!isMobile(page), "телефон");
    await open(page);
    const last = rows(page).last();
    await last.scrollIntoViewIfNeeded();
    const box = (await last.locator(".units-check").boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    await last.getByRole("checkbox").check();
    const action = (await bulk(page)
      .getByRole("button", { name: "Цена", exact: true })
      .boundingBox())!;
    expect(action.height).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const dockTop = (await bulk(page).boundingBox())!.y;
    const lastBox = (await last.boundingBox())!;
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(dockTop);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  });

  test("скриншоты: панель и цена, правка строки, «+ Квартира», удаление списка", async ({
    page,
  }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.clock.setFixedTime(new Date("2026-10-21T09:46:00Z"));
    await open(page);
    await check(page, "1").check();
    await check(page, "2").check();
    await step(page, "Цена");
    await bulk(page).getByText("за м²", { exact: true }).click();
    await bulk(page).getByLabel("Цена за м², $").fill("650");
    await page.screenshot({ caret: "initial", path: `${dir}/s12-bulk-price.png` });
    await bulk(page).getByRole("button", { name: "Снять выделение" }).click();
    await rowOf(page, "3")
      .getByRole("button", { name: /Статус и правка/ })
      .click();
    await page.getByRole("button", { name: "Изменить квартиру" }).click();
    await page.screenshot({ caret: "initial", path: `${dir}/s12-edit.png` });
    await page.getByRole("button", { name: "Отмена" }).click();
    await page.getByRole("button", { name: "+ Квартира" }).click();
    await page.getByRole("form", { name: "Новая квартира" }).scrollIntoViewIfNeeded();
    await page.screenshot({ caret: "initial", path: `${dir}/s12-add.png` });
    await page.getByRole("button", { name: "Удалить список блока" }).click();
    await page.getByLabel("Введите название блока: A").scrollIntoViewIfNeeded();
    await page.screenshot({ caret: "initial", path: `${dir}/s12-remove-list.png` });
  });
});
