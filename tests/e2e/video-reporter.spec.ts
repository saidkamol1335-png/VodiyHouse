import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { expect, test } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors, imageFile } from "./helpers";

// Кабинет видеографа (фаза 5, 5B, мокап CabVideo) против облака: «Новый отчёт» по DEMO-ЖК — 3 фото,
// комментарий RU и UZ, «Отправить на проверку» → «Мои отчёты» с «На проверке». У блока Yulduz отчёт за
// прошлый месяц уже есть (DEMO-сид) — понятный отказ; отчёт по квартире за месяц — сколько угодно. После
// теста строка удаляется (файлы — в папке DEMO-ЖК, их уберёт demo:seed). Скриншот — test-results/screens/<проект>/p5-reporter.png.

async function removeE2eReports(): Promise<void> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('vodiy.skip_audit', 'on', true)");
    await client.query("delete from progress_reports where comment ->> 'ru' like 'E2E ·%'");
    await client.query("commit");
  } finally {
    await client.end();
  }
}

/** Как менеджер (экран проверки — 5D): вернуть отчёт E2E с причиной. */
async function returnE2eReport(note: string): Promise<void> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('vodiy.skip_audit', 'on', true)");
    const { rowCount } = await client.query(
      "update progress_reports set status = 'returned', return_note = $1 where comment ->> 'ru' like 'E2E ·%' and status = 'review'",
      [note],
    );
    await client.query("commit");
    expect(rowCount).toBe(1);
  } finally {
    await client.end();
  }
}

