import { expect, test, type Browser, type Locator, type Page } from "./fixtures";
import { cabinetState, e2eStaff, hasCloud, NO_CLOUD, type CabinetPersona } from "./cloud";
import { collectPageErrors } from "./helpers";
import {
  complexBySlug,
  E2E_COMMENT,
  hasDb,
  photoFiles,
  removeE2eProgress,
  reportById,
  reportsOf,
  ruDate,
  shotDayThisMonth,
  storedObjects,
  type ComplexInfo,
} from "./progressFixtures";
import { site } from "./site";

// Путь отчёта мобилографа целиком (Проект-2, фаза E, пп. 31–38) против облака, DEMO Yulduz (один
// строящийся блок). Отчёт блока за текущий месяц у DEMO уже есть («один на блок за месяц»), поэтому
// отчёт e2e — видео квартиры (их сколько угодно): мобилограф — дата съёмки, квартира, 4 фото в incoming,
// комментарий RU и UZ, «Отправить на проверку» → «Мои отчёты»; руководитель — ящик с подписанными
// кадрами, «Убрать кадр» (4 → 3, дальше нельзя), «Вернуть автору»; мобилограф — «Исправить» → снова на
// проверку; менеджер — ящик без «Опубликовать»; руководитель публикует с отметкой 1.2 → в базе пути
// complexes/…, в incoming файлов отчёта нет → сайт /ru/video/<id> «Снято <дата съёмки>». Отчёт и файлы
// убираются.
// Скриншот — test-results/screens/<проект>/pE-review.png.

const SLUG = "demo-yulduz";
const SHOT = shotDayThisMonth();
const RU = `${E2E_COMMENT} Залит 9-й этаж`;
const UZ = `${E2E_COMMENT} 9-qavat quyildi`;
const RU_FIXED = `${E2E_COMMENT} Переснято без вывески`;
const NOTE = `${E2E_COMMENT} В кадре вывеска застройщика`;

const screen = (page: Page, name: string) =>
  page.screenshot({
    path: `test-results/screens/${test.info().project.name}/${name}.png`,
    caret: "initial",
  });

async function personaPage(browser: Browser, persona: CabinetPersona) {
  const context = await browser.newContext({ storageState: cabinetState(persona) });
  const page = await context.newPage();
  return { context, page, errors: collectPageErrors(page) };
}

/** Кадры ящика: адрес подписан сервером (incoming) или публичный — и отвечает 200. */
async function expectImagesLoad(page: Page, images: Locator, signed: boolean): Promise<string[]> {
  const sources: string[] = [];
  for (const image of await images.all()) {
    const src = (await image.getAttribute("src")) ?? "";
    expect(src, "у кадра есть адрес").not.toBe("");
    if (signed) expect(src).toContain("/storage/v1/object/sign/incoming/");
    const response = await page.request.get(src);
    expect(response.status(), src).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/jpeg");
    sources.push(src);
  }
  return sources;
}

