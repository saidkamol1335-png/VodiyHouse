import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Первый экран главной «Ufq» (03.11.2026; правки 15.11, п. 1): светлое небо, по центру текст, кнопки и
// цифры каталога; ниже — колоннада рендеров (прямоугольники, центральная шире) над травертиновым
// горизонтом. Рендеры и цифры видны сразу, без прокрутки, на 1440×900 и 390×844 во всех режимах;
// прокрутка их не двигает (сцена «Раскол» убрана).

const hero = (page: Page) => page.locator(".home-hero");
const tower = (page: Page, slot: string) => page.locator(`.home-hero__tower--${slot}`);

/** Нижняя граница окна — то, что видно без прокрутки. */
async function aboveFold(page: Page, selector: string) {
  const box = (await page.locator(selector).first().boundingBox())!;
  return { box, fold: page.viewportSize()!.height };
}

/** Вступление рамок и цифр, которое ещё идёт или ждёт (пульс «live» у квартир — не в счёт: он короткий и задуман). */
const heroAnimations = (page: Page) =>
  hero(page).evaluate(
    (element) =>
      document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return target instanceof Element && element.contains(target) && target.matches(".home-hero__tower, .home-hero__stats");
      }).length,
  );

test.describe("первый экран главной — рендеры и цифры сразу", () => {
  for (const motion of ["full", "lite", "none"] as const) {
    test(`${motion}: цифры под кнопками и колоннада — без прокрутки; прокрутка их не двигает`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !["desktop-1440", "mobile-390"].includes(testInfo.project.name),
        "две ширины приёмки",
      );
      const errors = collectPageErrors(page);
      await page.goto(`/uz?motion=${motion}`);
      await expect(hero(page)).toHaveClass(new RegExp(`home-hero--${motion}`));
      await expect(page.locator("html")).not.toHaveAttribute("data-preloader", "");
      // Цифры «N turar-joy majmuasi · N quruvchi · N kvartira sotuvda» — под кнопками, на первом экране.
      const stats = page.locator(".home-hero__copy .home-hero__stats");
      await expect(stats.locator(".home-hero__stat-label")).toHaveText([/turar-joy majmuasi/, /quruvchi/, /kvartira sotuvda/]);
      await expect(stats.locator(".home-hero__stat-value").first()).toHaveText(/^\d+$/);
      const numbers = await aboveFold(page, ".home-hero__stats");
      expect(numbers.box.y + numbers.box.height).toBeLessThanOrEqual(numbers.fold);
      const actions = (await page.locator(".home-hero__actions").boundingBox())!;
      expect(numbers.box.y).toBeGreaterThanOrEqual(actions.y + actions.height);
      // Колоннада: центральная рамка видна хотя бы на 150 px, картинка загружена, рамки — прямоугольники.
      if (motion !== "none") await expect.poll(() => heroAnimations(page), { timeout: 5_000 }).toBe(0);
      const center = await aboveFold(page, ".home-hero__tower--c");
      expect(center.fold - center.box.y).toBeGreaterThanOrEqual(150);
      expect(center.box.y).toBeGreaterThanOrEqual(numbers.box.y + numbers.box.height);
      await expect(tower(page, "c").locator("img")).toHaveJSProperty("complete", true);
      expect(await tower(page, "c").locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      const side = (await tower(page, "l1").boundingBox())!;
      expect(center.box.width / side.width).toBeGreaterThan(1.2);
      await expect(tower(page, "l1").locator(".home-hero__frame")).toHaveCSS("border-radius", "0px");
      // Прокрутка не двигает рамки: смещение рамки = смещению страницы.
      await page.evaluate(() => window.scrollTo({ top: 200, behavior: "instant" }));
      await expect.poll(async () => Math.round((await tower(page, "c").boundingBox())!.y)).toBe(Math.round(center.box.y - 200));
      if (motion === "none") expect(await heroAnimations(page)).toBe(0);
      const width = page.viewportSize()!.width;
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: `test-results/screens/${testInfo.project.name}/pravki-1511-hero-${motion}.png`, caret: "initial" });
      expect(errors).toEqual([]);
    });
  }

  test("1440: крайние рамки — на широком экране, на телефоне их нет", async ({ page }, testInfo) => {
    await page.goto("/uz?motion=none");
    const wide = page.locator(".home-hero__tower--wide-only").first();
    if (testInfo.project.name === "desktop-1440") await expect(wide).toBeVisible();
    else await expect(wide).toBeHidden();
  });
});
