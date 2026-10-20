import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors, imageFile, type ImageSpec } from "./helpers";

// Шаг 9 фазы 1: подготовка фото в браузере перед загрузкой (/dev/media). Приёмка фазы:
// «фото 800 px отклоняется». Картинки рисуются прямо в браузере — фикстуры в git не нужны.

async function choose(page: Page, spec: ImageSpec) {
  await page.getByTestId("media-input").setInputFiles(await imageFile(page, spec));
}

test.describe("подготовка фото перед загрузкой", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = collectPageErrors(page);
    await page.goto("/dev/media");
    await expect(
      page.getByRole("heading", { name: "Подготовка фото перед загрузкой" }),
    ).toBeVisible();
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("рендер 4000 × 3000 с EXIF → 3200 × 2400 JPEG без EXIF, blur и три кадра", async ({
    page,
  }) => {
    await choose(page, { width: 4000, height: 3000, type: "image/jpeg", exifOrientation: 1 });
    await expect(page.getByTestId("fact-stored")).toContainText("3200 × 2400");
    await expect(page.getByTestId("fact-stored")).toContainText("image/jpeg");
    await expect(page.getByTestId("fact-exif")).toHaveText("исходник — есть, в бакет — нет");
    await expect(page.getByTestId("media-blur")).toHaveAttribute(
      "src",
      /^data:image\/jpeg;base64,/,
    );
    for (const frame of ["cover", "card", "phone"]) {
      await expect(page.getByTestId(`frame-${frame}`)).toBeVisible();
    }
    await expect(page.getByTestId("media-not-cover")).toHaveCount(0);
  });

  test("снимок «на боку» (EXIF 6) поворачивается: 2400 × 3200", async ({ page }) => {
    await choose(page, { width: 4000, height: 3000, type: "image/jpeg", exifOrientation: 6 });
    await expect(page.getByTestId("fact-source")).toContainText("3000 × 4000");
    await expect(page.getByTestId("fact-stored")).toContainText("2400 × 3200");
  });

  test("фото 800 px отклоняется — приёмка фазы 1", async ({ page }) => {
    await choose(page, { width: 800, height: 600, type: "image/jpeg" });
    await expect(page.getByTestId("media-issue")).toHaveText(
      /Слишком маленькое: 800 px .*от 1600 px/,
    );
    await expect(page.getByTestId("media-result")).toHaveCount(0);
  });

  test("не тот формат и тяжелее 25 МБ — понятные ошибки", async ({ page }) => {
    await choose(page, { width: 2000, height: 1500, type: "image/gif" });
    await expect(page.getByTestId("media-issue")).toContainText("JPEG или PNG");

    await page.getByTestId("media-input").setInputFiles({
      name: "huge.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(26 * 1024 * 1024),
    });
    await expect(page.getByTestId("media-issue")).toContainText("Файл больше 25 МБ");
  });

  test("логотип остаётся PNG и не растягивается", async ({ page }) => {
    await page.getByRole("button", { name: "Логотип застройщика" }).click();
    await choose(page, { width: 1000, height: 500, type: "image/png" });
    await expect(page.getByTestId("fact-stored")).toContainText("1000 × 500");
    await expect(page.getByTestId("fact-stored")).toContainText("image/png");
    await expect(page.getByTestId("media-blur")).toHaveAttribute("src", /^data:image\/png;base64,/);
  });

  test("смена вида переоценивает тот же файл: 2000 px — галерея да, обложка нет", async ({
    page,
  }) => {
    await choose(page, { width: 2000, height: 1500, type: "image/jpeg" });
    await expect(page.getByTestId("media-not-cover")).toContainText("от 2400 px");
    await page.getByRole("button", { name: "Фон застройщика" }).click();
    await expect(page.getByTestId("media-issue")).toHaveText(/2000 px .*от 2400 px/);
  });

  test("точка фокуса двигает кадры — тапом и стрелками", async ({ page }) => {
    await choose(page, { width: 3000, height: 2000, type: "image/jpeg" });
    const phone = page.getByTestId("frame-phone");
    await expect(phone).toHaveCSS("object-position", "50% 50%");

    const stage = page.getByTestId("focus-stage");
    const box = (await stage.boundingBox())!;
    await stage.click({ position: { x: box.width - 2, y: box.height / 2 } });
    await expect(phone).toHaveCSS("object-position", "100% 50%");

    await stage.click({ position: { x: box.width * 0.3, y: box.height / 2 } });
    await expect(phone).toHaveCSS("object-position", /^7(\.\d)?% 50%$/);
    // Шаг стрелкой — 5 %: от ~30 % шесть шагов влево упирают кадр в левый край.
    for (let step = 0; step < 6; step += 1) await stage.press("ArrowLeft");
    await expect(phone).toHaveCSS("object-position", "0% 50%");
  });

  test("страница не шире экрана — пять видов прокручиваются внутри ряда", async ({ page }) => {
    await choose(page, { width: 3000, height: 2000, type: "image/jpeg" });
    await expect(page.getByTestId("media-result")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("скриншот стенда", async ({ page }, testInfo) => {
    await choose(page, { width: 4000, height: 3000, type: "image/jpeg", exifOrientation: 1 });
    await expect(page.getByTestId("media-result")).toBeVisible();
    const box = (await page.getByTestId("focus-stage").boundingBox())!;
    await page
      .getByTestId("focus-stage")
      .click({ position: { x: box.width * 0.2, y: box.height * 0.25 } });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `test-results/screens/${testInfo.project.name}/dev-media.png`,
      fullPage: true,
    });
  });
});
