import { expect, test, type Browser, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD, type CabinetPersona } from "./cloud";
import { collectPageErrors } from "./helpers";
import {
  complexBySlug,
  hasDb,
  removeE2eProgress,
  reportById,
  seedReport,
  storedObjects,
  withDb,
  type ComplexInfo,
} from "./progressFixtures";

// Кабинет мобилографа (Проект-2, фаза E, пп. 32, 34, 36, 37) против облака, DEMO Seryy (два строящихся
// блока, отчётов нет): «Задания» — «Осталось N из M», «Снять отчёт» открывает форму с ЖК и блоком;
// черновик мобилографа коллеге не виден; «Мои отчёты» — фильтры, «Продолжить», «Открыть», «Удалить» с
// подтверждением; панель Telegram; на 390 — нижняя панель вместо вкладок, на 1440 — наоборот.
// Скриншоты — test-results/screens/<проект>/pE-tasks, pE-mine, pE-telegram, pE-dock (390).

const SLUG = "demo-seryy";

const screen = (page: Page, name: string, fullPage = false) =>
  page.screenshot({
    path: `test-results/screens/${test.info().project.name}/${name}.png`,
    fullPage,
    caret: "initial",
  });

async function personaPage(browser: Browser, persona: CabinetPersona) {
  const context = await browser.newContext({ storageState: cabinetState(persona) });
  const page = await context.newPage();
  return { context, page, errors: collectPageErrors(page) };
}

/** M из «Осталось N из M»: строящиеся блоки ЖК не в архиве (progress_tasks). */
async function buildingBlocks(): Promise<number> {
  return withDb(async (client) => {
    const { rows } = await client.query<{ n: number }>(
      `select count(*)::int as n from public.blocks b join public.complexes c on c.id = b.complex_id
       where c.status <> 'archived' and b.build_status = 'building'`,
    );
    return rows[0]!.n;
  });
}

const taskSection = (page: Page, name: string) =>
  page
    .locator(".progress-tasks__complex")
    .filter({ has: page.getByRole("heading", { level: 3, name: new RegExp(`^${name}`) }) });

const taskRow = (page: Page, complex: string, block: string) =>
  taskSection(page, complex)
    .locator(".progress-tasks__block")
    .filter({ hasText: `Блок ${block}` });

const isPhone = () => test.info().project.name === "mobile-390";

test.describe.configure({ mode: "default" });

