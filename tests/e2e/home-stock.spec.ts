import { expect, test, type Page, type Request } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 13: главная кабинета «Остатки по ЖК» на стендах /dev/glavnaya (руководитель) и
// /dev/menedzher/glavnaya (менеджер). DEMO — как сид: на сайте Shodlik 41 (Бл. A 12 · Бл. B 29),
// Namuna 65, Yulduz 43, Orzu 27 = 176; Gulzor (черновик), Bahor (застройщик не опубликован) и Lola
// (архив) не на сайте (Г2 A). Сценарии ?demo=: change — следующее чтение видит Shodlik 40 и Orzu 28;
// fail — чтение не удаётся; empty — на сайте нет ЖК; variety — редкие случаи.

const HEAD = "/dev/glavnaya";
const MANAGER = "/dev/menedzher/glavnaya";
const SHODLIK_ID = "00000000-0000-4000-8000-0000000000c1";

const rows = (page: Page) => page.locator(".site-stock-row");
const toggle = (page: Page, name: string) =>
  page.locator(".site-stock-row__toggle", { hasText: `ЖК ${name}` });
const rowOf = (page: Page, name: string) =>
  rows(page).filter({ has: page.locator(".site-stock-row__name", { hasText: `ЖК ${name}` }) });
const details = (page: Page, name: string) => rowOf(page, name).locator(".site-stock-row__details");
const live = (page: Page) => page.locator(".live-status");
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 760;

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function open(page: Page, url: string = HEAD) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Остатки по ЖК" })).toBeVisible();
  // После гидратации: и клики, и скриншоты (screenshot прячет курсор стилем — до гидратации
  // React заметил бы чужой атрибут).
  await page.waitForLoadState("networkidle");
}

