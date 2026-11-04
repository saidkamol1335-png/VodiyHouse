import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Экран загрузки при входе на главную (30.10.2026, как в артефакте «Закат»): собирается знак, идут
// проценты, потом страница открывается. Один раз за сессию вкладки; не при #якоре, reduced-motion и
// экономии трафика. Экран ждёт шрифты и постер первого экрана (ролика больше нет, 03.11.2026), под ним
// вступление первого экрана стоит на первом кадре. ?e2e-preloader — общий fixtures не отмечает вход
// пройденным.

const preloader = (page: Page) => page.locator(".site-preloader");
const hero = (page: Page) => page.locator(".home-hero");
const html = (page: Page) => page.locator("html");
const ENTRY = "/ru?e2e-preloader";
/** Телефоны (PLAN §10, п. 17): первый экран — только постер, экрана загрузки нет. */
const PHONES = ["mobile-390", "mobile-360", "webkit-390"];

test.describe("экран загрузки при входе", () => {
  test("первый вход: экран виден, страница не листается, потом открывается и больше не показывается", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto(ENTRY);
    await expect(html(page))
      .toHaveAttribute("data-preloader", "", { timeout: 1_000 })
      .catch(() => {
        // Страница успела загрузиться и экран уже ушёл: это проверяет ожидание ниже.
      });
    await expect(html(page)).not.toHaveAttribute("data-preloader", /.*/, { timeout: 20_000 });
    await expect(preloader(page)).toBeHidden();
    await expect(page.getByRole("link", { name: /Подобрать квартиру/ }).first()).toBeVisible();

    await page.reload();
    await expect(html(page)).not.toHaveAttribute("data-preloader", /.*/);
    expect(errors).toEqual([]);
  });

  test("проценты растут до 100, под экраном первый экран уже готовится", async ({ page }, testInfo) => {
    test.skip(PHONES.includes(testInfo.project.name), "на телефоне экрана нет");
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { __counts: string[] }).__counts = seen;
      document.addEventListener("DOMContentLoaded", () => {
        const count = document.querySelector("[data-preloader-count]");
        if (!count) return;
        new MutationObserver(() => seen.push(count.textContent ?? "")).observe(count, {
          childList: true,
        });
      });
    });
    await page.goto(ENTRY);
    await expect(html(page)).not.toHaveAttribute("data-preloader", /.*/, { timeout: 20_000 });
    const counts = await page.evaluate(
      () => (window as unknown as { __counts: string[] }).__counts,
    );
    expect(counts.length).toBeGreaterThan(5);
    expect(counts.at(-1)).toBe("100");
    const numbers = counts.map(Number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  test("запасной выход: файлы первого экрана не отвечают — страница всё равно открывается", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // Постер не отвечает: события load не будет — ждём только разметку и оживление.
    await page.route(/\/hero\/renders\/.*\.(avif|webp)$/, () => undefined);
    await page.goto(ENTRY, { waitUntil: "domcontentloaded" });
    await expect(html(page)).not.toHaveAttribute("data-preloader", /.*/, { timeout: 25_000 });
    await expect(preloader(page)).toBeHidden();
  });

  test("1440, full: под экраном вступление первого экрана стоит, после — заголовок на месте", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "одной ширины хватает");
    await page.goto(`${ENTRY}&motion=full`);
    const title = page.locator(".home-hero__title-in").first();
    const preloading = await html(page).evaluate((root) => root.hasAttribute("data-preloader"));
    if (preloading) await expect(title).toHaveCSS("animation-play-state", "paused");
    await expect(html(page)).not.toHaveAttribute("data-preloader", /.*/, { timeout: 20_000 });
    await expect(title).toHaveCSS("animation-play-state", "running");
    await expect(title).toHaveCSS("opacity", "1", { timeout: 5_000 });
    await expect(hero(page)).toHaveAttribute("data-entered", "", { timeout: 8_000 });
  });

  test("#якорь и другие страницы — без экрана", async ({ page }) => {
    await page.goto(`${ENTRY}#podbor`);
    await expect(html(page)).not.toHaveAttribute("data-preloader", /.*/);
    await page.evaluate(() => sessionStorage.clear());
    await page.goto("/ru/novostroyki?e2e-preloader");
    await expect(html(page)).not.toHaveAttribute("data-preloader", /.*/);
  });

  test("экономия трафика и reduced-motion — без экрана; reduced-motion — постер без движения", async ({
    browser,
  }) => {
    const reduced = await browser.newContext({ reducedMotion: "reduce" });
    const quiet = await reduced.newPage();
    await quiet.goto(ENTRY);
    await expect(html(quiet)).not.toHaveAttribute("data-preloader", /.*/);
    await expect(hero(quiet)).toHaveClass(/home-hero--none/);
    await reduced.close();

    const saving = await browser.newContext();
    await saving.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "connection", {
        configurable: true,
        get: () => ({ saveData: true }),
      });
    });
    const page = await saving.newPage();
    await page.goto(ENTRY);
    await expect(html(page)).not.toHaveAttribute("data-preloader", /.*/);
    // Тяжёлых файлов у первого экрана больше нет: при экономии трафика — лёгкое движение lite.
    await expect(hero(page)).toHaveClass(/home-hero--lite/, { timeout: 10_000 });
    await saving.close();
  });

  test("телефон: первый вход без экрана, постер сразу, ролик не качается", async ({ page }, testInfo) => {
    test.skip(!PHONES.includes(testInfo.project.name), "телефон");
    const videos: string[] = [];
    page.on("request", (request) => {
      if (/\/hero\/timelapse\/.*\.(webm|mp4)$/.test(request.url())) videos.push(request.url());
    });
    await page.goto(ENTRY);
    await expect(html(page)).not.toHaveAttribute("data-preloader", /.*/);
    await expect(preloader(page)).toBeHidden();
    await expect(hero(page)).toHaveClass(/home-hero--none/);
    await expect(page.getByRole("link", { name: /Подобрать квартиру/ }).first()).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(videos).toEqual([]);
  });

  test("сеть «3g»: движение не отключается", async ({ page }, testInfo) => {
    test.skip(PHONES.includes(testInfo.project.name), "на телефоне первый экран — постер в любой сети");
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "connection", {
        configurable: true,
        get: () => ({ saveData: false, effectiveType: "3g", rtt: 300, downlink: 10 }),
      });
    });
    await page.goto("/ru");
    const expected =
      testInfo.project.name === "desktop-1440" ? /home-hero--(full|lite)/ : /home-hero--lite/;
    await expect(hero(page)).toHaveClass(expected);
    await page.waitForTimeout(2_000);
    await expect(hero(page)).not.toHaveClass(/home-hero--none/);
  });
});
