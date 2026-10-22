import { expect, test, type Page, type Request } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 13: главная кабинета «Остатки по ЖК» на стендах /dev/glavnaya (руководитель) и
// /dev/menedzher/glavnaya (менеджер). DEMO — как сид: на сайте Shodlik 41 (Бл. A 12 · Бл. B 29),
// Namuna 65, Yulduz 43, Orzu 27 = 176; Gulzor (черновик), Bahor (застройщик не опубликован) и Lola
// (архив) не на сайте (Г2 A). Сценарии ?demo=: change — следующее чтение видит Shodlik 40 и Orzu 28;
// fail — чтение не удаётся; session — сессия кончилась; empty — на сайте нет ЖК; variety и
// layouts — редкие случаи (lib/admin/home/demo.ts).

const HEAD = "/dev/glavnaya";
const MANAGER = "/dev/menedzher/glavnaya";
const SHODLIK_ID = "00000000-0000-4000-8000-0000000000c1";

const rows = (page: Page) => page.locator(".site-stock-row");
const toggle = (page: Page, name: string) =>
  page.locator(".site-stock-row__toggle", { hasText: `ЖК ${name}` });
const rowOf = (page: Page, name: string) =>
  rows(page).filter({ has: page.locator(".site-stock-row__name", { hasText: `ЖК ${name}` }) });
const details = (page: Page, name: string) => rowOf(page, name).locator(".site-stock-details");
const badge = (page: Page, name: string) => rowOf(page, name).locator(".stock-badge");
const live = (page: Page) => page.locator(".live-status");
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 760;
// «Запроса не было» проверяется после паузы: событие запроса доходит до теста не сразу.
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function open(page: Page, url: string = HEAD) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Остатки по ЖК" })).toBeVisible();
  // После гидратации: и клики, и скриншоты (screenshot прячет курсор стилем — до гидратации
  // React заметил бы чужой атрибут).
  await page.waitForLoadState("networkidle");
}

/** Server Actions — чтения «live»; слушать до перехода, чтобы поймать и чтение при загрузке. */
function trackActions(page: Page) {
  const posts: Request[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) posts.push(request);
  });
  return posts;
}

