import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Тот же ролик стройки, что на первом экране главной (30.10.2026): «Застройщикам» — панель справа,
// «О нас» — фон тёмной карточки (места роликов, docs/design/video/). Играет, когда блок на экране, один
// раз и стоит на вечере; на телефоне этих мест нет и ролик не качается. Chromium Playwright — WebM.

const videoRequests = (page: Page) => {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (/\/hero\/timelapse\/.*\.(webm|mp4)$/.test(request.url())) urls.push(request.url());
  });
  return urls;
};

test.describe("ролик стройки на «Застройщикам» и «О нас»", () => {
  test("1440: панель справа у «Застройщикам» и фон карточки «О нас» — ролик 1080p играет", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    const errors = collectPageErrors(page);
    await page.goto("/ru/dlya-zastroyshchikov?motion=full");
    const panel = page.locator(".partners-hero__media");
    await expect(panel).toBeVisible();
    const [title, box] = await Promise.all([
      page.getByRole("heading", { level: 1 }).boundingBox(),
      panel.boundingBox(),
    ]);
    expect(box?.x ?? 0).toBeGreaterThan((title?.x ?? 0) + 400);
    await expect(panel.locator("video")).toHaveAttribute(
      "src",
      /\/hero\/timelapse\/v2\/hero-1080\.webm$/,
    );
    await expect(panel).toHaveClass(/timelapse-clip--playing/, { timeout: 20_000 });
    // Пауза кнопкой в углу панели (WCAG 2.2.2).
    await panel.getByRole("button", { name: "Остановить ролик" }).click();
    await expect(panel.getByRole("button", { name: "Продолжить ролик" })).toBeVisible();
    await expect
      .poll(() =>
        panel.locator("video").evaluate((element) => (element as HTMLVideoElement).paused),
      )
      .toBe(true);

    await page.goto("/ru/o-nas?motion=full");
    const card = page.locator(".about-hero__card");
    const media = card.locator(".about-hero__media");
    await expect(media).toBeVisible();
    await expect(media).toHaveClass(/timelapse-clip--playing/, { timeout: 20_000 });
    // Кнопка паузы в правом верхнем углу карточки — её не перекрывают цифры, клик доходит.
    await media.getByRole("button", { name: "Остановить ролик" }).click();
    await expect(media.getByRole("button", { name: "Продолжить ролик" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "О Vodiy House" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("1440, none: только постер, ролик не скачивается", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "десктоп");
    const urls = videoRequests(page);
    await page.goto("/ru/o-nas?motion=none");
    await expect(page.locator(".about-hero__media video")).toHaveCount(0);
    await expect(page.locator(".about-hero__media img")).toBeVisible();
    await page.waitForTimeout(1_500);
    expect(urls).toEqual([]);
  });

  test("390: панели и фона нет, ролик не качается, без горизонтальной прокрутки", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["mobile-390", "mobile-360", "webkit-390"].includes(testInfo.project.name),
      "телефон",
    );
    const urls = videoRequests(page);
    await page.goto("/uz/dlya-zastroyshchikov?motion=lite");
    await expect(page.locator(".partners-hero__media")).toBeHidden();
    await page.goto("/uz/o-nas?motion=lite");
    await expect(page.locator(".about-hero__media")).toBeHidden();
    await page.waitForTimeout(1_500);
    expect(urls).toEqual([]);
    const viewport = page.viewportSize()!;
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
  });
});
