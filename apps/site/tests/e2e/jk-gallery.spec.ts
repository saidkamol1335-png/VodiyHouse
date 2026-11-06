import { expect, test, type Page } from "./fixtures";
import { attachShot, collectPageErrors } from "./helpers";

// «Проекты Vodiy House» (PLAN §10, п. 47; Motion Kit №17): full на ≥ 768 px — секция закрепляется, трек
// едет влево, названия — параллакс; lite, телефон и ?motion=none — нативная лента со scroll-snap.

const gallery = (page: Page) => page.locator(".jk-gallery");
const pinned = (page: Page) => page.locator(".jk-gallery--pinned");

/** Начало и длина закреплённого пути (pin-spacer GSAP вокруг секции). */
const pinPath = (page: Page) =>
  page.evaluate(() => {
    const spacer = document.querySelector<HTMLElement>(".jk-gallery__pin")!.parentElement!;
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

test.describe("главная — «Проекты Vodiy House»", () => {
  test("1440, full: закреплена, трек доходит до «Все ЖК», названия едут своей скоростью", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "pin — десктоп");
    const errors = collectPageErrors(page);
    await page.goto("/ru?motion=full");
    await gallery(page).scrollIntoViewIfNeeded();
    await expect(pinned(page)).toHaveCount(1, { timeout: 15_000 });
    const cards = page.locator(".jk-gallery__card");
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
    await expect(cards.last()).toContainText("Все ЖК");
    const { top, length } = await pinPath(page);
    expect(length).toBeGreaterThan(200);
    const title = page.locator(".jk-gallery__caption").nth(1);
    const titleShift = () =>
      title.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41);
    await scrollTo(page, top + 2);
    await page.waitForTimeout(1500);
    await shot(page, testInfo, "jk-gallery-start");
    const before = await titleShift();
    await scrollTo(page, top + length / 2);
    await page.waitForTimeout(1500);
    await shot(page, testInfo, "jk-gallery-middle");
    expect(await titleShift()).not.toBeCloseTo(before, 0);
    // Конец пути, секция ещё закреплена: последняя карточка целиком в окне.
    await scrollTo(page, top + length - 2);
    await expect
      .poll(() => cards.last().evaluate((element) => element.getBoundingClientRect().right), {
        timeout: 8_000,
      })
      .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
    const last = (await cards.last().boundingBox())!;
    expect(last.x).toBeGreaterThanOrEqual(0);
    await shot(page, testInfo, "jk-gallery-end");
    await expect(gallery(page)).toHaveAttribute("data-live", "");
    await noPageOverflow(page);
    expect(errors).toEqual([]);
  });

  test("1440, full: Tab по карточкам прокручивает страницу к карточке", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    await page.goto("/ru?motion=full");
    await gallery(page).scrollIntoViewIfNeeded();
    await expect(pinned(page)).toHaveCount(1, { timeout: 15_000 });
    // Фокус с клавиатуры (Tab), а не мышью: щелчок страницу не двигает.
    await page.locator(".jk-gallery__link").nth(1).focus();
    await page.keyboard.press("Tab");
    const link = page.locator(".jk-gallery__link").nth(2);
    await expect(link).toBeFocused();
    await expect
      .poll(
        () =>
          link.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return box.left >= -1 && box.right <= document.documentElement.clientWidth + 1;
          }),
        { timeout: 8_000 },
      )
      .toBe(true);
  });

  test("1440, lite и none: лента без закрепления, прокручивается сама", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    for (const setup of ["lite", "none"] as const) {
      await page.goto(`/ru?motion=${setup}`);
      await gallery(page).scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await expect(pinned(page)).toHaveCount(0);
      const viewport = page.locator(".jk-gallery__viewport");
      const scrollable = await viewport.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      );
      expect(scrollable).toBe(true);
      await noPageOverflow(page);
    }
  });

  test("390: лента со scroll-snap, без закрепления и горизонтальной прокрутки страницы", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["mobile-390", "mobile-360", "webkit-390"].includes(testInfo.project.name),
      "телефон",
    );
    const errors = collectPageErrors(page);
    await page.goto("/uz?motion=full");
    await gallery(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await expect(pinned(page)).toHaveCount(0);
    await expect(page.locator(".jk-gallery__viewport")).toHaveCSS(
      "scroll-snap-type",
      "x mandatory",
    );
    await expect(page.locator(".jk-gallery__card").last()).toContainText("Barcha TJMlar");
    await shot(page, testInfo, "jk-gallery-390-start");
    const viewport = page.locator(".jk-gallery__viewport");
    await viewport.evaluate((element) =>
      element.scrollTo({ left: element.scrollWidth / 2, behavior: "instant" }),
    );
    await page.waitForTimeout(500);
    await shot(page, testInfo, "jk-gallery-390-middle");
    await viewport.evaluate((element) =>
      element.scrollTo({ left: element.scrollWidth, behavior: "instant" }),
    );
    await page.waitForTimeout(500);
    await shot(page, testInfo, "jk-gallery-390-end");
    await noPageOverflow(page);
    expect(errors).toEqual([]);
  });
});