const visibility = (page: Page, state: "hidden" | "visible") =>
  page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", { value, configurable: true });
    Object.defineProperty(document, "hidden", { value: value === "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

test.describe("кабинет · главная · остатки по ЖК", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("только ЖК на сайте, в порядке каталога; итог 176 крупно; LIVE", async ({ page }) => {
    await open(page);
    await expect(page.locator(".site-stock-row__name")).toHaveText([
      "ЖК Shodlik",
      "ЖК Namuna",
      "ЖК Yulduz",
      "ЖК Orzu",
    ]);
    for (const hidden of ["Gulzor", "Bahor", "Lola"])
      await expect(toggle(page, hidden)).toHaveCount(0);
    await expect(page.locator(".site-stock__total-value")).toHaveText("176");
    await expect(page.locator(".site-stock__total-caption")).toHaveText(
      "свободных квартир на сайте · в 4 ЖК",
    );
    await expect(rowOf(page, "Shodlik").locator(".stock-rooms")).toHaveText("1к 14 · 2к 22 · 3к 5");
    await expect(badge(page, "Shodlik")).toHaveText("свободно 41");
    await expect(live(page)).not.toHaveClass(/live-status--stale/);
    await expect(live(page).locator(".live-status__label")).toHaveText("live");
    await expect(live(page).getByText("Цифры обновляются сами раз в минуту.")).toBeAttached();
    await expect(page.locator(".site-stock__footnote")).toHaveCount(0);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("тап раскрывает строку на месте (Г3 B): типы с «от», блоки, «Квартиры →»; открыта одна", async ({
    page,
  }) => {
    await open(page);
    await expect(details(page, "Shodlik")).toBeHidden();
    await toggle(page, "Shodlik").click();
    await expect(toggle(page, "Shodlik")).toHaveAttribute("aria-expanded", "true");
    const shodlik = details(page, "Shodlik");
    await expect(shodlik.locator(".site-stock-details__offer")).toHaveText([
      /^1-комн\.\s*14\s*от \$30\s290\s*от 42,5 м²$/,
      /^2-комн\.\s*22\s*от \$40\s270\s*от 58,7 м²$/,
      /^3-комн\.\s*5\s*от \$54\s930\s*от 78 м²$/,
    ]);
    await expect(shodlik.locator(".site-stock-details__blocks")).toHaveText(
      "Бл. A: 12 · Бл. B: 29",
    );
    await expect(shodlik.getByRole("link", { name: "Квартиры" })).toHaveAttribute(
      "href",
      `/dev/zhk/${SHODLIK_ID}/kvartiry`,
    );

    await toggle(page, "Namuna").click();
    await expect(toggle(page, "Shodlik")).toHaveAttribute("aria-expanded", "false");
    await expect(shodlik).toBeHidden();
    await expect(details(page, "Namuna").locator(".site-stock-details__offer").first()).toHaveText(
      /^Студия\s*13\s*от \$33\s720\s*от 34,2 м²$/,
    );
    await toggle(page, "Namuna").click();
    await expect(page.locator(".site-stock-row__toggle[aria-expanded='true']")).toHaveCount(0);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("менеджер: та же панель, «Квартиры →» — на «Квартиры» стенда менеджера", async ({
    page,
  }) => {
    await open(page, MANAGER);
    await expect(page.locator(".site-stock__total-value")).toHaveText("176");
    await toggle(page, "Shodlik").click();
    const link = details(page, "Shodlik").getByRole("link", { name: "Квартиры" });
    await expect(link).toHaveAttribute("href", `/dev/menedzher/zhk/${SHODLIK_ID}/kvartiry`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/dev/menedzher/zhk/${SHODLIK_ID}/kvartiry$`));
    await expect(page.locator(".units-row").first()).toBeVisible();
  });

  test("редкие случаи: «N+» с известной частью, две валюты, «цена по запросу», янтарь, без планировки", async ({
    page,
  }) => {
    await open(page, `${HEAD}?demo=variety`);
    await expect(page.locator(".site-stock__total-value")).toHaveText("114+");
    await expect(page.locator(".site-stock__total-caption")).toHaveText(
      "свободных квартир на сайте · в 4 ЖК · ещё 14 без планировки",
    );
    await expect(page.locator(".site-stock-row .stock-badge")).toHaveText([
      "свободно 41",
      "свободно 65+",
      "без планировки 12",
      "свободно 8",
    ]);
    await expect(badge(page, "Orzu")).toHaveClass(/badge--amber/);
    await expect(badge(page, "Yulduz")).toHaveClass(/badge--amber/);
    await expect(rowOf(page, "Namuna").locator(".stock-rooms")).toContainText("2к 18+");
    await expect(page.locator(".site-stock__footnote")).toContainText("«N+», «✓» и «по планировкам»");

    await toggle(page, "Namuna").click();
    const namuna = details(page, "Namuna");
    await expect(namuna.locator(".site-stock-details__offer").nth(2)).toHaveText(
      /^2-комн\.\s*18\+\s*от \$70\s290 · от 640\s000\s000\sсум\s*от 68 м²$/,
    );
    await expect(namuna.locator(".site-stock-details__blocks")).toHaveText(
      "Бл. 1: 65 · Бл. 2: по планировкам",
    );
    await toggle(page, "Orzu").click();
    await expect(details(page, "Orzu").locator(".site-stock-details__offer").last()).toHaveText(
      /^3-комн\.\s*2\s*цена по запросу\s*от 88 м²$/,
    );
    await toggle(page, "Yulduz").click();
    const yulduz = details(page, "Yulduz");
    await expect(yulduz).toContainText(
      "Типов пока нет: у свободных квартир не назначены планировки.",
    );
    await expect(yulduz.locator(".site-stock-details__note")).toHaveText(
      "Ещё 12 свободных квартир без планировки — в типах и «свободно» не учтены.",
    );
    await toggle(page, "Shodlik").click();
    await expect(details(page, "Shodlik").locator(".site-stock-details__note")).toHaveText(
      "Ещё 2 свободные квартиры без планировки — в типах и «свободно» не учтены.",
    );
  });

  test("все блоки по планировкам: итог словами, а не «0+»", async ({ page }) => {
    await open(page, `${HEAD}?demo=layouts`);
    await expect(page.locator(".site-stock__total-value")).toHaveText("по планировкам");
    await expect(page.locator(".site-stock__total-caption")).toHaveText(
      "числа нет: у блоков нет списка квартир · 4 ЖК на сайте",
    );
    await expect(badge(page, "Shodlik")).toHaveText("по планировкам");
  });

  test("свободные только без планировки: итог — их число с пояснением, а не «0»", async ({
    page,
  }) => {
    await open(page, `${HEAD}?demo=unassigned`);
    await expect(page.locator(".site-stock__total-value")).toHaveText("176");
    await expect(page.locator(".site-stock__total-caption")).toHaveText(
      "свободных квартир без планировки — по типам пока не посчитать · в 4 ЖК",
    );
    await expect(badge(page, "Shodlik")).toHaveText("без планировки 41");
  });

  test("live: первое чтение через минуту, дальше — раз в минуту, пока вкладка видна; возврат — сразу; вспышка", async ({
    page,
  }) => {
    await page.clock.install();
    const posts = trackActions(page);
    await open(page, `${HEAD}?demo=change`);
    await page.clock.runFor(45_000);
    await settle();
    expect(posts).toHaveLength(0);
    await page.clock.runFor(20_000);
    await expect.poll(() => posts.length).toBe(1);
    await expect(badge(page, "Shodlik")).toHaveText(/^свободно 40/);
    await expect(badge(page, "Shodlik")).toHaveClass(/stock-badge--flash/);
    await expect(badge(page, "Orzu")).toHaveClass(/stock-badge--flash/);
    await expect(badge(page, "Namuna")).not.toHaveClass(/--flash/);
    await expect(page.locator(".site-stock__total-value")).toHaveText("176");

    await visibility(page, "hidden");
    await page.clock.runFor(180_000);
    await settle();
    expect(posts).toHaveLength(1);
    await visibility(page, "visible");
    await expect.poll(() => posts.length).toBe(2);
    await expect(live(page)).not.toHaveClass(/live-status--stale/);
  });

  test("вспышка не повторяется, когда на главную вернулись «назад» (Activity)", async ({
    page,
  }) => {
    await page.clock.install();
    await open(page, `${HEAD}?demo=change`);
    await page.clock.runFor(65_000);
    await expect(badge(page, "Shodlik")).toHaveClass(/--flash/);
    await toggle(page, "Shodlik").click();
    await details(page, "Shodlik").getByRole("link", { name: "Квартиры" }).click();
    await expect(page.locator(".units-row").first()).toBeVisible();
    await page.goBack();
    await expect(badge(page, "Shodlik")).toHaveText("свободно 40");
    await expect(page.locator(".stock-badge--flash")).toHaveCount(0);
  });

  test("вернулись ссылкой — свежие цифры страницы: сменившиеся вспыхивают (и в разработке)", async ({
    page,
  }) => {
    await page.clock.install();
    const posts = trackActions(page);
    await open(page, `${HEAD}?demo=change`);
    await page.clock.runFor(65_000);
    await expect(badge(page, "Shodlik")).toHaveText(/^свободно 40/);
    await toggle(page, "Shodlik").click();
    await details(page, "Shodlik").getByRole("link", { name: "Квартиры" }).click();
    await expect(page.locator(".units-row").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    // «Квартиры» читают список своим действием — считаем только запросы после возврата.
    const before = posts.length;
    // Переход ссылкой (не «назад»): сервер заново читает страницу — у стенда это цифры сида.
    await page.evaluate(() =>
      (
        window as unknown as { next: { router: { push: (href: string) => void } } }
      ).next.router.push("/dev/glavnaya?demo=change"),
    );
    await expect(badge(page, "Shodlik")).toHaveText(/^свободно 41/);
    await expect(badge(page, "Shodlik")).toHaveClass(/stock-badge--flash/);
    // Свежие цифры пришли со страницей — повторного чтения действием нет.
    await settle();
    expect(posts).toHaveLength(before);
  });

  test("ЖК сняли с сайта: строка уходит, фокус из неё — на заголовок панели", async ({ page }) => {
    test.skip(isMobile(page), "клавиатура — десктоп");
    await page.clock.install();
    await open(page, `${HEAD}?demo=unpublished`);
    await toggle(page, "Orzu").focus();
    await page.clock.runFor(65_000);
    await expect(toggle(page, "Orzu")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Остатки по ЖК" })).toBeFocused();
  });

  test("сбой: метка гаснет, цифры прежние, «обновлено N мин назад»; строки не сдвигаются", async ({
    page,
  }) => {
    await page.clock.install();
    await open(page, `${HEAD}?demo=fail`);
    const top = async () => (await toggle(page, "Shodlik").boundingBox())!.y;
    const before = await top();
    await expect(live(page).getByRole("status")).toHaveText("");
    await page.clock.runFor(65_000);
    await expect(live(page)).toHaveClass(/live-status--stale/);
    await expect(live(page).getByRole("status")).toHaveText(
      "Остатки не обновились — на экране прежние цифры. Попробуем снова через минуту.",
    );
    await page.clock.runFor(180_000);
    await expect(live(page).locator(".live-status__label")).toHaveText(/^обновлено \d мин назад$/);
    await expect(page.locator(".site-stock__total-value")).toHaveText("176");
    expect(await top()).toBe(before);
  });

  test("сессия закончилась: «Войти», без «попробуем снова»; таймер стоит, возврат на вкладку пробует", async ({
    page,
  }) => {
    await page.clock.install();
    const posts = trackActions(page);
    await open(page, `${HEAD}?demo=session`);
    const top = async () => (await toggle(page, "Shodlik").boundingBox())!.y;
    const before = await top();
    await page.clock.runFor(65_000);
    await expect(live(page).locator(".live-status__label")).toContainText("сессия закончилась");
    const signIn = live(page).getByRole("link", { name: "Войти" });
    await expect(signIn).toHaveAttribute("href", "/admin/vhod");
    expect(await top()).toBe(before);
    if (isMobile(page)) {
      // Палец: цель 44 px — невидимый слой вокруг ссылки, строка от него не растёт.
      const box = (await signIn.boundingBox())!;
      const hit = (dy: number) =>
        page.evaluate(
          ([x, y]) => document.elementFromPoint(x!, y!)?.closest("a")?.textContent ?? null,
          [box.x + box.width / 2, box.y + box.height / 2 + dy],
        );
      expect(await hit(-18)).toBe("Войти");
      expect(await hit(18)).toBe("Войти");
    }
    await expect(live(page).getByRole("status")).toHaveText(
      "Сессия закончилась — остатки больше не обновляются. Войдите снова.",
    );
    await page.clock.runFor(180_000);
    await settle();
    expect(posts).toHaveLength(1);
    await visibility(page, "hidden");
    await visibility(page, "visible");
    await expect.poll(() => posts.length).toBe(2);
  });

  test("на сайте нет ЖК — пустое состояние, без итога", async ({ page }) => {
    await open(page, `${HEAD}?demo=empty`);
    await expect(page.locator(".site-stock__empty")).toHaveText(
      "На сайте пока нет ЖК — здесь появятся опубликованные ЖК опубликованных застройщиков.",
    );
    await expect(page.locator(".site-stock__total")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(0);
  });

  test("телефон (Г5 C): строка компактная, город и застройщик — в раскрытии, цели 44 px", async ({
    page,
  }) => {
    test.skip(!isMobile(page), "раскладка телефона");
    await open(page);
    const button = toggle(page, "Shodlik");
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeLessThanOrEqual(72);
    await expect(rowOf(page, "Shodlik").locator(".site-stock-row__meta")).toBeHidden();
    await button.click();
    await expect(details(page, "Shodlik").locator(".site-stock-details__where")).toHaveText(
      "Фергана · Farg‘ona Sifat Qurilish",
    );
    const link = details(page, "Shodlik").getByRole("link", { name: "Квартиры" });
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("средние ширины: таблица типов не наезжает на блоки, название не сжато комнатами", async ({
    page,
  }) => {
    test.skip(isMobile(page), "ширины десктопа");
    await page.setViewportSize({ width: 1024, height: 900 });
    await open(page, `${HEAD}?demo=variety`);
    await toggle(page, "Namuna").click();
    const namuna = details(page, "Namuna");
    // Края ячеек, а не списка: вылезающая таблица рамку списка не растягивает.
    const cells = namuna.locator(
      ".site-stock-details__type, .site-stock-details__free, .site-stock-details__price, .site-stock-details__area",
    );
    const types = await cells.evaluateAll((elements) => {
      const boxes = elements.map((element) => element.getBoundingClientRect());
      return {
        right: Math.max(...boxes.map((box) => box.right)),
        bottom: Math.max(...boxes.map((box) => box.bottom)),
      };
    });
    const blocks = (await namuna.locator(".site-stock-details__blocks").boundingBox())!;
    const panel = (await page.locator(".site-stock").boundingBox())!;
    expect(blocks.x >= types.right || blocks.y >= types.bottom).toBe(true);
    expect(types.right).toBeLessThanOrEqual(panel.x + panel.width);

    await page.setViewportSize({ width: 660, height: 900 });
    await expect(rowOf(page, "Namuna").locator(".site-stock-row__meta")).toBeHidden();
    const name = (await rowOf(page, "Namuna").locator(".site-stock-row__main").boundingBox())!;
    expect(name.width).toBeGreaterThan(200);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("анимации: пульс точки и вздрагивание пилюли — только full; в lite — только угасание", async ({
    page,
  }) => {
    const ping = () =>
      page
        .locator(".live-status__dot")
        .evaluate((element) => getComputedStyle(element, "::after").animationName);
    const pop = () =>
      badge(page, "Shodlik").evaluate((element) => getComputedStyle(element).animationName);
    const fade = () =>
      badge(page, "Shodlik")
        .locator(".stock-badge__flash")
        .evaluate((element) => getComputedStyle(element).animationName);
    await page.clock.install();
    await open(page, `${HEAD}?demo=change&motion=full`);
    expect(await ping()).toBe("live-status-ping");
    await page.clock.runFor(65_000);
    await expect(badge(page, "Shodlik")).toHaveClass(/--flash/);
    expect(await pop()).toBe("stock-badge-pop");
    expect(await fade()).toBe("stock-badge-fade");
    await open(page, `${HEAD}?demo=change&motion=lite`);
    expect(await ping()).toBe("none");
    await page.clock.runFor(65_000);
    await expect(badge(page, "Shodlik")).toHaveClass(/--flash/);
    expect(await pop()).toBe("none");
    expect(await fade()).toBe("stock-badge-fade");
  });

  test("клавиатура: Tab до строки, Enter раскрывает, Tab — к «Квартиры →»", async ({ page }) => {
    test.skip(isMobile(page), "клавиатура — десктоп");
    await open(page);
    await toggle(page, "Shodlik").focus();
    await page.keyboard.press("Enter");
    await expect(toggle(page, "Shodlik")).toHaveAttribute("aria-expanded", "true");
    await expect(toggle(page, "Shodlik")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(details(page, "Shodlik").getByRole("link", { name: "Квартиры" })).toBeFocused();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`скриншоты главной · ${theme}`, async ({ page }, testInfo) => {
      const dir = `test-results/screens/${testInfo.project.name}`;
      const suffix = theme === "dark" ? "-dark" : "";
      // Раскрытие и уход наведения — без середины перехода на снимке.
      const shoot = (name: string) =>
        page.screenshot({ path: `${dir}/${name}.png`, fullPage: true, animations: "disabled" });
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      await page.clock.setFixedTime(new Date("2026-10-22T09:46:00Z"));
      await open(page);
      await page.evaluate(() => document.fonts.ready);
      await shoot(`s13-home${suffix}`);
      await toggle(page, "Shodlik").click();
      await expect(details(page, "Shodlik")).toBeVisible();
      await page.mouse.move(0, 0);
      await shoot(`s13-home-open${suffix}`);
      if (theme === "dark") return;
      await open(page, `${HEAD}?demo=variety`);
      await toggle(page, "Namuna").click();
      await page.mouse.move(0, 0);
      await shoot("s13-home-variety");
      await open(page, `${HEAD}?demo=layouts`);
      await shoot("s13-home-layouts");
      await open(page, MANAGER);
      await shoot("s13-home-manager");
      await open(page, `${HEAD}?demo=empty`);
      await shoot("s13-home-empty");
    });

    test(`скриншоты: сбой и вспышка · ${theme}`, async ({ page }, testInfo) => {
      const dir = `test-results/screens/${testInfo.project.name}`;
      const suffix = theme === "dark" ? "-dark" : "";
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      await page.clock.install({ time: new Date("2026-10-22T09:46:00Z") });
      await open(page, `${HEAD}?demo=fail`);
      await page.clock.runFor(185_000);
      await expect(live(page)).toHaveClass(/live-status--stale/);
      await page.screenshot({ path: `${dir}/s13-home-stale${suffix}.png` });
      await open(page, `${HEAD}?demo=change&motion=full`);
      await page.clock.runFor(65_000);
      await expect(badge(page, "Shodlik")).toHaveClass(/--flash/);
      await page.screenshot({ path: `${dir}/s13-home-flash${suffix}.png` });
    });
  }
});
