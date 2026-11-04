import { expect, test, type Page } from "./fixtures";
import { attachShot, collectPageErrors } from "./helpers";

// «Отзывы тех, кто уже получил ключи» (PLAN §10, п. 47; Motion Kit №16). Настоящих отзывов нет —
// dev-сервер e2e идёт с VH_DEMO_SECTIONS=1 (DEMO). full на ≥ 768 px: липкий 3D-ключ (Three.js грузится
// у блока), активная строка у центра, финал — поворот в замке и CTA. lite, телефон, reduced-motion —
// кадр ключа в шапке, цитаты яркие. Правило «меньше трёх — блок скрыт» — юнит и тест базы.

const reviews = (page: Page) => page.locator(".reviews");
const canvas = (page: Page) => page.locator(".reviews__canvas");
const turnOf = async (page: Page) => Number(await canvas(page).getAttribute("data-turn"));

const scrollTo = (page: Page, top: number) =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);

const noPageOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);

const shot = attachShot;

test.describe("главная — отзывы с 3D-ключом", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ru?motion=lite");
    test.skip(
      (await reviews(page).count()) === 0,
      "отзывов меньше трёх и сервер без VH_DEMO_SECTIONS=1",
    );
  });

  test("1440, full: Three.js — только у блока; активная строка меняется; ключ поворачивается; финал с CTA", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "3D — десктоп");
    const errors = collectPageErrors(page);
    const three: string[] = [];
    page.on("request", (request) => {
      if (/three/i.test(request.url())) three.push(request.url());
    });
    await page.goto("/ru?motion=full");
    await page.waitForTimeout(2500);
    expect(three).toEqual([]);
    // Подходим, как при прокрутке: за полтора экрана до блока Three.js уже грузится, сцена готова
    // раньше, чем блок на экране (на экране 3D не включается — раскладка прыгнула бы).
    const sectionTop = await reviews(page).evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );
    await scrollTo(page, sectionTop - 900 * 1.6);
    await expect(page.locator(".reviews--3d")).toHaveCount(1, { timeout: 20_000 });
    await reviews(page).scrollIntoViewIfNeeded();
    expect(three.length).toBeGreaterThan(0);
    await expect(canvas(page)).toHaveAttribute("data-running", "1");
    await shot(page, testInfo, "reviews-1440-head");
    const list = await page.locator(".reviews__list").evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top + window.scrollY, height: box.height };
    });
    const center = (share: number) => list.top + list.height * share - 450;
    await scrollTo(page, center(0.2));
    await page.waitForTimeout(1200);
    const firstTurn = await turnOf(page);
    const firstActive = await page.locator(".reviews__row--active").getAttribute("data-row");
    await scrollTo(page, center(0.75));
    await page.waitForTimeout(1500);
    await shot(page, testInfo, "reviews-1440-middle");
    const midTurn = await turnOf(page);
    const midActive = await page.locator(".reviews__row--active").getAttribute("data-row");
    expect(midActive).not.toBe(firstActive);
    expect(Math.abs(midTurn - firstTurn)).toBeGreaterThan(0.5);
    // Финал: CTA в кадре — ключ ещё на 90° (π/2 ≈ 1,57) и кнопка видна.
    const ctaTop = await page
      .locator(".reviews__cta")
      .evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    await scrollTo(page, ctaTop - 900 * 0.62);
    await expect(page.locator(".reviews--final")).toHaveCount(1, { timeout: 8_000 });
    await page.waitForTimeout(1500);
    expect(await turnOf(page)).toBeGreaterThan(Math.PI + 1.2);
    await expect(page.locator(".reviews__cta-link")).toHaveCSS("opacity", "1");
    await expect(page.locator(".reviews__cta-link")).toHaveAttribute("href", /\/novostroyki$/);
    await shot(page, testInfo, "reviews-1440-final");
    // Блок ушёл с экрана — рендер стоит.
    await scrollTo(page, 0);
    await expect(canvas(page)).toHaveAttribute("data-running", "0", { timeout: 5_000 });
    await noPageOverflow(page);
    expect(errors).toEqual([]);
  });

  test("1440, lite и reduced-motion: без Three.js, кадр ключа в шапке, цитаты яркие", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    for (const setup of ["lite", "reduce"] as const) {
      const three: string[] = [];
      page.on("request", (request) => {
        if (/three/i.test(request.url())) three.push(request.url());
      });
      if (setup === "reduce") await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(setup === "lite" ? "/ru?motion=lite" : "/ru");
      await reviews(page).scrollIntoViewIfNeeded();
      await page.locator(".reviews__cta").scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      expect(three).toEqual([]);
      await expect(page.locator(".reviews--3d")).toHaveCount(0);
      await expect(page.locator(".reviews__still")).toBeVisible();
      await expect(page.locator(".reviews__word").first()).toHaveCSS("opacity", "1");
      await expect(page.locator(".reviews__cta-link")).toBeVisible();
    }
  });

  test("390: ключ в шапке, строки в одну колонку — цитата, под ней фото", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["mobile-390", "mobile-360", "webkit-390"].includes(testInfo.project.name),
      "телефон",
    );
    const errors = collectPageErrors(page);
    await page.goto("/uz?motion=full");
    await reviews(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await expect(page.locator(".reviews--3d")).toHaveCount(0);
    await expect(page.locator(".reviews__still")).toBeVisible();
    await expect(page.locator(".reviews__title")).toHaveText("Kalitini olgan mijozlarimiz fikri");
    await shot(page, testInfo, "reviews-390-head");
    const row = page.locator(".reviews__row").first();
    const [quote, media] = await Promise.all([
      row.locator(".reviews__quote").boundingBox(),
      row.locator(".reviews__media").boundingBox(),
    ]);
    expect(media!.y).toBeGreaterThan(quote!.y + quote!.height - 1);
    await row.scrollIntoViewIfNeeded();
    await shot(page, testInfo, "reviews-390-middle");
    await page.locator(".reviews__cta").scrollIntoViewIfNeeded();
    await shot(page, testInfo, "reviews-390-final");
    await noPageOverflow(page);
    expect(errors).toEqual([]);
  });
});
