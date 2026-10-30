import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Первый экран главной (30.10.2026): полёт дрона над стройкой вместо «Чертёж → стройка». full —
// лента кадров по прокрутке (как в артефакте «Закат»): текст гаснет, на последних кадрах финал «Дом
// сдан»; lite — ролик один раз и стоп на вечере; none и экономия трафика — только постер. Шапка в
// тонах экрана; на телефоне — вырезка 9:16, текст внизу первого экрана, факты полосой под ним.
// Встроенный Chromium Playwright не играет H.264 — проверяем WebM.

const hero = (page: Page) => page.locator(".home-hero");
const video = (page: Page) => page.locator(".home-hero__video");
const canvas = (page: Page) => page.locator(".home-hero__canvas");
const posterSrc = (page: Page) =>
  page
    .locator(".home-hero__poster img")
    .evaluate((image) => (image as HTMLImageElement).currentSrc);

/** Запросы файлов ролика и ленты: ролик (webm, mp4) и кадры отдельно. */
function heroRequests(page: Page) {
  const videos: string[] = [];
  const frames: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/\/hero\/timelapse\/.*\.(webm|mp4)$/.test(url)) videos.push(url);
    if (/\/hero\/timelapse\/v2\/frames\/\d{4}\.webp$/.test(url)) frames.push(url);
  });
  return { videos, frames };
}

const scrollLength = (page: Page) =>
  hero(page).evaluate((element) => element.getBoundingClientRect().height - window.innerHeight);