test.describe
  .serial("отчёт мобилографа: отправка → проверка → возврат → исправление → публикация", () => {
  test.skip(!hasCloud || !hasDb(), NO_CLOUD);
  // Загрузка 4 фото и переходы с действиями сервера в общем прогоне — дольше 30 с.
  test.setTimeout(120_000);

  let complex: ComplexInfo;
  let reportId = "";
  let submittedPaths: string[] = [];
  let unitNumber = "";

  test.beforeAll(async () => {
    complex = await complexBySlug(SLUG);
    await removeE2eProgress({ complexIds: [complex.id] });
  });
  test.afterAll(async () => {
    if (complex) await removeE2eProgress({ complexIds: [complex.id] });
  });

  test("мобилограф: ЖК, дата съёмки, 4 фото, RU и UZ → «Отправить на проверку» → «Мои отчёты» · Отправлено руководителю", async ({
    browser,
  }) => {
    const { context, page, errors } = await personaPage(browser, "mobilographer");
    const author = e2eStaff().mobilographer.id;
    await page.goto("/video/novyy");
    await expect(page.getByRole("heading", { level: 1, name: "Отчёты мобилографа" })).toBeVisible();
    await page.locator("#progress-complex").selectOption({ label: `ЖК ${complex.name}` });
    await page.locator("#progress-shot").fill(SHOT);
    await expect(page.getByText(/^Отчёт за /)).toBeVisible();
    // Квартира: первая свободная или в брони квартира блока («Кв. 12 · 3 эт. · …»).
    const unit = page.locator("#progress-unit");
    await expect(unit).toBeEnabled({ timeout: 15_000 });
    const option = unit.locator("option").nth(1);
    unitNumber = /^Кв\. (\S+) ·/.exec((await option.textContent()) ?? "")![1]!;
    await unit.selectOption((await option.getAttribute("value"))!);

    await page.locator(".progress-form__pick input[multiple]").setInputFiles(await photoFiles(4));
    await expect(page.locator(".progress-form__shot--done")).toHaveCount(4, { timeout: 60_000 });
    await expect(page.getByText("Фото · 4 из 3–15")).toBeVisible();
    await page.locator("textarea[name='comment.ru']").fill(RU);
    await page.locator("textarea[name='comment.uz']").fill(UZ);
    await page.getByRole("button", { name: "Отправить на проверку" }).click();

    // Без привязанного бота — «…сообщение в Telegram не ушло» (sent=quiet), с ботом — sent=1.
    await expect(page).toHaveURL(/\/video\/moi\?sent=(1|quiet)$/, { timeout: 30_000 });
    await expect(page.getByText(/^Отправлено руководителю/)).toBeVisible();
    const item = page
      .locator(".progress-mine__item")
      .filter({ hasText: `ЖК ${complex.name}` })
      .first();
    await expect(item).toContainText("На проверке");
    await expect(item).toContainText(`кв. ${unitNumber}`);
    await expect(item).toContainText(`снято ${ruDate(SHOT)} · 4 фото`);

    const [report] = (await reportsOf(author, complex.id)).filter((row) => row.status === "review");
    expect(report, "отчёт на проверке в базе").toBeTruthy();
    reportId = report!.id;
    expect(report!.shot_on).toBe(SHOT);
    expect(report!.month).toBe(`${SHOT.slice(0, 7)}-01`);
    expect(report!.comment).toEqual({ ru: RU, uz: UZ });
    expect(report!.photos).toHaveLength(4);
    // Кадры — в приватном incoming, в папке автора и ЖК.
    for (const photo of report!.photos) {
      expect(photo.path).toMatch(new RegExp(`^${author}/${complex.id}/[0-9a-f-]{36}\\.jpg$`));
    }
    submittedPaths = report!.photos.map((photo) => photo.path);
    expect(await storedObjects("incoming", submittedPaths)).toHaveLength(4);
    expect(errors).toEqual([]);
    await context.close();
  });

  test("руководитель: ящик с подписанными кадрами, «Убрать кадр» 4 → 3 (дальше неактивна), «Вернуть автору» с причиной", async ({
    browser,
  }) => {
    const { context, page, errors } = await personaPage(browser, "head");
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto(`/video?report=${reportId}`);
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText(RU);
    await expect(drawer).toContainText(UZ);
    await expect(drawer).toContainText(
      `${complex.name} · Блок ${complex.blocks[0]!.name} · кв. ${unitNumber}`,
    );
    await expect(drawer.getByRole("heading", { name: /^Видео квартиры · / })).toBeVisible();
    await expect(drawer).toContainText(`Снял E2E Мобилограф · ${ruDate(SHOT)}`);
    const images = drawer.locator(".progress-review__photos img");
    await expect(images).toHaveCount(4);
    await expectImagesLoad(page, images, true);
    await screen(page, "pE-review");

    const removes = drawer.getByRole("button", { name: /^Убрать кадр \d+$/ });
    await expect(removes).toHaveCount(4);
    for (const button of await removes.all()) await expect(button).toBeEnabled();
    await drawer.getByRole("button", { name: "Убрать кадр 1", exact: true }).click();
    await expect(images).toHaveCount(3, { timeout: 20_000 });
    await expect(removes).toHaveCount(3);
    for (const button of await removes.all()) {
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute("title", "Должно остаться не меньше 3 фото");
    }
    const afterRemove = await reportById(reportId);
    expect(afterRemove!.photos.map((photo) => photo.path)).toEqual(submittedPaths.slice(1));
    // Убранный кадр сервер удалил из incoming.
    await expect.poll(() => storedObjects("incoming", [submittedPaths[0]!])).toEqual([]);

    await drawer.getByRole("button", { name: "Вернуть автору" }).click();
    await drawer.getByLabel("Что исправить").fill(NOTE);
    await drawer.getByRole("button", { name: "Вернуть автору" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/video$/);
    const returned = await reportById(reportId);
    expect(returned!.status).toBe("returned");
    expect(returned!.return_note).toBe(NOTE);
    expect(errors).toEqual([]);
    await context.close();
  });

  test("мобилограф: «Возвращён» с причиной, «Исправить» — форма заполнена, ЖК не меняется → снова на проверку", async ({
    browser,
  }) => {
    const { context, page, errors } = await personaPage(browser, "mobilographer");
    await page.goto("/video/moi");
    const item = page
      .locator(".progress-mine__item")
      .filter({ hasText: `ЖК ${complex.name}` })
      .filter({ hasText: "Возвращён" });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(`Что исправить: ${NOTE}`);
    await item.getByRole("link", { name: "Исправить" }).click();

    await expect(page).toHaveURL(new RegExp(`/video/novyy\\?id=${reportId}$`));
    await expect(page.getByText("Исправить отчёт", { exact: true })).toBeVisible();
    await expect(page.getByText(`Руководитель вернул отчёт: ${NOTE}`)).toBeVisible();
    await expect(page.locator("#progress-complex")).toBeDisabled();
    await expect(page.locator("#progress-shot")).toHaveValue(SHOT);
    await expect(page.locator("#progress-unit option:checked")).toHaveText(
      new RegExp(`^Кв\\. ${unitNumber} ·`),
    );
    const tiles = page.locator(".progress-form__shot--done");
    await expect(tiles).toHaveCount(3);
    // Превью сохранённых кадров — адреса, подписанные сервером.
    await expectImagesLoad(page, tiles.locator("img"), true);
    const ru = page.locator("textarea[name='comment.ru']");
    await expect(ru).toHaveValue(RU);
    await expect(page.locator("textarea[name='comment.uz']")).toHaveValue(UZ);
    await ru.fill(RU_FIXED);
    await page.getByRole("button", { name: "Отправить на проверку" }).click();

    await expect(page).toHaveURL(/\/video\/moi\?sent=(1|quiet)$/, { timeout: 30_000 });
    const again = page
      .locator(".progress-mine__item")
      .filter({ hasText: `ЖК ${complex.name}` })
      .first();
    await expect(again).toContainText("На проверке");
    await expect(again).not.toContainText("Что исправить");
    const resubmitted = await reportById(reportId);
    expect(resubmitted!.status).toBe("review");
    expect(resubmitted!.comment.ru).toBe(RU_FIXED);
    expect(resubmitted!.photos).toHaveLength(3);
    expect(errors).toEqual([]);
    await context.close();
  });

  test("менеджер: ящик с кадрами, без «Опубликовать» и «Убрать кадр»", async ({ browser }) => {
    const { context, page, errors } = await personaPage(browser, "manager");
    await page.goto(`/video?report=${reportId}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Видео и ход строительства" }),
    ).toBeVisible();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText(RU_FIXED);
    await expectImagesLoad(page, drawer.locator(".progress-review__photos img"), true);
    await expect(drawer.getByRole("button", { name: "Опубликовать на сайте" })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: /^Убрать кадр/ })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Вернуть автору" })).toHaveCount(0);
    await expect(drawer).toContainText("Ждёт проверки руководителем по правилу 1.2");
    expect(errors).toEqual([]);
    await context.close();
  });

  test("руководитель публикует только с отметкой 1.2 → пути complexes/…, incoming пуст; «Ссылка» → «Скопировано»", async ({
    browser,
  }) => {
    const { context, page, errors } = await personaPage(browser, "head");
    await page.goto(`/video?report=${reportId}`);
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText(RU_FIXED);
    const publish = drawer.getByRole("button", { name: "Опубликовать на сайте" });
    await expect(publish).toBeDisabled();
    await drawer.getByLabel(/Проверено по правилу 1\.2/).check();
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/video$/);

    const published = await reportById(reportId);
    expect(published!.status).toBe("published");
    expect(published!.photos).toHaveLength(3);
    const incoming = submittedPaths.slice(1);
    for (const photo of published!.photos) {
      expect(photo.path).toMatch(new RegExp(`^complexes/${complex.id}/[0-9a-f-]{36}\\.jpg$`));
      expect(photo.publish_path).toBeNull();
      expect(incoming).not.toContain(photo.path);
    }
    const publicPaths = published!.photos.map((photo) => photo.path);
    expect(await storedObjects("media", publicPaths)).toHaveLength(3);
    // Файлы incoming сервер удаляет после публикации.
    await expect.poll(() => storedObjects("incoming", submittedPaths)).toEqual([]);

    // «Видео для клиентов»: опубликованный отчёт — со ссылкой для клиента.
    const video = page
      .locator(".progress-overview__video")
      .filter({ hasText: `ЖК ${complex.name}` })
      .filter({ hasText: `снято ${ruDate(SHOT)}` })
      .first();
    await expect(video).toContainText("Видео квартиры");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await video.getByRole("button", { name: "Ссылка" }).click();
    await expect(video.getByRole("button", { name: "Скопировано" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      new RegExp(`/ru/video/${reportId}$`),
    );
    expect(errors).toEqual([]);
    await context.close();
  });

  test("мобилограф видит «Опубликован»; сайт: видео квартиры /ru/video/<id> — «Снято <дата съёмки>», без номера", async ({
    browser,
    page,
  }) => {
    const mobile = await personaPage(browser, "mobilographer");
    await mobile.page.goto("/video/moi?status=published");
    await expect(
      mobile.page
        .locator(".progress-mine__item")
        .filter({ hasText: `ЖК ${complex.name}` })
        .first(),
    ).toContainText("Опубликован");
    await mobile.context.close();

    const errors = collectPageErrors(page);
    await page.goto(site(`/ru/video/${reportId}?motion=none`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Как квартира выглядит сейчас",
    );
    const main = page.locator("main");
    await expect(main).toContainText(`ЖК ${complex.name}`);
    await expect(main).toContainText(`Снято ${ruDate(SHOT)}`);
    await expect(main).toContainText(RU_FIXED);
    await expect(main).not.toContainText(/Кв\.\s?\d|№\s?\d/);
    // Кадры на сайте — из публичного бакета media.
    const photo = main
      .locator(
        `img[src*="/storage/v1/object/public/media/complexes/${complex.id}/"], img[srcset*="complexes%2F${complex.id}"], img[src*="complexes%2F${complex.id}"]`,
      )
      .first();
    await expect(photo).toBeAttached();
    expect(errors).toEqual([]);
  });
});
