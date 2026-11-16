import { expect, test, type Page } from "./fixtures";
import { attachShot, collectPageErrors } from "./helpers";

// «Проекты Vodiy House» (PLAN §10, п. 47) — слайдер (правки 15.11, п. 5): лента со scroll-snap и
// свайпом, стрелки ‹ ›, точки; к прокрутке страницы не привязана. Автопрокрутка — только в full (5 с),
// пауза при наведении; lite и none — без автопрокрутки.

const gallery = (page: Page) => page.locator(".jk-gallery");
const viewport = (page: Page) => page.locator(".jk-gallery__viewport");
const dots = (page: Page) => page.locator(".jk-gallery__dot");
const scrollLeft = (page: Page) => viewport(page).evaluate((element) => Math.round(element.scrollLeft));
const currentDot = (page: Page) =>
  dots(page).evaluateAll((items) => items.findIndex((item) => item.getAttribute("aria-current") === "true"));

const noPageOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);

/** Лента в кадре, страница стоит — мышь уведена с ленты. */
async function openGallery(page: Page, motion: "full" | "lite" | "none", locale = "ru") {
  await page.goto(`/${locale}?motion=${motion}`);
  await gallery(page).scrollIntoViewIfNeeded();
  await page.mouse.move(2, 2);
  await expect(dots(page).first()).toHaveAttribute("aria-current", "true");
}

test.describe("главная — «Проекты Vodiy House» слайдером", () => {
  test("1440, full: не закрепляется; стрелки и точки листают; сама листает, наведение — пауза", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    const errors = collectPageErrors(page);
    await openGallery(page, "full");
    await expect(page.locator(".jk-gallery--pinned, .jk-gallery__pin")).toHaveCount(0);
    const cards = page.locator(".jk-gallery__card");
    expect(await cards.count()).toBeGreaterThanOrEqual(4);
    await expect(cards.last()).toContainText("Все ЖК");
    await expect(dots(page)).toHaveCount(await cards.count());
    await expect(dots(page).nth(1)).toHaveAccessibleName(`2 из ${await cards.count()}`);
    // Наведение мышью — пауза: дольше интервала лента стоит.
    await viewport(page).hover();
    await page.waitForTimeout(6_000);
    expect(await currentDot(page)).toBe(0);
    // Стрелка «Следующий ЖК» и точка.
    await page.getByRole("button", { name: "Следующий ЖК" }).click();
    await expect.poll(() => currentDot(page)).toBe(1);
    await dots(page).nth(2).click();
    await expect.poll(() => currentDot(page)).toBe(2);
    await page.getByRole("button", { name: "Предыдущий ЖК" }).click();
    await expect.poll(() => currentDot(page)).toBe(1);
    // Мышь ушла — через ~5 с лента сама листает дальше.
    await page.mouse.move(2, 2);
    await expect.poll(() => currentDot(page), { timeout: 9_000 }).toBe(2);
    // Прокрутка страницы ленту не двигает.
    const before = await scrollLeft(page);
    await page.mouse.wheel(0, 300);
    expect(await scrollLeft(page)).toBe(before);
    await noPageOverflow(page);
    await attachShot(page, testInfo, "jk-gallery-slider");
    expect(errors).toEqual([]);
  });

  for (const motion of ["lite", "none"] as const) {
    test(`1440, ${motion}: без автопрокрутки, стрелки работают`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
      await openGallery(page, motion);
      await page.waitForTimeout(6_500);
      expect(await currentDot(page)).toBe(0);
      expect(await scrollLeft(page)).toBe(0);
      await page.getByRole("button", { name: "Следующий ЖК" }).click();
      await expect.poll(() => currentDot(page)).toBe(1);
      await noPageOverflow(page);
    });
  }

  test("390: свайп со scroll-snap, точки, последняя — «Barcha TJMlar», вбок не уезжает", async ({ page }, testInfo) => {
    test.skip(!["mobile-390", "mobile-360", "webkit-390"].includes(testInfo.project.name), "телефон");
    const errors = collectPageErrors(page);
    await openGallery(page, "lite", "uz");
    await expect(viewport(page)).toHaveCSS("scroll-snap-type", "x mandatory");
    await expect(page.locator(".jk-gallery__card").last()).toContainText("Barcha TJMlar");
    await viewport(page).evaluate((element) => element.scrollTo({ left: element.scrollWidth, behavior: "instant" }));
    await expect.poll(() => currentDot(page)).toBe((await dots(page).count()) - 1);
    await noPageOverflow(page);
    await attachShot(page, testInfo, "jk-gallery-390");
    expect(errors).toEqual([]);
  });
});