test.describe("первый экран главной — полёт над стройкой", () => {
  test("1440, full: кадры по прокрутке — текст гаснет, в конце финал и постер; шапка тёмная над экраном", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "лента по прокрутке — десктоп");
    const errors = collectPageErrors(page);
    const requests = heroRequests(page);
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
    // Холст вместо ролика: проявляется с первым кадром, секция выше экрана на ленту.
    await expect(canvas(page)).toHaveCount(1);
    await expect(video(page)).toHaveCount(0);
    await expect(hero(page)).toHaveClass(/home-hero--ready/, { timeout: 15_000 });
    await expect(page.locator(".home-hero__cue")).toContainText("Листайте");
    expect(await scrollLength(page)).toBeGreaterThan(page.viewportSize()!.height * 2);
    expect(requests.frames[0]).toMatch(/\/frames\/0001\.webp$/);
    // Середина ленты: вступление погасло, его ссылки не ловят фокус, но h1 остаётся диктору.
    const length = await scrollLength(page);
    await page.evaluate((top) => window.scrollTo(0, top), length * 0.5);
    await expect(hero(page)).toHaveClass(/home-hero--past-intro/, { timeout: 10_000 });
    await expect(page.locator(".home-hero__copy")).toHaveCSS("opacity", "0");
    await expect(page.locator(".home-hero__copy .home-hero__cta")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator(".home-hero__finale")).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-hero-dark", "");
    // Конец ленты: финал «Дом сдан» с кнопкой к каталогу проявился; последний кадр уступает постеру.
    await page.evaluate((top) => window.scrollTo(0, top + 10), length);
    await expect(hero(page)).toHaveClass(/home-hero--finale/, { timeout: 10_000 });
    await expect(page.locator(".home-hero__finale")).toHaveCSS("opacity", "1");
    await expect(page.getByText("Дом сдан.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Смотреть квартиры/ })).toHaveAttribute(
      "href",
      /#katalog$/,
    );
    await expect(hero(page)).toHaveClass(/home-hero--at-end/, { timeout: 15_000 });
    await expect(canvas(page)).toHaveCSS("opacity", "0");
    expect(requests.videos).toEqual([]);
    // Ниже первого экрана шапка снова в цветах темы, ссылки вступления снова доступны.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator("html")).not.toHaveAttribute("data-hero-dark", "");
    await expect(hero(page)).not.toHaveClass(/home-hero--past-intro/);
    await expect(page.locator(".home-hero__copy .home-hero__cta")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("1440, full по ссылке с #якорем: ленты нет — ролик, место у квиза не прыгает", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    const requests = heroRequests(page);
    await page.goto("/ru?motion=full#podbor");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await expect(hero(page)).toHaveClass(/home-hero--lite/);
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator("#podbor")).toBeInViewport();
    expect(await scrollLength(page)).toBeLessThan(page.viewportSize()!.height);
    await page.waitForTimeout(1_000);
    await expect(page.locator("#podbor")).toBeInViewport();
    expect(requests.frames).toEqual([]);
  });

  test("1440, lite: ролик 1080p проявляется, пауза кнопкой, один раз и стоп на вечере", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    const errors = collectPageErrors(page);
    const requests = heroRequests(page);
    await page.goto("/ru?motion=lite");
    await expect(hero(page)).toHaveClass(/home-hero--lite/);
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator(".home-hero__cue")).toHaveCount(0);
    await expect(page.locator(".home-hero__finale")).toHaveCount(0);
    await expect(video(page)).toHaveAttribute("src", /\/hero\/timelapse\/v2\/hero-1080\.webm$/);
    await expect(video(page)).toHaveJSProperty("muted", true);
    await expect(hero(page)).toHaveClass(/home-hero--playing/, { timeout: 20_000 });
    // Пауза кнопкой (WCAG 2.2.2): ролик стоит и сам не продолжается; кнопка продолжает.
    await page.getByRole("button", { name: "Остановить ролик" }).click();
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
    // Секция — один экран, кадры ленты не качаются.
    expect(await scrollLength(page)).toBeLessThan(page.viewportSize()!.height);
    expect(requests.frames).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("1440, lite: «Назад» на главную — ролик не играет второй раз, сразу постер", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    const errors = collectPageErrors(page);
    await page.goto("/ru?motion=lite");
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

  test("1440, none: только постер «вечер», ни холста, ни ролика", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-1440",
      "режим без анимации — одной ширины хватает",
    );
    const requests = heroRequests(page);
    await page.goto("/ru?motion=none");
    await expect(hero(page)).toHaveClass(/home-hero--none/);
    await expect(video(page)).toHaveCount(0);
    await expect(canvas(page)).toHaveCount(0);
    expect(await posterSrc(page)).toMatch(/\/v2\/poster-last-(1280|1920)\.(avif|webp)$/);
    await page.waitForTimeout(1_500);
    expect(requests.videos).toEqual([]);
    expect(requests.frames).toEqual([]);
  });

  test("1440, экономия трафика: ни ленты, ни ролика — постер", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "одной ширины хватает");
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "connection", {
        configurable: true,
        get: () => ({ saveData: true, effectiveType: "4g" }),
      });
    });
    const requests = heroRequests(page);
    for (const motion of ["full", "lite"]) {
      await page.goto(`/ru?motion=${motion}`);
      await expect(hero(page)).toHaveClass(/home-hero--none/, { timeout: 10_000 });
      await expect(video(page)).toHaveCount(0);
      await expect(canvas(page)).toHaveCount(0);
    }
    await page.waitForTimeout(1_000);
    expect(requests.videos).toEqual([]);
    expect(requests.frames).toEqual([]);
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
      /\/hero\/timelapse\/v2\/hero-portrait\.(webm|mp4)$/,
      {
        timeout: 10_000,
      },
    );
    await expect(video(page)).toHaveAttribute("playsinline", "");
    expect(await posterSrc(page)).toMatch(/\/v2\/poster-portrait-last\.(avif|webp)$/);
    const viewport = page.viewportSize()!;
    const [copy, facts] = await Promise.all([
      page.locator(".home-hero__copy").boundingBox(),
      page.locator(".home-hero__facts").boundingBox(),
    ]);
    // Текст и кнопки — внизу первого экрана, «бесплатно» и цифры — сразу под ним.
    expect((copy?.y ?? 0) + (copy?.height ?? 0)).toBeGreaterThan(viewport.height - 2);
    expect((copy?.y ?? 0) + (copy?.height ?? 0)).toBeLessThan(viewport.height + 120);
    expect(facts?.y ?? 0).toBeGreaterThanOrEqual((copy?.y ?? 0) + (copy?.height ?? 0) - 1);
    // Ничего не уходит за правый край: пилюли «бесплатно» переносятся, а не раздвигают экран.
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
