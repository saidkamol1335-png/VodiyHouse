import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Появление блоков при прокрутке (30.10.2026): скрытый блок не должен оказаться на первом экране
// (ждал бы скриптов и портил LCP), после прокрутки всё видно, без скриптов — видно сразу.

const PAGES = ["/ru", "/ru/dlya-zastroyshchikov", "/ru/o-nas"];
const reveals = (page: Page) => page.locator(".reveal");

/** Прокрутка до низа, как читатель: страница растёт, поэтому высота читается заново. */
async function scrollThrough(page: Page) {
  let top = 0;
  let height = await page.evaluate(() => document.documentElement.scrollHeight);
  while (top < height) {
    top += 400;
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await page.waitForTimeout(80);
    height = await page.evaluate(() => document.documentElement.scrollHeight);
  }
  // Под нагрузкой прокрутка проскакивает блок раньше наблюдателя: блок появляется, когда он на экране.
  const missed = await reveals(page).count();
  for (let index = 0; index < missed; index++) {
    const node = reveals(page).nth(index);
    if ((await node.getAttribute("data-revealed")) !== null) continue;
    await node.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
  }
}

const hiddenAfterScroll = (page: Page) =>
  reveals(page).evaluateAll((nodes) =>
    nodes.filter((node) => !node.hasAttribute("data-revealed")).map((node) => node.className),
  );

for (const motion of ["lite", "full"]) {
  test(`${motion}: ни один скрытый блок не на первом экране, после прокрутки видно всё`, async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    for (const path of PAGES) {
      await page.goto(`${path}?motion=${motion}`);
      const onFirstScreen = await reveals(page).evaluateAll((nodes) =>
        nodes
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.height > 0 && rect.top < window.innerHeight;
          })
          .map((node) => node.className),
      );
      expect(onFirstScreen, path).toEqual([]);
      await scrollThrough(page);
      await expect.poll(() => hiddenAfterScroll(page), { message: path }).toEqual([]);
      await page.waitForTimeout(1_200);
      const faded = await reveals(page).evaluateAll((nodes) =>
        nodes
          .filter((node) => getComputedStyle(node).opacity !== "1")
          .map((node) => node.className),
      );
      expect(faded, path).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}

test("страница застройщика: блоки появляются, текст заголовков цел", async ({ page }) => {
  await page.goto("/ru/zastroyshchiki?motion=lite");
  await page.locator(".developers-list__row").first().click();
  await page.waitForURL(/\/zastroyshchiki\/.+/);
  await scrollThrough(page);
  await expect.poll(() => hiddenAfterScroll(page)).toEqual([]);
});

test("1440, full: «Назад» на главную — показанное не исчезает и не проигрывается снова", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "появление с движением — full");
  await page.goto("/ru?motion=full");
  await scrollThrough(page);
  await expect.poll(() => hiddenAfterScroll(page)).toEqual([]);
  await page.waitForTimeout(1_200);
  await page.evaluate(() => {
    const card = document.querySelector<HTMLAnchorElement>(
      ".catalog-card a[href*='/novostroyki/']",
    );
    card?.click();
  });
  await page.waitForURL(/\/novostroyki\/.+/);
  await page.goBack();
  await expect(page.locator(".reveal").first()).toBeVisible();
  const running = await page.evaluate(
    () =>
      [...document.querySelectorAll(".reveal, .reveal .heading__word")].filter((node) =>
        node
          .getAnimations()
          .some(
            (animation) =>
              "animationName" in animation && String(animation.animationName).startsWith("reveal-"),
          ),
      ).length,
  );
  expect(running).toBe(0);
});

test("открыта по якорю: раздел на экране виден сразу, без появления", async ({ page }) => {
  await page.goto("/ru#katalog");
  await expect(page.locator("html")).toHaveAttribute("data-reveal-off", "");
  const hidden = await page
    .locator(".reveal")
    .evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).opacity !== "1").length);
  expect(hidden).toBe(0);
});

test("без скриптов всё видно", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/ru");
  const hidden = await reveals(page).evaluateAll((nodes) =>
    nodes.filter((node) => getComputedStyle(node).opacity !== "1").map((node) => node.className),
  );
  expect(hidden).toEqual([]);
  await context.close();
});

test("1440, full: заголовок по словам — фраза цела, слова на месте после появления", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "по словам — только full");
  await page.goto("/ru?motion=full");
  const words = page.locator(".reveal--words .heading--h2").first();
  const text = (await words.innerText()).replace(/\s+/g, " ").trim();
  expect(text.split(" ").length).toBeGreaterThan(1);
  expect(text).not.toMatch(/[а-яё]{25,}/i);
  await scrollThrough(page);
  await page.waitForTimeout(1_500);
  const unsettled = await page
    .locator(".reveal--words .heading__word")
    .evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).opacity !== "1").length);
  expect(unsettled).toBe(0);
});