test.describe("кабинет мобилографа", () => {
  test.skip(!hasCloud || !hasDb(), NO_CLOUD);
  test.setTimeout(90_000);

  let complex: ComplexInfo;

  test.beforeAll(async () => {
    complex = await complexBySlug(SLUG);
    await removeE2eProgress({ complexIds: [complex.id] });
  });
  test.afterAll(async () => {
    if (complex) await removeE2eProgress({ complexIds: [complex.id] });
  });

  test("«Задания»: «Осталось N из M», блоки Seryy без отчёта; «Снять отчёт» — форма с ЖК и блоком", async ({
    browser,
  }) => {
    const { context, page, errors } = await personaPage(browser, "mobilographer");
    await page.goto("/video");
    await expect(page.getByRole("heading", { level: 1, name: "Отчёты мобилографа" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Задания · / })).toBeVisible();
    const left = page.locator(".progress-tasks__left");
    await expect(left).toHaveText(/^(Осталось \d+ из \d+|Все блоки сняты в этом месяце)$/);
    const [, n, m] = /^Осталось (\d+) из (\d+)$/.exec((await left.textContent()) ?? "") ?? [];
    if (m) {
      expect(Number(m)).toBe(await buildingBlocks());
      expect(Number(n)).toBeLessThanOrEqual(Number(m));
    }
    await expect(page.getByRole("progressbar")).toBeVisible();

    const section = taskSection(page, complex.name);
    await expect(section.getByRole("heading", { level: 3 })).toContainText("0/2");
    for (const block of complex.blocks) {
      const row = taskRow(page, complex.name, block.name);
      await expect(row).toContainText("Нет отчёта");
      await expect(row.getByRole("link", { name: "Снять отчёт" })).toHaveAttribute(
        "href",
        `/video/novyy?complex=${complex.id}&block=${block.id}`,
      );
    }
    await screen(page, "pE-tasks");

    const second = complex.blocks[1]!;
    await taskRow(page, complex.name, second.name)
      .getByRole("link", { name: "Снять отчёт" })
      .click();
    await expect(page).toHaveURL(`/video/novyy?complex=${complex.id}&block=${second.id}`);
    await expect(page.locator("#progress-complex")).toHaveValue(complex.id);
    const blocks = page.getByRole("group", { name: "Блок" });
    await expect(blocks.getByRole("button", { name: `Блок ${second.name}` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      blocks.getByRole("button", { name: `Блок ${complex.blocks[0]!.name}` }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(errors).toEqual([]);
    await context.close();
  });

  test("черновик мобилографа: у него «Черновик · Продолжить», у коллеги блок «Нет отчёта» и черновика в «Моих» нет", async ({
    browser,
  }) => {
    const first = complex.blocks[0]!;
    const draft = await seedReport({ slug: SLUG, block: first.name, status: "draft", photos: 1 });
    const own = await personaPage(browser, "mobilographer");
    await own.page.goto("/video");
    const row = taskRow(own.page, complex.name, first.name);
    await expect(row).toContainText("Черновик");
    await expect(row.getByRole("link", { name: "Продолжить" })).toHaveAttribute(
      "href",
      `/video/novyy?id=${draft}`,
    );
    expect(own.errors).toEqual([]);
    await own.context.close();

    const colleague = await personaPage(browser, "mobilographer2");
    await colleague.page.goto("/video");
    await expect(taskRow(colleague.page, complex.name, first.name)).toContainText("Нет отчёта");
    await colleague.page.goto("/video/moi");
    await expect(
      colleague.page.locator(".progress-mine__item").filter({ hasText: `ЖК ${complex.name}` }),
    ).toHaveCount(0);
    // Чужой черновик по адресу не открывается: пустая форма «Новый отчёт».
    await colleague.page.goto(`/video/novyy?id=${draft}`);
    await expect(
      colleague.page.getByRole("heading", { level: 2, name: "Новый отчёт", exact: true }),
    ).toBeVisible();
    await expect(colleague.page.locator(".progress-form__shot")).toHaveCount(0);
    expect(colleague.errors).toEqual([]);
    await colleague.context.close();
    await removeE2eProgress({ complexIds: [complex.id] });
  });

  test("«Мои отчёты»: фильтры, «Продолжить», «Открыть» (ящик только для чтения), «Удалить» с подтверждением", async ({
    browser,
  }) => {
    const [first, second] = complex.blocks as [ComplexInfo["blocks"][0], ComplexInfo["blocks"][0]];
    const draft = await seedReport({ slug: SLUG, block: first.name, status: "draft", photos: 2 });
    const review = await seedReport({
      slug: SLUG,
      block: second.name,
      status: "review",
      photos: 3,
    });
    const { context, page, errors } = await personaPage(browser, "mobilographer");
    await page.goto("/video/moi");
    const mine = page.locator(".progress-mine__item").filter({ hasText: `ЖК ${complex.name}` });
    await expect(mine).toHaveCount(2);
    const draftRow = mine.filter({ hasText: `Блок ${first.name}` });
    const reviewRow = mine.filter({ hasText: `Блок ${second.name}` });
    await expect(draftRow).toContainText("Черновик");
    await expect(draftRow).toContainText("2 фото");
    await expect(reviewRow).toContainText("На проверке");
    // Миниатюра — подписанный адрес incoming, отвечает 200.
    const thumb = (await draftRow.locator("img.progress-mine__thumb").getAttribute("src")) ?? "";
    expect(thumb).toContain("/storage/v1/object/sign/incoming/");
    expect((await page.request.get(thumb)).status()).toBe(200);
    // Миниатюры обеих строк действительно нарисованы (loading="lazy").
    for (const image of await mine.locator("img.progress-mine__thumb").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth),
        )
        .toBeGreaterThan(0);
    }
    await expect(mine.locator("img.progress-mine__thumb")).toHaveCount(2);
    await page.evaluate(() => window.scrollTo(0, 0));
    await screen(page, "pE-mine", true);

    await page.getByRole("link", { name: "Черновики", exact: true }).click();
    await expect(page).toHaveURL(/\/video\/moi\?status=draft$/);
    await expect(page.getByRole("link", { name: "Черновики" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const badge of await page.locator(".progress-mine__status").all())
      await expect(badge).toHaveText("Черновик");
    await expect(mine).toHaveCount(1);
    await expect(mine).toContainText(`Блок ${first.name}`);

    await page.getByRole("link", { name: "На проверке" }).click();
    await expect(page).toHaveURL(/\/video\/moi\?status=review$/);
    for (const badge of await page.locator(".progress-mine__status").all())
      await expect(badge).toHaveText("На проверке");
    await mine.getByRole("link", { name: "Открыть" }).click();
    // «Открыть» сохраняет фильтр: ящик закрывается обратно в отфильтрованный список.
    await expect(page).toHaveURL(
      new RegExp(`/video/moi\\?(status=review&report=${review}|report=${review}&status=review)$`),
    );
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("Ждёт проверки руководителем по правилу 1.2");
    await expect(drawer.getByRole("button", { name: "Опубликовать на сайте" })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: /^Убрать кадр/ })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Закрыть" }).click();
    await expect(page).toHaveURL(/\/video\/moi\?status=review$/, { timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("link", { name: "Опубликованные" }).click();
    await expect(page).toHaveURL(/\/video\/moi\?status=published$/);
    await expect(mine).toHaveCount(0);
    await page.getByRole("link", { name: "Все", exact: true }).click();
    await expect(page).toHaveURL(/\/video\/moi$/);

    await draftRow.getByRole("link", { name: "Продолжить" }).click();
    await expect(page).toHaveURL(`/video/novyy?id=${draft}`);
    await expect(page.getByText("Черновик отчёта", { exact: true })).toBeVisible();
    await expect(page.locator(".progress-form__shot--done")).toHaveCount(2);

    // «Удалить»: «Отмена» в подтверждении — черновик на месте; «ОК» — строки и файлов нет.
    const files = (await reportById(draft))!.photos.map((photo) => photo.path);
    await page.goto("/video/moi");
    let message = "";
    page.once("dialog", (dialog) => {
      message = dialog.message();
      void dialog.dismiss();
    });
    await draftRow.getByRole("button", { name: "Удалить" }).click();
    await expect.poll(() => message).toBe("Удалить черновик? Фото и видео удалятся тоже.");
    await expect(draftRow).toHaveCount(1);
    expect(await reportById(draft)).not.toBeNull();
    page.once("dialog", (dialog) => void dialog.accept());
    await draftRow.getByRole("button", { name: "Удалить" }).click();
    await expect(draftRow).toHaveCount(0, { timeout: 20_000 });
    expect(await reportById(draft)).toBeNull();
    await expect.poll(() => storedObjects("incoming", files), { timeout: 30_000 }).toEqual([]);
    // На проверке — не удалить автору: кнопки нет.
    await expect(reviewRow.getByRole("button", { name: "Удалить" })).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });

  test("«Уведомления в Telegram» — у мобилографа в «Моих отчётах»; у руководителя нет; менеджеру «Мои отчёты» закрыты", async ({
    browser,
  }) => {
    const own = await personaPage(browser, "mobilographer");
    await own.page.goto("/video/moi");
    const panel = own.page.locator(".progress-telegram");
    await expect(own.page.getByRole("heading", { name: "Уведомления в Telegram" })).toBeVisible();
    await expect(panel).toContainText(
      "Возвращённый отчёт — с причиной, опубликованный — со ссылкой.",
    );
    await expect(panel.getByRole("button", { name: "Привязать Telegram" })).toBeVisible();
    await panel.scrollIntoViewIfNeeded();
    await screen(own.page, "pE-telegram");
    // «Привязать»: ссылка t.me на 15 минут или «Бот не настроен» (без бота в окружении).
    await panel.getByRole("button", { name: "Привязать Telegram" }).click();
    await expect(
      panel
        .getByRole("link", { name: "Открыть Telegram" })
        .or(panel.getByText("Бот не настроен", { exact: false })),
    ).toBeVisible({ timeout: 20_000 });
    const link = panel.getByRole("link", { name: "Открыть Telegram" });
    if (await link.count()) {
      await expect(link).toHaveAttribute("href", /^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=/);
      await expect(panel).toContainText("Ссылка действует 15 минут");
    }
    expect(own.errors).toEqual([]);
    await own.context.close();

    const head = await personaPage(browser, "head");
    await head.page.goto("/video/moi");
    await expect(head.page.getByRole("heading", { name: "Мои отчёты" })).toBeVisible();
    await expect(head.page.locator(".progress-telegram")).toHaveCount(0);
    await head.context.close();

    const manager = await personaPage(browser, "manager");
    await manager.page.goto("/video/moi");
    await expect(manager.page.getByText(/Раздел доступен/)).toBeVisible();
    await manager.context.close();
  });

  test("навигация раздела: на 390 — нижняя панель с aria-current и без вкладок; на 1440 — вкладки, панели нет", async ({
    browser,
  }) => {
    const { context, page, errors } = await personaPage(browser, "mobilographer");
    await page.goto("/video");
    const dock = page.getByRole("navigation", { name: "Кабинет мобилографа" });
    const tabs = page.getByRole("navigation", { name: "Разделы видео и хода строительства" });
    if (isPhone()) {
      await expect(dock).toBeVisible();
      await expect(dock.getByRole("link")).toHaveText(["Задания", "Новый", "Мои", "Медиа"]);
      await expect(dock.getByRole("link", { name: "Задания" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(tabs).toBeHidden();
      // Панель внизу экрана и не перекрывает содержимое: высота отдана странице.
      const box = (await dock.boundingBox())!;
      expect(Math.round(box.y + box.height)).toBe(844);
      expect(
        await page.evaluate(() =>
          document.documentElement.style.getPropertyValue("--video-dock-h"),
        ),
      ).toMatch(/^\d+px$/);
      await screen(page, "pE-dock");
      await dock.getByRole("link", { name: "Мои" }).click();
      await expect(page).toHaveURL(/\/video\/moi$/);
      await expect(dock.getByRole("link", { name: "Мои" })).toHaveAttribute("aria-current", "page");
      await expect(dock.getByRole("link", { name: "Задания" })).not.toHaveAttribute(
        "aria-current",
        "page",
      );
      await dock.getByRole("link", { name: "Новый" }).click();
      await expect(page).toHaveURL(/\/video\/novyy$/);
      await expect(dock.getByRole("link", { name: "Новый" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    } else {
      await expect(dock).toBeHidden();
      await expect(tabs).toBeVisible();
      await expect(tabs.getByRole("link")).toHaveText([
        "Задания",
        "Новый отчёт",
        "Мои отчёты",
        "Медиа ЖК",
      ]);
      await expect(tabs.getByRole("link", { name: "Задания" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await tabs.getByRole("link", { name: "Медиа ЖК" }).click();
      await expect(page).toHaveURL(/\/video\/media$/);
      await expect(tabs.getByRole("link", { name: "Медиа ЖК" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
    expect(errors).toEqual([]);
    await context.close();
  });

  test("руководитель и менеджер: «Проверка» первой вкладкой, нижней панели нет", async ({
    browser,
  }) => {
    for (const persona of ["head", "manager"] as const) {
      const { context, page } = await personaPage(browser, persona);
      await page.goto("/video");
      await expect(
        page.getByRole("heading", { level: 1, name: "Видео и ход строительства" }),
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Кабинет мобилографа" })).toHaveCount(0);
      const tabs = page.getByRole("navigation", { name: "Разделы видео и хода строительства" });
      await expect(tabs.getByRole("link")).toHaveText(
        persona === "head"
          ? ["Проверка", "Новый отчёт", "Мои отчёты", "Медиа ЖК"]
          : ["Проверка", "Медиа ЖК"],
      );
      await context.close();
    }
  });
});
