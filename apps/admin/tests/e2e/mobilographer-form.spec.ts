import { expect, test, type Page } from "./fixtures";
import { cabinetState, e2eStaff, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";
import {
  complexBySlug,
  E2E_COMMENT,
  hasDb,
  photoFiles,
  removeE2eProgress,
  reportById,
  shiftDay,
  storedObjects,
  tashkentToday,
  videoFile,
  type ComplexInfo,
} from "./progressFixtures";

// Форма отчёта мобилографа (Проект-2, фаза E, пп. 31–33, 37) против облака, DEMO Namuna: дата съёмки
// по Ташкенту с окном 60 дней; «Снять» (камера) и «Из галереи»; черновик с 2 фото и комментарием RU —
// адрес ?id=, перезагрузка не теряет кадры; нет сети — плитка «ждёт сети», связь вернулась — догрузилась;
// «На проверку» без UZ — подсказка; видео — TUS в incoming. Черновики e2e по Namuna убираются.
// Скриншоты — test-results/screens/<проект>/pE-form.png, pE-form-offline.png.

const SLUG = "demo-namuna";
const ID_URL = /\/video\/novyy\?id=([0-9a-f-]{36})$/;

const screen = (page: Page, name: string) =>
  page.screenshot({
    path: `test-results/screens/${test.info().project.name}/${name}.png`,
    caret: "initial",
  });

// Тесты по порядку в одном воркере (не serial: упавший не снимает остальных) — уборка в afterAll не
// задевает черновик соседнего теста.
test.describe.configure({ mode: "default" });

test.describe("форма отчёта мобилографа", () => {
  test.skip(!hasCloud || !hasDb(), NO_CLOUD);
  test.use({ storageState: cabinetState("mobilographer") });
  test.setTimeout(90_000);

  let complex: ComplexInfo;
  const formUrl = () => `/video/novyy?complex=${complex.id}&block=${complex.blocks[0]!.id}`;

  test.beforeAll(async () => {
    complex = await complexBySlug(SLUG);
    await removeE2eProgress({ complexIds: [complex.id] });
  });
  test.afterAll(async () => {
    if (complex) await removeE2eProgress({ complexIds: [complex.id] });
  });

  test("дата съёмки — сегодня по Ташкенту, окно 60 дней; «Снять» — камера, «Из галереи» — несколько файлов", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto(formUrl());
    await expect(page.getByRole("heading", { level: 1, name: "Отчёты мобилографа" })).toBeVisible();
    await expect(page.locator("#progress-complex")).toHaveValue(complex.id);
    const today = tashkentToday();
    const shot = page.getByLabel("Дата съёмки");
    await expect(shot).toHaveAttribute("type", "date");
    await expect(shot).toHaveValue(today);
    await expect(shot).toHaveAttribute("max", today);
    await expect(shot).toHaveAttribute("min", shiftDay(today, -60));
    await expect(page.getByText(/^Отчёт за /)).toBeVisible();

    const camera = page.locator(".progress-form__pick input[type=file][capture=environment]");
    await expect(camera).toHaveCount(1);
    await expect(camera).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(await camera.evaluate((input: HTMLInputElement) => input.multiple)).toBe(false);
    const gallery = page.locator(".progress-form__pick input[type=file][multiple]");
    await expect(gallery).toHaveCount(1);
    expect(await gallery.getAttribute("capture")).toBeNull();
    await expect(
      page.locator(".progress-form__pick-button").filter({ hasText: "Снять" }),
    ).toBeVisible();
    await expect(
      page.locator(".progress-form__pick-button").filter({ hasText: "Из галереи" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Отправить на проверку" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Сохранить черновик" })).toBeVisible();
    await expect(page.getByText("Как снимать")).toBeVisible();
    await screen(page, "pE-form");
    expect(errors).toEqual([]);
  });

  test("черновик: 2 фото и только RU → «Черновик сохранён», адрес ?id=; перезагрузка — кадры на месте; «На проверку» без UZ — подсказка", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    const author = e2eStaff().mobilographer.id;
    await page.goto(formUrl());
    await page
      .locator(".progress-form__pick input[multiple]")
      .setInputFiles(await photoFiles(2, "chernovik"));
    await expect(page.locator(".progress-form__shot--done")).toHaveCount(2, { timeout: 60_000 });
    await expect(page.getByText("Фото · 2 из 3–15")).toBeVisible();
    const ru = `${E2E_COMMENT} Черновик со стройки`;
    await page.locator("textarea[name='comment.ru']").fill(ru);
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page.getByText(/^Черновик сохранён — его видите только вы/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(ID_URL);
    const id = ID_URL.exec(page.url())![1]!;
    await expect(page.getByText("Черновик отчёта", { exact: true })).toBeVisible();
    await expect(page.locator("#progress-complex")).toBeDisabled();

    const draft = await reportById(id);
    expect(draft!.status).toBe("draft");
    expect(draft!.author_id).toBe(author);
    expect(draft!.comment).toEqual({ ru, uz: "" });
    expect(draft!.photos).toHaveLength(2);
    for (const photo of draft!.photos)
      expect(photo.path.startsWith(`${author}/${complex.id}/`)).toBe(true);

    // Перезагрузка: форма из черновика — кадры (подписанные адреса), комментарий, ЖК не меняется.
    await page.reload();
    const tiles = page.locator(".progress-form__shot--done");
    await expect(tiles).toHaveCount(2);
    for (const image of await tiles.locator("img").all()) {
      const src = (await image.getAttribute("src")) ?? "";
      expect(src).toContain("/storage/v1/object/sign/incoming/");
      expect((await page.request.get(src)).status()).toBe(200);
    }
    await expect(page.locator("textarea[name='comment.ru']")).toHaveValue(ru);
    await expect(page.locator("#progress-complex")).toBeDisabled();

    // «На проверку»: 2 фото и нет UZ — подсказки формы, отчёт остаётся черновиком.
    await page.getByRole("button", { name: "Отправить на проверку" }).click();
    await expect(page.getByText("Комментарий нужен на двух языках")).toBeVisible();
    await expect(page.getByText("Добавьте минимум 3 фото")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`\\?id=${id}$`));
    expect((await reportById(id))!.status).toBe("draft");
    expect(errors).toEqual([]);
  });

  test("нет сети во время загрузки — плитка «ждёт сети»; связь вернулась — фото загружено", async ({
    page,
    context,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto(formUrl());
    // Квартиры блока — до обрыва связи (их обрыв — отдельный тест ниже).
    await expect(page.locator("#progress-unit")).toBeEnabled({ timeout: 15_000 });
    const files = await photoFiles(1, "offline");
    await context.setOffline(true);
    await page.locator(".progress-form__pick input[multiple]").setInputFiles(files);
    const waiting = page.locator(".progress-form__shot--waiting");
    await expect(waiting).toHaveCount(1, { timeout: 30_000 });
    await expect(waiting.getByRole("status")).toHaveText("Ждёт сети — загрузится сама");
    // Пока кадр ждёт — «На проверку» просит дождаться загрузки.
    await page.getByRole("button", { name: "Отправить на проверку" }).click();
    const wait = page.getByText("Дождитесь, пока загрузятся фото");
    await expect(wait).toBeVisible();
    await waiting.scrollIntoViewIfNeeded();
    await screen(page, "pE-form-offline");

    await context.setOffline(false);
    await expect(page.locator(".progress-form__shot--done")).toHaveCount(1, { timeout: 30_000 });
    await expect(waiting).toHaveCount(0);
    await expect(page.getByText("Фото · 1 из 3–15")).toBeVisible();
    expect(errors).toEqual([]);
  });

  // Нашёл e2e (фаза E): запрос квартир блока был без catch и повтора — после обрыва связи «Квартира»
  // навсегда оставалась «Загружаем квартиры…». Теперь ошибка поймана, список перезапрашивается по online.
  test("обрыв связи при загрузке квартир: после возврата сети «Квартира» загружается, без ошибок страницы", async ({
    page,
    context,
  }) => {
    const errors = collectPageErrors(page);
    let aborted = false;
    // Первый вызов действия сервера на странице — квартиры блока: обрываем его, как пропавшая сеть.
    await page.route("**/video/novyy**", (route) => {
      const request = route.request();
      if (!aborted && request.method() === "POST" && request.headers()["next-action"]) {
        aborted = true;
        return route.abort("internetdisconnected");
      }
      return route.fallback();
    });
    await page.goto(formUrl());
    await expect.poll(() => aborted).toBe(true);
    await context.setOffline(true);
    await context.setOffline(false);
    await expect(page.locator("#progress-unit")).toBeEnabled({ timeout: 15_000 });
    // Строка браузера о самом оборванном запросе — не ошибка страницы.
    expect(errors.filter((text) => !text.startsWith("Failed to load resource"))).toEqual([]);
  });

  test("видео с телефона: MP4 по TUS в incoming → «Загружено», черновик хранит путь", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    const author = e2eStaff().mobilographer.id;
    await page.goto(formUrl());
    await page.locator(".progress-form__drop input[type=file]").setInputFiles(videoFile());
    await expect(page.getByText("Загружено · видео в отчёте")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".progress-form__upload-bar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await page.locator("textarea[name='comment.ru']").fill(`${E2E_COMMENT} Видео со стройки`);
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page).toHaveURL(ID_URL, { timeout: 30_000 });
    const draft = await reportById(ID_URL.exec(page.url())![1]!);
    expect(draft!.video_path).toMatch(new RegExp(`^${author}/${complex.id}/[0-9a-f-]{36}\\.mp4$`));
    expect(await storedObjects("incoming", [draft!.video_path!])).toEqual([draft!.video_path]);
    expect(errors).toEqual([]);
  });
});