test.describe.serial("кабинет видеографа", () => {
  test.skip(!hasCloud || !process.env.SUPABASE_DB_URL, NO_CLOUD);
  test.use({ storageState: cabinetState("videographer") });
  test.beforeAll(removeE2eReports);
  test.afterAll(removeE2eReports);

  test("«Новый отчёт»: ЖК, прошлый месяц, 3 фото, комментарий → «Мои отчёты» · На проверке", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto("/admin/video");
    await expect(page.getByRole("heading", { level: 1, name: "Отчёты видеографа" })).toBeVisible();
    await expect(page.getByText("Как снимать")).toBeVisible();

    await page.getByLabel("ЖК", { exact: true }).selectOption({ label: "ЖК Yulduz" });
    await page.getByRole("group", { name: "Месяц отчёта" }).getByRole("button").nth(1).click();

    // Без фото и комментария — подсказки формы, не отправка.
    await page.getByRole("button", { name: "Отправить на проверку" }).click();
    await expect(page.getByText("Добавьте минимум 3 фото")).toBeVisible();
    await expect(page.getByText("Комментарий нужен на двух языках")).toBeVisible();

    const files = await Promise.all(
      [0, 1, 2].map(() => imageFile(page, { width: 1800, height: 1200, type: "image/jpeg" })),
    );
    await page
      .locator(".progress-form__add input[type=file]")
      .setInputFiles(files.map((file, index) => ({ ...file, name: `stroyka-${index}.jpg` })));
    await expect(page.locator(".progress-form__shot--done")).toHaveCount(3, { timeout: 30_000 });
    await expect(page.getByText("Фото · 3 из 3–15")).toBeVisible();

    await page.locator("textarea[name='comment.ru']").fill("E2E · Залит 9-й этаж");
    await page.locator("textarea[name='comment.uz']").fill("E2E · 9-qavat quyildi");
    await page.getByRole("button", { name: "Отправить на проверку" }).click();
    await expect(
      page.getByText("Отчёт по этому блоку за месяц уже есть — выберите квартиру или другой месяц"),
    ).toBeVisible({ timeout: 15_000 });

    // Видео квартиры для клиента: первая свободная или в брони квартира блока.
    const unit = page.getByLabel("Квартира · необязательно");
    await expect(unit).toBeEnabled();
    const firstUnit = await unit.locator("option").nth(1).getAttribute("value");
    await unit.selectOption(firstUnit!);

    // Видео с телефона — загрузкой с докачкой (TUS) в progress-video: «.mov» не берётся, MP4 — до «Загружено».
    const videoInput = page.locator(".progress-form__drop input[type=file]");
    await videoInput.setInputFiles({
      name: "iphone.mov",
      mimeType: "video/quicktime",
      buffer: Buffer.alloc(2048),
    });
    await expect(page.getByText(/Нужен MP4/)).toBeVisible();
    const mp4 = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from("ftypmp42"),
      Buffer.alloc(200 * 1024),
    ]);
    await videoInput.setInputFiles({ name: "stroyka.mp4", mimeType: "video/mp4", buffer: mp4 });
    await expect(page.getByText(/Загружено · видео в отчёте/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Отправить на проверку" }).click();
    await expect(page.getByText(/Отчёт отправлен на проверку/)).toBeVisible({ timeout: 15_000 });
    // Форма пустая: фото, квартира и комментарий — с нуля.
    await expect(page.locator(".progress-form__shot--done")).toHaveCount(0);
    await expect(page.locator("textarea[name='comment.ru']")).toHaveValue("");
    await expect(unit).toHaveValue("");

    const mine = page.locator(".video-screen__mine li").first();
    await expect(mine).toContainText("ЖК Yulduz");
    await expect(mine).toContainText(/кв\. \S+/);
    await expect(mine).toContainText("На проверке");
    await page.screenshot({
      path: `test-results/screens/${test.info().project.name}/p5-reporter.png`,
      fullPage: true,
      caret: "initial",
    });
    expect(errors).toEqual([]);
  });

  test("возвращённый отчёт: причина, «Исправить» — форма заполнена, ЖК не меняется → снова на проверке", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await returnE2eReport("E2E · В кадре вывеска застройщика");
    await page.goto("/admin/video");
    const mine = page.locator(".video-screen__mine li").first();
    await expect(mine).toContainText("Возвращён");
    await expect(mine).toContainText("Что исправить: E2E · В кадре вывеска застройщика");
    await mine.getByRole("link", { name: "Исправить" }).click();

    await expect(page.getByText("Исправить отчёт")).toBeVisible();
    await expect(
      page.getByText("Менеджер вернул отчёт: E2E · В кадре вывеска застройщика"),
    ).toBeVisible();
    await expect(page.getByLabel("ЖК", { exact: true })).toBeDisabled();
    await expect(page.locator(".progress-form__shot--done")).toHaveCount(3);
    await expect(page.getByText(/Загружено · видео в отчёте/)).toBeVisible();
    const ru = page.locator("textarea[name='comment.ru']");
    await expect(ru).toHaveValue("E2E · Залит 9-й этаж");
    await ru.fill("E2E · Переснято без вывески");
    await page.getByRole("button", { name: "Отправить на проверку" }).click();

    await expect(page).toHaveURL(/\/admin\/video$/, { timeout: 15_000 });
    await expect(page.getByText("Исправить отчёт")).toHaveCount(0);
    await expect(mine).toContainText("На проверке");
    await expect(mine).not.toContainText("Что исправить");
    expect(errors).toEqual([]);
  });

  test("менеджер: «Ждут проверки» → ящик отчёта, «Опубликовать» — только с отметкой правила 1.2", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: cabinetState("manager") });
    const page = await context.newPage();
    const errors = collectPageErrors(page);
    await page.goto("/admin/video");
    await expect(
      page.getByRole("heading", { level: 1, name: "Видео и ход строительства" }),
    ).toBeVisible();
    await expect(page.getByText(/Ждут проверки · \d+/)).toBeVisible();
    const row = page
      .locator(".progress-review__item", { hasText: "ЖК Yulduz" })
      .filter({ hasText: /кв\. / })
      .first();
    await row.getByRole("link", { name: "Проверить" }).click();

    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("Видео квартиры");
    await expect(drawer).toContainText("E2E · Переснято без вывески");
    const publish = drawer.getByRole("button", { name: "Опубликовать на сайте" });
    await expect(publish).toBeDisabled();
    await drawer.getByLabel(/Проверено по правилу 1\.2/).check();
    await publish.click();
    await expect(page).toHaveURL(/\/admin\/video$/, { timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".progress-review__item", { hasText: "E2E" })).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
});
