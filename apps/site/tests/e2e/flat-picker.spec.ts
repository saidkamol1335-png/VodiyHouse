import { expect, test, type Page } from "./fixtures";
import { attachShot, collectPageErrors } from "./helpers";

// «Выберите свою квартиру» (PLAN §10, п. 47; Motion Kit №18). Кадров ещё нет: dev-сервер e2e идёт с
// VH_DEMO_SECTIONS=1 и берёт заглушку public/assets/flat-placeholder (npm run frames:placeholder).
// full на ≥ 768 px — pin ≈ 250svh и кадры на canvas; lite — два кадра; reduced-motion — сразу 3/4.

const section = (page: Page) => page.locator(".flat-picker");
const canvasFrame = (page: Page) => page.locator(".flat-picker__canvas").getAttribute("data-frame");

const pinPath = (page: Page) =>
  page.evaluate(() => {
    const spacer = document.querySelector<HTMLElement>(".flat-picker__pin")!.parentElement!;
    return {
      top: spacer.getBoundingClientRect().top + window.scrollY,
      length: spacer.offsetHeight - window.innerHeight,
    };
  });

const scrollTo = (page: Page, top: number) =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);

const noPageOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);

const shot = attachShot;

/** Кадры секции, запрошенные страницей (без первых — они грузятся сразу). */
function frameRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (/\/assets\/flat(-placeholder)?\/\dk\//.test(request.url())) urls.push(request.url());
  });
  return () => urls.filter((url) => !/\/0001\.webp$/.test(url));
}

test.describe("главная — «Выберите свою квартиру»", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ru?motion=lite");
    test.skip(
      (await section(page).count()) === 0,
      "нет кадров (npm run frames:placeholder) или сервер без VH_DEMO_SECTIONS=1",
    );
  });

  test("1440, full: кадры не грузятся до подхода; pin, поворот по прокрутке, каждая вкладка", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "pin — десктоп");
    // Три вкладки × три точки с ожиданием кадров — дольше 30 с при параллельном прогоне.
    test.setTimeout(60_000);
    const errors = collectPageErrors(page);
    const early = frameRequests(page);
    await page.goto("/ru?motion=full");
    await expect(page.locator(".flat-picker--pinned")).toHaveCount(1, { timeout: 15_000 });
    await page.waitForTimeout(1500);
    expect(early()).toEqual([]);
    const { top, length } = await pinPath(page);
    expect(length).toBeGreaterThan(page.viewportSize()!.height);
    const tabs = page.getByRole("tab");
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let index = 0; index < count; index += 1) {
      await scrollTo(page, top + length - 2);
      await page.waitForTimeout(400);
      await tabs.nth(index).click();
      await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
      const frames: (string | null)[] = [];
      for (const [label, share] of [
        ["0", 0],
        ["50", 0.5],
        ["100", 1],
      ] as const) {
        await scrollTo(page, top + Math.min(length - 2, length * share + 1));
        await page.waitForTimeout(1300);
        frames.push(await canvasFrame(page));
        await shot(page, testInfo, `flat-picker-1440-tab${index + 1}-${label}`);
      }
      expect(Number(frames[0])).toBeLessThan(Number(frames[2]));
      expect(Number(frames[2])).toBeGreaterThan(30);
    }
    expect(early().length).toBeGreaterThan(0);
    await noPageOverflow(page);
    expect(errors).toEqual([]);
  });

  test("1440: вкладки с клавиатуры; цифры — как в каталоге с тем же фильтром", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    await page.goto("/ru?motion=lite");
    const tabs = page.getByRole("tab");
    test.skip((await tabs.count()) < 2, "одна вкладка");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    // «N квартир в M ЖК» и ссылка CTA — тот же фильтр, что каталог: там «Найдено M ЖК».
    const stock = (
      await page.locator(".flat-picker__figure").last().locator("dd").innerText()
    ).trim();
    const complexes = Number(/в (\d+) ЖК/.exec(stock)?.[1]);
    const href = await page.locator(".flat-picker__cta").getAttribute("href");
    expect(href).toMatch(/\/novostroyki\?komnat=\d/);
    await page.goto(href!);
    await expect(page.locator(".catalog-results__count")).toHaveText(`Найдено ${complexes} ЖК`);
  });

  test("1440, lite и reduced-motion: без pin; lite — два кадра, reduced — сразу 3/4", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    await page.goto("/ru?motion=lite");
    await section(page).scrollIntoViewIfNeeded();
    await expect(page.locator(".flat-picker--pinned")).toHaveCount(0);
    await expect(page.locator(".flat-picker__still--angle")).toHaveCSS("opacity", "1", {
      timeout: 5_000,
    });
    const before = await page.locator(".flat-picker__still--angle").getAttribute("srcset");
    const tabs = page.getByRole("tab");
    if ((await tabs.count()) > 1) {
      await tabs.nth(1).click();
      await expect
        .poll(() => page.locator(".flat-picker__still--angle").getAttribute("srcset"))
        .not.toBe(before);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/ru");
    await section(page).scrollIntoViewIfNeeded();
    await expect(page.locator(".flat-picker--pinned")).toHaveCount(0);
    await expect(page.locator(".flat-picker__still--angle")).toHaveCSS("opacity", "1");
    await expect(page.locator(".flat-picker__still--top")).toHaveCSS("opacity", "0");
    await noPageOverflow(page);
  });

  test("390: без pin, поворот по прокрутке, без горизонтальной прокрутки", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["mobile-390", "mobile-360", "webkit-390"].includes(testInfo.project.name),
      "телефон",
    );
    const errors = collectPageErrors(page);
    await page.goto("/uz?motion=full");
    await expect(page.locator(".flat-picker--live")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator(".flat-picker--pinned")).toHaveCount(0);
    const stage = page.locator(".flat-picker__stage");
    const box = await stage.evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );
    const tabs = page.getByRole("tab");
    for (let index = 0; index < (await tabs.count()); index += 1) {
      await tabs.nth(index).click();
      const frames: (string | null)[] = [];
      for (const [label, offset] of [
        ["0", -700],
        ["50", -300],
        ["100", 200],
      ] as const) {
        await scrollTo(page, box + offset);
        await page.waitForTimeout(1000);
        frames.push(await canvasFrame(page));
        await shot(page, testInfo, `flat-picker-390-tab${index + 1}-${label}`);
      }
      expect(Number(frames[2])).toBeGreaterThan(Number(frames[0]));
    }
    await noPageOverflow(page);
    expect(errors).toEqual([]);
  });
});