/** Server Actions после загрузки страницы — чтения «live». */
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
    await expect(rowOf(page, "Shodlik").locator(".stock-badge")).toHaveText("свободно 41");
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
    await expect(shodlik.locator(".site-stock-row__offer")).toHaveText([
      /^1-комн\.\s*14\s*от \$30\s290\s*от 42,5 м²$/,
      /^2-комн\.\s*22\s*от \$40\s270\s*от 58,7 м²$/,
      /^3-комн\.\s*5\s*от \$54\s930\s*от 78 м²$/,
    ]);
    await expect(shodlik.locator(".site-stock-row__blocks")).toHaveText("Бл. A: 12 · Бл. B: 29");
    await expect(shodlik.getByRole("link", { name: "Квартиры" })).toHaveAttribute(
      "href",
      `/dev/zhk/${SHODLIK_ID}/kvartiry`,
    );

    await toggle(page, "Namuna").click();
    await expect(toggle(page, "Shodlik")).toHaveAttribute("aria-expanded", "false");
    await expect(shodlik).toBeHidden();
    await expect(details(page, "Namuna").locator(".site-stock-row__offer").first()).toHaveText(
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

  test("редкие случаи: «N+» и «по планировкам», две валюты, «цена по запросу», янтарь, распродан", async ({
    page,
  }) => {
    await open(page, `${HEAD}?demo=variety`);
    await expect(page.locator(".site-stock__total-value")).toHaveText("96+");
    await expect(page.locator(".site-stock-row .stock-badge")).toHaveText([
      "свободно 41",
      "свободно 47+",
      "нет свободных",
      "свободно 8",
    ]);
    await expect(rowOf(page, "Orzu").locator(".badge")).toHaveClass(/badge--amber/);
    await expect(rowOf(page, "Namuna").locator(".stock-rooms")).toContainText("2к ✓");
    await expect(page.locator(".site-stock__footnote")).toContainText("«N+» и «по планировкам»");

    await toggle(page, "Namuna").click();
    const namuna = details(page, "Namuna");
    await expect(namuna.locator(".site-stock-row__offer").nth(2)).toHaveText(
      /^2-комн\.\s*по планировкам\s*от \$70\s290 · от 640\s000\s000\sсум\s*от 68 м²$/,
    );
    await expect(namuna.locator(".site-stock-row__blocks")).toHaveText(
      "Бл. 1: 65 · Бл. 2: по планировкам",
    );
    await toggle(page, "Orzu").click();
    await expect(details(page, "Orzu").locator(".site-stock-row__offer").last()).toHaveText(
      /^3-комн\.\s*2\s*цена по запросу\s*от 88 м²$/,
    );
    await toggle(page, "Yulduz").click();
    await expect(details(page, "Yulduz")).toContainText("Свободных квартир нет.");
    await expect(details(page, "Yulduz").locator(".site-stock-row__blocks")).toHaveText("Бл. 1: 0");
    await toggle(page, "Shodlik").click();
    await expect(details(page, "Shodlik").locator(".site-stock-row__note")).toHaveText(
      "Ещё 2 свободные без планировки — в типах и «свободно» не считаются.",
    );
  });

  test("live: чтение раз в минуту, пока вкладка видна; вернулись через ≥ 10 с — сразу; сменившаяся пилюля вспыхивает", async ({
    page,
  }) => {
    await page.clock.install();
    await open(page, `${HEAD}?demo=change`);
    const posts = trackActions(page);
    await page.clock.runFor(45_000);
    expect(posts).toHaveLength(0);
    await page.clock.runFor(20_000);
    await expect.poll(() => posts.length).toBe(1);
    const shodlik = rowOf(page, "Shodlik").locator(".stock-badge");
    await expect(shodlik).toHaveText("свободно 40");
    await expect(shodlik).toHaveClass(/stock-badge--flash/);
    await expect(rowOf(page, "Orzu").locator(".stock-badge")).toHaveClass(/stock-badge--flash/);
    await expect(rowOf(page, "Namuna").locator(".stock-badge")).not.toHaveClass(/--flash/);
    await expect(page.locator(".site-stock__total-value")).toHaveText("176");

    await visibility(page, "hidden");
    await page.clock.runFor(180_000);
    expect(posts).toHaveLength(1);
    await visibility(page, "visible");
    await expect.poll(() => posts.length).toBe(2);
    await expect(live(page)).not.toHaveClass(/live-status--stale/);
  });

  test("сбой: метка гаснет, цифры прежние, «обновлено N мин назад»; диктору — один раз", async ({
    page,
  }) => {
    await page.clock.install();
    await open(page, `${HEAD}?demo=fail`);
    await expect(live(page).getByRole("status")).toHaveText("");
    await page.clock.runFor(65_000);
    await expect(live(page)).toHaveClass(/live-status--stale/);
    await expect(live(page).getByRole("status")).toHaveText(
      "Остатки не обновились — на экране прежние цифры. Попробуем снова через минуту.",
    );
    await page.clock.runFor(180_000);
    await expect(live(page).locator(".live-status__label")).toHaveText(/^обновлено \d мин назад$/);
    await expect(page.locator(".site-stock__total-value")).toHaveText("176");
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
    await expect(details(page, "Shodlik").locator(".site-stock-row__where")).toHaveText(
      "Фергана · Farg‘ona Sifat Qurilish",
    );
    const link = details(page, "Shodlik").getByRole("link", { name: "Квартиры" });
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await noHorizontalScroll(page)).toBe(0);
  });

  test("анимации: пульс точки и вздрагивание пилюли — только full; в lite — без них", async ({
    page,
  }) => {
    const ping = () =>
      page
        .locator(".live-status__dot")
        .evaluate((element) => getComputedStyle(element, "::after").animationName);
    await open(page, `${HEAD}?motion=full`);
    expect(await ping()).toBe("live-status-ping");
    await open(page, `${HEAD}?motion=lite`);
    expect(await ping()).toBe("none");
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
      await open(page, MANAGER);
      await shoot("s13-home-manager");
      await open(page, `${HEAD}?demo=empty`);
      await shoot("s13-home-empty");
    });
  }

  test("скриншот: сбой и вспышка", async ({ page }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.clock.install({ time: new Date("2026-10-22T09:46:00Z") });
    await open(page, `${HEAD}?demo=fail`);
    await page.clock.runFor(185_000);
    await expect(live(page)).toHaveClass(/live-status--stale/);
    await page.screenshot({ path: `${dir}/s13-home-stale.png` });
    await open(page, `${HEAD}?demo=change&motion=full`);
    await page.clock.runFor(65_000);
    await expect(rowOf(page, "Shodlik").locator(".stock-badge")).toHaveClass(/--flash/);
    await page.screenshot({ path: `${dir}/s13-home-flash.png` });
  });
});
