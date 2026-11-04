import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Первый экран главной «Ufq · Раскол» (03.11.2026; переходы — motion kit Oryzo): светлое небо, по
// центру текст, внизу травертиновый горизонт; рендеры — прямоугольники за ним, при входе не видны. На
// десктопе ≥ 1024×720 сцена липнет: текст уходит, заголовок уменьшается к шапке, рамки выходят целиком
// (центральная шире), камера «ныряет» в центральную, экран раскалывается по ней — в щель поднимается
// каталог. Ниже — рамки выходят, пока экран уезжает; none — готовая картина.

const hero = (page: Page) => page.locator(".home-hero");
const tower = (page: Page, slot: string) => page.locator(`.home-hero__tower--${slot}`);
const phase = (page: Page) => hero(page).getAttribute("data-phase");
/** Начало и длина липкого пути. */
const track = (page: Page) =>
  page.evaluate(() => {
    const section = document.querySelector<HTMLElement>(".home-hero")!;
    const trackEl = section.querySelector<HTMLElement>(".home-hero__track")!;
    const stage = section.querySelector<HTMLElement>(".home-hero__stage")!;
    return {
      top: section.getBoundingClientRect().top + window.scrollY,
      length: trackEl.offsetHeight - stage.offsetHeight,
    };
  });
const scrollTo = (page: Page, top: number) =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);

test.describe("первый экран главной — колоннада и раскол", () => {
  test("1440, full: при входе рендеров нет; выходят целиком, центральная шире; нырок и раскол открывают каталог", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "липкая сцена — десктоп");
    const errors = collectPageErrors(page);
    await page.goto("/ru?motion=full");
    await expect(hero(page)).toHaveClass(/home-hero--full/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "Квартиры в новостройках Ферганы — по цене застройщика",
    );
    await expect(page.locator(".home-hero__pill a")).toHaveCount(0);
    await expect(hero(page)).toHaveAttribute("data-phase", "rest");
    // Переменных на секции нет — позы пишутся прямо в слои.
    expect(await hero(page).getAttribute("style")).toBeNull();
    const ledgerTop = (await page.locator(".home-hero__ledger").boundingBox())!.y;
    for (const slot of ["c", "l1", "r1"]) {
      const box = (await tower(page, slot).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(ledgerTop);
    }
    // Пауза: всё вышло целиком над горизонтом, прямоугольники, центральная шире.
    const { top, length } = await track(page);
    await scrollTo(page, top + length * 0.48);
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe("hold");
    await page.waitForTimeout(600);
    const [title, facts, center, side] = await Promise.all([
      page.getByRole("heading", { level: 1 }).boundingBox(),
      page.locator(".home-hero__facts-row").boundingBox(),
      tower(page, "c").boundingBox(),
      tower(page, "l1").boundingBox(),
    ]);
    expect(center!.width / side!.width).toBeGreaterThan(1.2);
    for (const box of [center!, side!]) {
      expect(box.y).toBeGreaterThanOrEqual(title!.y + title!.height);
      expect(box.y + box.height).toBeLessThanOrEqual(facts!.y);
    }
    const style = await tower(page, "l1")
      .locator(".home-hero__frame")
      .evaluate((element) => {
        const computed = getComputedStyle(element);
        return { radius: computed.borderRadius, mask: computed.webkitMaskImage || "none" };
      });
    expect(style.radius).toBe("0px");
    expect(style.mask).toBe("none");
    // Конец пути: раскол прошёл, сцена скрыта, под шапкой — следующая страница.
    await scrollTo(page, top + length);
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe("through");
    await expect(page.locator(".home-hero__stage")).toHaveCSS("visibility", "hidden");
    await expect(page.locator("#katalog")).toBeInViewport();
    // Пройденная сцена не перехватывает клики каталога под собой.
    const pill = page.locator("#katalog .filter-pills__pill").first();
    await pill.click({ trial: true });
    expect(errors).toEqual([]);
  });

  test("1440, full: фокус в ушедший текст — к началу, за первый экран — к концу сцены", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    await page.goto("/ru?motion=full");
    const { top, length } = await track(page);
    await scrollTo(page, top + length * 0.6);
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe("dive");
    const cta = page.locator(".home-hero__cta");
    await cta.focus();
    await expect(cta).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(top + 5);
    await expect(page.locator(".home-hero__out--actions")).toHaveCSS("opacity", "1");
    // Каталог под пластинами: фокус туда — сразу к концу сцены, где он виден.
    await page.locator("#katalog .filter-pills__pill").first().focus();
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThanOrEqual(top + length - 2);
  });

  test("1440, full по ссылке #katalog: сцена не закрывает каталог, кнопки фильтра нажимаются", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    await page.goto("/ru?motion=full#katalog");
    await expect(page.locator("#katalog")).toBeInViewport();
    const pill = page.locator("#katalog .filter-pills__pill").first();
    await pill.click({ trial: true });
    await expect(page.locator("html")).toHaveAttribute("data-hero-ready", "");
  });

  test("1440, lite: та же сцена без догона", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    await page.goto("/ru?motion=lite");
    await expect(hero(page)).toHaveClass(/home-hero--lite/);
    const { top, length } = await track(page);
    expect(length).toBeGreaterThan(page.viewportSize()!.height);
    await scrollTo(page, top + length * 0.48);
    await expect.poll(() => phase(page)).toBe("hold");
    await scrollTo(page, top + length);
    await expect.poll(() => phase(page)).toBe("through");
  });

  test("1440, none: готовая картина без движения", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "одной ширины хватает");
    await page.goto("/ru?motion=none");
    await expect(hero(page)).toHaveClass(/home-hero--none/);
    const stage = (await page.locator(".home-hero__stage").boundingBox())!;
    const height = await hero(page).evaluate((element) => element.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(stage.height + 2);
    const ledgerTop = (await page.locator(".home-hero__ledger").boundingBox())!.y;
    const center = (await tower(page, "c").boundingBox())!;
    expect(center.y + center.height).toBeLessThanOrEqual(ledgerTop);
    await expect(page.locator(".home-hero__plate").first()).toBeHidden();
    await expect(page.locator(".home-hero__note")).toBeVisible();
    const animations = await hero(page).evaluate(
      (element) =>
        document.getAnimations().filter((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return target instanceof Element && element.contains(target);
        }).length,
    );
    expect(animations).toBe(0);
  });

  test("390: при входе рендеров нет, после прокрутки — вышли; вбок не уезжает", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["mobile-390", "mobile-360", "webkit-390"].includes(testInfo.project.name),
      "телефон",
    );
    const errors = collectPageErrors(page);
    await page.goto("/uz?motion=lite");
    await expect(hero(page)).toHaveClass(/home-hero--lite/);
    const ledgerTop = (await page.locator(".home-hero__ledger").boundingBox())!.y;
    expect((await tower(page, "c").boundingBox())!.y).toBeGreaterThanOrEqual(ledgerTop);
    await expect(page.locator(".home-hero__tower--wide-only").first()).toBeHidden();
    await scrollTo(page, 700);
    await expect.poll(() => phase(page)).toBe("hold");
    const [center, ledger] = await Promise.all([
      tower(page, "c").boundingBox(),
      page.locator(".home-hero__ledger").boundingBox(),
    ]);
    expect(center!.y + center!.height).toBeLessThanOrEqual(ledger!.y);
    await expect(page.locator(".home-hero__note")).toBeVisible();
    const width = page.viewportSize()!.width;
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    expect(errors).toEqual([]);
  });
});
