import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Первый экран главной (30.10.2026): ролик стройки на весь экран вместо «Чертёж → стройка».
// full и lite — ролик один раз и стоп на вечере, none и экономия трафика — только постер; шапка в
// тонах экрана; на телефоне — вырезка 9:16, текст внизу первого экрана, факты полосой под ним.
// Встроенный Chromium Playwright не играет H.264 — проверяем WebM.

const hero = (page: Page) => page.locator(".home-hero");
const video = (page: Page) => page.locator(".home-hero__video");
const posterSrc = (page: Page) =>
  page
    .locator(".home-hero__poster img")
    .evaluate((image) => (image as HTMLImageElement).currentSrc);

test.describe("первый экран главной — ролик стройки", () => {
  test("1440, full: ролик проявляется, играет один раз и стоит на вечере; шапка тёмная над экраном", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    const errors = collectPageErrors(page);
    await page.goto("/ru?motion=full");
    await expect(hero(page)).toHaveClass(/home-hero--full/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Квартиры в новостройках Ферганы — по цене застройщика",
    );
    await expect(page.getByRole("link", { name: /Подобрать квартиру/ }).first()).toHaveAttribute(
      "href",
      /#katalog$/,
    );
    await expect(page.locator(".home-hero__quiz")).toHaveAttribute("href", "#podbor");
    await expect(page.locator("html")).toHaveAttribute("data-hero-dark", "");
    await expect(page.locator(".site-header")).toHaveClass(/site-header--dark/);
    // Текст стоит по краю логотипа шапки.
    const [logo, copy] = await Promise.all([
      page.locator(".logo").boundingBox(),
      page.locator(".home-hero__copy").boundingBox(),
    ]);
    expect(Math.abs((logo?.x ?? 0) - (copy?.x ?? 1))).toBeLessThan(2);
    await expect(video(page)).toHaveAttribute("src", /\/hero\/timelapse\/v1\/hero-1080\.webm$/);
    await expect(video(page)).toHaveJSProperty("muted", true);
    await expect(hero(page)).toHaveClass(/home-hero--playing/, { timeout: 20_000 });
    // Пауза кнопкой (WCAG 2.2.2): ролик стоит и сам не продолжается; кнопка продолжает.
    const pause = page.getByRole("button", { name: "Остановить ролик" });
    await pause.click();
    await expect(page.getByRole("button", { name: "Продолжить ролик" })).toBeVisible();
    await expect
      .poll(() => video(page).evaluate((element) => (element as HTMLVideoElement).paused))
      .toBe(true);
    await page.getByRole("button", { name: "Продолжить ролик" }).click();
    await expect
      .poll(() => video(page).evaluate((element) => (element as HTMLVideoElement).paused))
      .toBe(false);
    // Один раз: ускоренный ролик доходит до конца, не повторяется и уступает постеру — тот же кадр.
    await video(page).evaluate((element) => {
      (element as HTMLVideoElement).playbackRate = 16;
    });
    await expect
      .poll(() => video(page).evaluate((element) => (element as HTMLVideoElement).ended), {
        timeout: 20_000,
      })
      .toBe(true);
    expect(await video(page).evaluate((element) => (element as HTMLVideoElement).loop)).toBe(false);
    await expect(hero(page)).not.toHaveClass(/home-hero--playing/);
    await expect(video(page)).toHaveCSS("opacity", "0");
    await expect(page.getByRole("button", { name: "Остановить ролик" })).toHaveCount(0);
    // Ниже первого экрана шапка снова в цветах темы.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator("html")).not.toHaveAttribute("data-hero-dark", "");
    expect(errors).toEqual([]);
  });

  test("1440: «Назад» на главную — ролик не играет второй раз, сразу постер", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    const errors = collectPageErrors(page);
    await page.goto("/ru?motion=full");
    await expect(hero(page)).toHaveClass(/home-hero--playing/, { timeout: 20_000 });
    await page.locator(".site-header").getByRole("link", { name: "Новостройки" }).click();
    await expect(page).toHaveURL(/\/ru\/novostroyki/);
    const requests: string[] = [];
    page.on("request", (request) => {
      if (/\/hero\/timelapse\/.*\.(webm|mp4)$/.test(request.url())) requests.push(request.url());
    });
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Квартиры в новостройках");
    await page.waitForTimeout(2_000);
    await expect(hero(page)).not.toHaveClass(/home-hero--playing/);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("1440, lite: тот же ролик 1080p", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    await page.goto("/uz?motion=lite");
    await expect(hero(page)).toHaveClass(/home-hero--lite/);
    await expect(video(page)).toHaveAttribute("src", /hero-1080\.webm$/);
    await expect(hero(page)).toHaveClass(/home-hero--playing/, { timeout: 20_000 });
  });

  test("1440, none: только постер «вечер», ролик не скачивается", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-1440",
      "режим без анимации — одной ширины хватает",
    );
    const videoRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/hero\/timelapse\/.*\.(webm|mp4)$/.test(request.url()))
        videoRequests.push(request.url());
    });
    await page.goto("/ru?motion=none");
    await expect(hero(page)).toHaveClass(/home-hero--none/);
    await expect(video(page)).toHaveCount(0);
    expect(await posterSrc(page)).toMatch(/poster-last-(1280|1920)\.(avif|webp)$/);
    await page.waitForTimeout(1_500);
    expect(videoRequests).toEqual([]);
  });

  test("1440, экономия трафика: ролик не качается, остаётся постер", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "одной ширины хватает");
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "connection", {
        configurable: true,
        get: () => ({ saveData: true, effectiveType: "4g" }),
      });
    });
    const videoRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/hero\/timelapse\/.*\.(webm|mp4)$/.test(request.url()))
        videoRequests.push(request.url());
    });
    await page.goto("/ru?motion=lite");
    await expect(hero(page)).toHaveClass(/home-hero--none/, { timeout: 10_000 });
    await expect(video(page)).toHaveCount(0);
    expect(videoRequests).toEqual([]);
  });

  test("390, lite: 9:16, текст внизу первого экрана, факты полосой ниже, без горизонтальной прокрутки", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["mobile-390", "mobile-360", "webkit-390"].includes(testInfo.project.name),
      "телефон",
    );
    const errors = collectPageErrors(page);
    await page.goto("/uz?motion=lite");
    await expect(hero(page)).toHaveClass(/home-hero--lite/);
    await expect(video(page)).toHaveAttribute(
      "src",
      /\/hero\/timelapse\/v1\/hero-portrait\.(webm|mp4)$/,
      {
        timeout: 10_000,
      },
    );
    await expect(video(page)).toHaveAttribute("playsinline", "");
    expect(await posterSrc(page)).toMatch(/poster-portrait-last\.(avif|webp)$/);
    const viewport = page.viewportSize()!;
    const [copy, facts] = await Promise.all([
      page.locator(".home-hero__copy").boundingBox(),
      page.locator(".home-hero__facts").boundingBox(),
    ]);
    // Текст и кнопки — внизу первого экрана, «бесплатно» и цифры — сразу под ним.
    expect((copy?.y ?? 0) + (copy?.height ?? 0)).toBeGreaterThan(viewport.height - 2);
    expect((copy?.y ?? 0) + (copy?.height ?? 0)).toBeLessThan(viewport.height + 120);
    expect(facts?.y ?? 0).toBeGreaterThanOrEqual((copy?.y ?? 0) + (copy?.height ?? 0) - 1);
    // Ничего не уходит за правый край: лента «бесплатно» прокручивается сама, а не раздвигает экран.
    expect((copy?.x ?? 0) + (copy?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
    expect((facts?.x ?? 0) + (facts?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1);
    await expect(page.getByRole("link", { name: /Kvartira tanlash/ }).first()).toBeInViewport({
      ratio: 1,
    });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
    expect(errors).toEqual([]);
  });
});
