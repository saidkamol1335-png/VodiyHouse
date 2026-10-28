import { expect, test } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Блок H: первый экран «Чертёж → стройка» — три режима (?motion=full|lite|none), шапка в тонах
// экрана, лента этапов и финал на 1440; на 390 — MP4 без звука и плашка этапа.

const hero = (page: import("@playwright/test").Page) => page.locator(".blueprint-hero");

test.describe("первый экран «Чертёж → стройка»", () => {
  test("1440, full: кадры по прокрутке — синька, этапы, финал «Дом сдан»; шапка тёмная над экраном", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "лента по прокрутке — десктоп");
    const errors = collectPageErrors(page);
    await page.goto("/ru?motion=full");
    await expect(hero(page)).toHaveClass(/blueprint-hero--full/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Квартиры в новостройках Ферганы");
    await expect(page.getByRole("link", { name: /Подобрать квартиру/ }).first()).toHaveAttribute("href", /#katalog$/);
    await expect(page.locator(".blueprint-hero__canvas")).toHaveCount(1);
    await expect(page.locator(".blueprint-hero__video")).toHaveCount(0);
    await expect(hero(page)).toHaveClass(/blueprint-hero--ready/, { timeout: 15_000 });
    await expect(hero(page)).toHaveAttribute("data-stage", "0");
    await expect(page.locator("html")).toHaveAttribute("data-hero-dark", "");
    await expect(page.locator(".site-header")).toHaveClass(/site-header--dark/);
    // Текст стоит по краю логотипа шапки.
    const [logo, content] = await Promise.all([page.locator(".logo").boundingBox(), page.locator(".blueprint-hero__content").boundingBox()]);
    expect(Math.abs((logo?.x ?? 0) - (content?.x ?? 1))).toBeLessThan(2);
    // Середина ленты: синька ушла, вступление спрятано, идёт каркас.
    const scrollLength = await hero(page).evaluate((element) => element.getBoundingClientRect().height - window.innerHeight);
    await page.evaluate((top) => window.scrollTo(0, top), scrollLength * 0.5);
    await expect(hero(page)).toHaveAttribute("data-stage", "3", { timeout: 10_000 });
    await expect(hero(page)).toHaveClass(/blueprint-hero--past-intro/);
    await expect.poll(() => hero(page).evaluate((element) => element.style.getPropertyValue("--hero-blueprint"))).toBe("0.000");
    // Конец ленты: последний этап, финал виден, шапка снова в цветах темы ниже экрана.
    await page.evaluate((top) => window.scrollTo(0, top), scrollLength + 10);
    await expect(hero(page)).toHaveAttribute("data-stage", "7", { timeout: 10_000 });
    await expect(hero(page)).toHaveClass(/blueprint-hero--finale/);
    await expect(page.getByRole("link", { name: "Смотреть квартиры" })).toBeVisible();
    await expect(page.locator(".blueprint-hero__readout")).toContainText("Этап 08 / 08");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator("html")).not.toHaveAttribute("data-hero-dark", "");
    expect(errors).toEqual([]);
  });

  test("1440, none: только постер «Дом сдан», ни холста, ни видео", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "режим без анимации — одной ширины хватает");
    await page.goto("/ru?motion=none");
    await expect(hero(page)).toHaveClass(/blueprint-hero--none/);
    await expect(page.locator(".blueprint-hero__canvas")).toHaveCount(0);
    await expect(page.locator(".blueprint-hero__video")).toHaveCount(0);
    await expect(page.locator(".blueprint-hero__poster img")).toHaveAttribute("src", /poster-end\.webp$/);
    await expect(page.locator(".blueprint-hero__rail")).toHaveCount(0);
  });

  test("390, lite: MP4 без звука, плашка этапа вверху справа, без горизонтальной прокрутки", async ({ page }, testInfo) => {
    test.skip(!["mobile-390", "mobile-360", "webkit-390"].includes(testInfo.project.name), "телефон");
    const errors = collectPageErrors(page);
    await page.goto("/uz?motion=lite");
    await expect(hero(page)).toHaveClass(/blueprint-hero--lite/);
    const video = page.locator(".blueprint-hero__video");
    await expect(video).toHaveCount(1);
    await expect(video).toHaveJSProperty("muted", true);
    await expect(video).toHaveAttribute("playsinline", "");
    await expect(video).toHaveAttribute("src", /hero-mobile\.mp4$/, { timeout: 10_000 });
    const pill = page.locator(".blueprint-hero__rail-current");
    await expect(pill).toBeVisible();
    const [box, viewport] = [await pill.boundingBox(), page.viewportSize()!];
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan(viewport.width * 0.6);
    expect(box?.y ?? 0).toBeLessThan(140);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
    // Текст внизу не дотягивается до плашки этапа (на коротких телефонах запас меньше).
    const content = await page.locator(".blueprint-hero__content").boundingBox();
    expect(content?.y ?? 0).toBeGreaterThan((box?.y ?? 0) + (box?.height ?? 0));
    // Постер телефона — портретный «Дом сдан» (LCP).
    expect(await page.locator(".blueprint-hero__poster img").evaluate((image) => (image as HTMLImageElement).currentSrc)).toMatch(/poster-end-mobile\.webp$/);
    expect(errors).toEqual([]);
  });
});
