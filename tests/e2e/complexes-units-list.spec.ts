import { expect, test, type Page, type Request } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 12.4: список квартир блока на стенде /dev/zhk (DEMO Shodlik: блок A — 88 квартир, свободных
// 12, брони 2). Список читается на клиенте отдельным действием; статус тапом с «Отменить» 5 с.
// DEMO не меняется: новое чтение возвращает исходные статусы. Сценарии стенда — ?demo=….

const SHODLIK = "/dev/zhk/00000000-0000-4000-8000-0000000000c1/kvartiry";
const BLOCK_B = "00000000-0000-4000-8000-0000000000b2";
const UNIT_ID = /00000001-0000-4000-8000-0000000000b1/;

const rows = (page: Page) => page.locator(".units-row");
const bar = (page: Page) => page.locator(".units-undo");
const pill = (page: Page, name: string) =>
  page.getByRole("group", { name: "Статус" }).getByRole("button", { name: new RegExp(`^${name}`) });
const statusButtons = (page: Page, status: string) =>
  page.getByRole("button", { name: new RegExp(`^Кв\\. .+, ${status}\\. Статус и правка$`) });
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 760;

async function open(page: Page, url: string = SHODLIK) {
  await page.goto(url);
  await expect(rows(page).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

/** Server Actions после загрузки списка: чтение, статус, «Отменить». */
function trackActions(page: Page) {
  const posts: Request[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) posts.push(request);
  });
  return posts;
}

async function openFilters(page: Page) {
  if (isMobile(page)) await page.getByRole("button", { name: /^Фильтры/ }).click();
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("кабинет · ЖК · список квартир", () => {
  let errors: string[];
  let allowed: RegExp | null;

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
    allowed = null;
  });

  test.afterEach(() => {
    expect(errors.filter((text) => !allowed?.test(text))).toEqual([]);
  });

  test("список не в HTML страницы: его читает экран, стояки — из прочитанного", async ({
    page,
  }) => {
    const html = await (await page.request.get(SHODLIK)).text();
    expect(html).not.toMatch(UNIT_ID);
    expect(html).not.toContain("updatedByName");
    await open(page);
    await expect(page.locator(".units-block__listed")).toContainText("список из 88 квартир");
    await expect(page.getByRole("button", { name: "Стояки · 4 строки" })).toBeVisible();
    await expect(rows(page)).toHaveCount(88);
  });

  test("строки по номерам, пилюли со счётчиками, фильтры складываются, «Сбросить»", async ({
    page,
  }) => {
    await open(page);
    await expect(rows(page).nth(0).locator(".units-row__number")).toHaveText("1");
    await expect(rows(page).nth(9).locator(".units-row__number")).toHaveText("10");
    for (const [name, count] of [
      ["Все", 88],
      ["Свободны", 12],
      ["Бронь", 2],
      ["Проданы", 74],
    ])
      await expect(pill(page, name as string)).toContainText(String(count));

    await pill(page, "Свободны").click();
    await expect(rows(page)).toHaveCount(12);
    await expect(statusButtons(page, "свободна")).toHaveCount(12);

    await openFilters(page);
    await page.getByRole("group", { name: "Подъезд" }).getByRole("button", { name: "1" }).click();
    // Фильтр применяется отложенно: счётчик сверяется со строками, когда они уже под него.
    const freeCount = async () =>
      Number((await pill(page, "Свободны").textContent())!.replace(/\D/g, ""));
    await expect.poll(freeCount).toBeLessThan(12);
    await expect.poll(async () => (await rows(page).count()) === (await freeCount())).toBe(true);
    // Счётчики — по остальным фильтрам: выбранная пилюля не обнуляет соседние.
    await expect(pill(page, "Все")).not.toContainText(/\b0\b/);
    if (isMobile(page))
      await expect(page.getByRole("button", { name: "Фильтры · 1" })).toBeVisible();

    await pill(page, "Все").click();
    await page.getByRole("spinbutton", { name: "Этаж от" }).fill("5");
    await page.getByRole("spinbutton", { name: "Этаж до" }).fill("6");
    await expect(rows(page)).toHaveCount(8);
    for (const floor of await rows(page).locator(".units-row__floor").allTextContents())
      expect(Number(floor.replace(/\D/g, ""))).toBeGreaterThanOrEqual(5);

    await page.getByLabel("Номер квартиры").fill("999");
    await expect(page.locator(".units-list__empty")).toContainText("Ничего не найдено.");
    await page.getByRole("button", { name: "Сбросить фильтры" }).click();
    await expect(rows(page)).toHaveCount(88);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("статус тапом: сразу в строке и счётчиках, один запрос, «Отменить» возвращает", async ({
    page,
  }) => {
    await open(page);
    const posts = trackActions(page);
    const button = statusButtons(page, "свободна").first();
    const label = (await button.getAttribute("aria-label"))!;
    const number = /^Кв\. (\S+),/.exec(label)![1]!;
    await button.click();
    const picker = page.getByRole("group", { name: `Статус кв. ${number}` });
    await expect(picker.getByRole("button", { name: "свободна" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await picker.getByRole("button", { name: "бронь" }).click();
    await expect(picker).toBeHidden();
    await expect(pill(page, "Свободны")).toContainText("11");
    await expect(pill(page, "Бронь")).toContainText("3");
    await expect(bar(page)).toContainText(`Кв. ${number}: свободна → бронь`);
    const changed = page.getByRole("button", { name: `Кв. ${number}, бронь. Статус и правка` });
    await expect(changed).toBeFocused();
    await expect(bar(page).getByRole("button", { name: /Отменить/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Страница перерисовалась (refresh, как updateTag), а список не перечитан: один запрос.
    await page.waitForLoadState("networkidle");
    expect(posts).toHaveLength(1);

    await bar(page)
      .getByRole("button", { name: /Отменить/ })
      .click();
    await expect(bar(page)).toContainText(`Вернули: кв. ${number} — свободна`);
    await expect(pill(page, "Свободны")).toContainText("12");
    await page.waitForLoadState("networkidle");
    expect(posts).toHaveLength(2);

    // Тот же статус — без запроса.
    await page.getByRole("button", { name: `Кв. ${number}, свободна. Статус и правка` }).click();
    await page
      .getByRole("group", { name: `Статус кв. ${number}` })
      .getByRole("button", { name: "свободна" })
      .click();
    await page.waitForLoadState("networkidle");
    expect(posts).toHaveLength(2);
  });

  test("строка со сменённым статусом остаётся под фильтром до смены фильтра", async ({ page }) => {
    await open(page);
    await pill(page, "Свободны").click();
    await expect(rows(page)).toHaveCount(12);
    await statusButtons(page, "свободна").first().click();
    await page.locator(".unit-status-picker").getByRole("button", { name: "продана" }).click();
    await expect(rows(page)).toHaveCount(12);
    await expect(pill(page, "Свободны")).toContainText("11");
    await pill(page, "Все").click();
    await pill(page, "Свободны").click();
    await expect(rows(page)).toHaveCount(11);
  });

  test("«Отменить» уходит через 5 с от ответа; наведение придерживает", async ({ page }) => {
    await page.clock.install();
    await open(page);
    await statusButtons(page, "свободна").first().click();
    await page.locator(".unit-status-picker").getByRole("button", { name: "бронь" }).click();
    await expect(bar(page)).toContainText("→ бронь");
    await expect(bar(page)).not.toContainText("Сохраняем");
    if (!isMobile(page)) {
      await bar(page).locator(".units-undo__card").hover();
      await page.clock.runFor(8000);
      await expect(bar(page)).toContainText("→ бронь");
    }
    // Указатель — не над полосой: после тапа он остаётся там, где была кнопка.
    // Точные 4,9 / 5,0 с — в юнит-тесте хука: здешние часы идут и сами, между шагами.
    await page.mouse.move(0, 0);
    await page.clock.runFor(5100);
    await expect(bar(page).locator(".units-undo__card")).toHaveCount(0);
  });

  test("после «Отменить» и «×» мышью полоса по-прежнему уходит сама через 5 с", async ({
    page,
  }) => {
    await page.clock.install();
    await open(page);
    const card = bar(page).locator(".units-undo__card");
    const tap = async (index: number) => {
      await statusButtons(page, "свободна").nth(index).click();
      await page.locator(".unit-status-picker").getByRole("button", { name: "бронь" }).click();
      await expect(bar(page)).toContainText("→ бронь");
      await expect(bar(page)).not.toContainText("Сохраняем");
    };
    await tap(0);
    await bar(page)
      .getByRole("button", { name: /Отменить/ })
      .click();
    await expect(bar(page)).toContainText("Вернули:");
    await page.mouse.move(0, 0);
    await page.clock.runFor(5100);
    await expect(card).toHaveCount(0);

    await tap(1);
    await bar(page).getByRole("button", { name: "Закрыть" }).click();
    await expect(card).toHaveCount(0);
    await tap(2);
    await page.mouse.move(0, 0);
    await page.clock.runFor(5100);
    await expect(card).toHaveCount(0);
  });

  test("отказ прежнего тапа не теряется ни за вторым тапом, ни при смене блока", async ({
    page,
  }) => {
    // Ответы действий — с задержкой: второй тап и переход успевают до ответа первого.
    await page.route(`**${SHODLIK}*`, async (route) => {
      if (route.request().method() === "POST")
        await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await open(page, `${SHODLIK}?demo=fail`);
    const numberOf = async (index: number) => {
      const label = await statusButtons(page, "свободна").nth(index).getAttribute("aria-label");
      return /^Кв\. (\S+),/.exec(label!)![1]!;
    };
    const [first, second] = [await numberOf(0), await numberOf(1)];
    for (const number of [first, second]) {
      await page.getByRole("button", { name: `Кв. ${number}, свободна. Статус и правка` }).click();
      await page.locator(".unit-status-picker").getByRole("button", { name: "продана" }).click();
    }
    await expect(bar(page)).toContainText(`Не сохранили кв. ${second}.`);
    await expect(bar(page).locator(".units-undo__lost")).toContainText(
      `Не сохранили кв. ${first}.`,
    );

    await page.getByRole("button", { name: "Закрыть" }).click();
    await statusButtons(page, "свободна").first().click();
    await page.locator(".unit-status-picker").getByRole("button", { name: "бронь" }).click();
    await page
      .getByRole("navigation", { name: "Блок" })
      .getByRole("link", { name: /Блок B/ })
      .click();
    await expect(pill(page, "Свободны")).toContainText("29");
    await expect(bar(page)).toContainText(`Блок A · Не сохранили кв. ${first}.`);
  });

  test("клавиатура: Enter открывает выбор, Esc закрывает, фокус — на плашке; Ctrl+Z", async ({
    page,
  }) => {
    test.skip(isMobile(page), "клавиатура — на десктопе");
    await open(page);
    const sold = statusButtons(page, "продана").first();
    const number = /^Кв\. (\S+),/.exec((await sold.getAttribute("aria-label"))!)![1]!;
    await sold.focus();
    await page.keyboard.press("Enter");
    const picker = page.getByRole("group", { name: `Статус кв. ${number}` });
    await expect(picker.getByRole("button", { name: "свободна" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(sold).toBeFocused();

    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(picker.getByRole("button", { name: "бронь" })).toBeFocused();
    await page.keyboard.press("Enter");
    const reserved = page.getByRole("button", { name: `Кв. ${number}, бронь. Статус и правка` });
    await expect(reserved).toBeFocused();
    await expect(bar(page)).toContainText(`Кв. ${number}: продана → бронь`);
    await expect(bar(page)).not.toContainText("Сохраняем");
    await page.keyboard.press("Control+z");
    await expect(bar(page)).toContainText(`Вернули: кв. ${number} — продана`);
  });

  test("отказ базы — откат и причина; гонка — предупреждение, «Отменить» не трогает чужое", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}?demo=fail`);
    await statusButtons(page, "свободна").first().click();
    await page.locator(".unit-status-picker").getByRole("button", { name: "продана" }).click();
    await expect(bar(page)).toContainText("Не сохранили кв.");
    await expect(bar(page)).toContainText("База не успела ответить");
    await expect(pill(page, "Свободны")).toContainText("12");

    await open(page, `${SHODLIK}?demo=conflict`);
    const button = statusButtons(page, "свободна").first();
    const number = /^Кв\. (\S+),/.exec((await button.getAttribute("aria-label"))!)![1]!;
    await button.click();
    await page.locator(".unit-status-picker").getByRole("button", { name: "бронь" }).click();
    await expect(bar(page)).toContainText(`Кв. ${number}: в базе было «продана»`);
    await bar(page)
      .getByRole("button", { name: /Отменить/ })
      .click();
    await expect(bar(page)).toContainText(`Не вернули № ${number}`);
  });

  test("ошибка чтения — «Повторить»", async ({ page }) => {
    allowed = /Failed to load resource|ERR_FAILED|Failed to fetch/;
    let fail = true;
    await page.route(`**${SHODLIK}`, (route) =>
      route.request().method() === "POST" && fail ? route.abort() : route.continue(),
    );
    await page.goto(SHODLIK);
    await expect(page.locator(".units-block__failed")).toContainText(
      "Список квартир не загрузился.",
    );
    await expect(page.locator(".units-block__failed")).toContainText("Нет связи с сервером");
    fail = false;
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect(rows(page)).toHaveCount(88);
  });

  test("возврат на вкладку через 10 с и больше — список перечитывается", async ({ page }) => {
    await page.clock.install();
    await open(page);
    const button = statusButtons(page, "свободна").first();
    const number = /^Кв\. (\S+),/.exec((await button.getAttribute("aria-label"))!)![1]!;
    await button.click();
    await page.locator(".unit-status-picker").getByRole("button", { name: "продана" }).click();
    await expect(
      page.getByRole("button", { name: `Кв. ${number}, продана. Статус и правка` }),
    ).toBeVisible();
    const visibility = (state: "hidden" | "visible") =>
      page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", { value, configurable: true });
        Object.defineProperty(document, "hidden", {
          value: value === "hidden",
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);
    await visibility("hidden");
    await page.clock.runFor(11_000);
    await visibility("visible");
    // DEMO не меняется: новое чтение вернуло исходный статус.
    await expect(
      page.getByRole("button", { name: `Кв. ${number}, свободна. Статус и правка` }),
    ).toBeVisible();
  });

  test("блок A → B → A: свой список у каждого; полоса одна на вкладку — с названием блока", async ({
    page,
  }) => {
    await page.clock.install();
    await open(page);
    const button = statusButtons(page, "свободна").first();
    const number = /^Кв\. (\S+),/.exec((await button.getAttribute("aria-label"))!)![1]!;
    await button.click();
    await page.locator(".unit-status-picker").getByRole("button", { name: "бронь" }).click();
    await expect(bar(page)).toContainText(`Кв. ${number}: свободна → бронь`);
    const switcher = page.getByRole("navigation", { name: "Блок" });
    await switcher.getByRole("link", { name: /Блок B/ }).click();
    await expect(pill(page, "Свободны")).toContainText("29");
    await expect(bar(page)).toContainText(`Блок A · Кв. ${number}: свободна → бронь`);
    await switcher.getByRole("link", { name: /Блок A/ }).click();
    // Список A прочитан заново: DEMO не меняется — квартира снова свободна.
    await expect(pill(page, "Свободны")).toContainText("12");
    await expect(bar(page)).not.toContainText("Блок A ·");
  });

  test("список удалили, пока страница была открыта, — «обновите страницу», а не «ничего не найдено»", async ({
    page,
  }) => {
    await page.goto(`${SHODLIK}?demo=empty`);
    await expect(page.locator(".units-block__failed")).toContainText("В блоке больше нет квартир");
    await expect(page.getByRole("button", { name: "Обновить страницу" })).toBeVisible();
    await expect(page.locator(".units-list__empty")).toHaveCount(0);
  });

  test("variety: номера с буквами, цена за м², без планировки, своя отделка, сумы", async ({
    page,
  }) => {
    await open(page, `${SHODLIK}?demo=variety`);
    for (const query of ["12а", "12a", "12А"]) {
      await page.getByLabel("Номер квартиры").fill(query);
      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first().locator(".units-row__number")).toHaveText("12А");
    }
    await page.getByLabel("Номер квартиры").fill("");
    await expect(rows(page).nth(10).locator(".units-row__number")).toHaveText("11");
    await expect(rows(page).nth(11).locator(".units-row__number")).toHaveText("12А");
    await expect(page.locator(".units-row__finishing--inherited").first()).toContainText(
      "Черновая · как в блоке",
    );
    await expect(
      page.locator(".units-row__finishing", { hasText: "Под ключ" }).first(),
    ).toBeVisible();
    await expect(page.locator(".units-row__per-m2", { hasText: "$650/м²" }).first()).toBeVisible();
    await expect(page.locator(".units-row__layout--none").first()).toHaveText("без планировки");
    await openFilters(page);
    await expect(page.getByRole("group", { name: "Комнаты" })).toContainText("без пл.");

    // Переключатель блоков сохраняет сценарий стенда.
    await page
      .getByRole("navigation", { name: "Блок" })
      .getByRole("link", { name: /Блок B/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`blok=${BLOCK_B}&demo=variety`));
    await expect(page.locator(".units-row__total").first()).toContainText("сум");
    await expect(page.locator(".units-row__per-m2", { hasText: "сум/м²" }).first()).toBeVisible();
  });

  test("1440: «Обновлено» — когда и кто", async ({ page }) => {
    test.skip(isMobile(page), "колонка «Обновлено» — на широком экране");
    await page.clock.setFixedTime(new Date("2026-10-21T09:46:00Z"));
    await open(page);
    const sold = rows(page)
      .filter({ has: statusButtons(page, "продана") })
      .first();
    await expect(sold.locator(".units-row__updated")).toHaveText("5 мин назад · Дилноза Юсупова");
    const free = rows(page)
      .filter({ has: statusButtons(page, "свободна") })
      .first();
    await expect(free.locator(".units-row__updated")).toHaveText("5 мин назад");
  });

  test("390: карточка в две строки, плашка ≥ 44 px, полоса не закрывает последнюю карточку", async ({
    page,
  }) => {
    test.skip(!isMobile(page), "телефон");
    await open(page);
    expect(
      await rows(page)
        .first()
        .evaluate((row) => getComputedStyle(row).display),
    ).toBe("flex");
    const box = (await statusButtons(page, "продана").first().boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(rows(page).first()).toContainText("под. 1");
    await expect(page.getByLabel("Номер квартиры")).toBeVisible();
    await expect(page.getByRole("group", { name: "Подъезд" })).toBeHidden();

    const last = rows(page).last();
    await last.scrollIntoViewIfNeeded();
    await last.getByRole("button", { name: /Статус и правка/ }).click();
    await page.locator(".unit-status-picker").getByRole("button", { name: "бронь" }).click();
    await expect(bar(page)).toContainText("→ бронь");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const barTop = (await bar(page).locator(".units-undo__card").boundingBox())!.y;
    const lastBottom = (await last.boundingBox())!;
    expect(lastBottom.y + lastBottom.height).toBeLessThanOrEqual(barTop);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("5000 квартир: порция 200 строк, «Показать ещё», поиск", async ({ page }, testInfo) => {
    await open(page, `${SHODLIK}?demo=big`);
    // Числа в текстах — с разрядами («5 000», неразрывный пробел).
    await expect(page.locator(".units-block__listed")).toContainText(/5\s000 квартир/);
    await expect(rows(page)).toHaveCount(200);
    await expect(page.locator(".units-list__summary")).toHaveText(/^Показано 200 из 5\s000$/);
    await page.getByRole("button", { name: "Показать ещё 200" }).click();
    await expect(rows(page)).toHaveCount(400);
    const started = Date.now();
    await page.getByLabel("Номер квартиры").fill("4999");
    await expect(rows(page)).toHaveCount(1);
    testInfo.annotations.push({ type: "поиск в 5000", description: `${Date.now() - started} мс` });
  });

  test("скриншоты: список, выбор статуса и полоса, фильтры, тёмная тема", async ({
    page,
  }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.clock.setFixedTime(new Date("2026-10-21T09:46:00Z"));
    await open(page);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/s12-list.png`, fullPage: false });
    await statusButtons(page, "свободна").first().click();
    await page.locator(".unit-status-picker").getByRole("button", { name: "бронь" }).click();
    await statusButtons(page, "продана").nth(2).click();
    await expect(bar(page)).not.toContainText("Сохраняем");
    await page.screenshot({ path: `${dir}/s12-status.png`, fullPage: false });
    if (isMobile(page)) {
      await open(page);
      await openFilters(page);
      await page.screenshot({ path: `${dir}/s12-list-filters.png`, fullPage: false });
    }
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });
    await page.screenshot({ path: `${dir}/s12-list-dark.png`, fullPage: false });
  });

  // Ноутбук 1366 и 1280 — таблица: «Планировке» остаётся место, строка не рвётся по буквам
  // (с полосой прокрутки Windows контейнер на ~15 px уже). 1024 с меню — контейнер ~670: карточки.
  for (const [width, view] of [
    [1366, "table"],
    [1280, "table"],
    [1024, "cards"],
  ] as const) {
    test(`ширина ${width}: ${view === "table" ? "«Планировка» не уже 120 px" : "карточки"}`, async ({
      page,
    }, testInfo) => {
      test.skip(isMobile(page), "десктоп");
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      if (view === "table") {
        const th = page.locator(".units-list__th--layout");
        expect(await th.evaluate((element) => element.clientWidth - 15)).toBeGreaterThanOrEqual(
          120,
        );
      } else {
        expect(
          await rows(page)
            .first()
            .evaluate((row) => getComputedStyle(row).display),
        ).toBe("flex");
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `test-results/screens/${testInfo.project.name}/s12-list-${width}.png`,
      });
    });
  }
});
