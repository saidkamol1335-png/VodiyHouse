import { expect, test, type Locator, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Шаг 3.5: «Видео» и «Детали» (вкладка «О ЖК» с фазы D), «Документы» («Документы и проверки») и
// перенос срока в «Блоках» на служебном стенде (/dev/zhk/<id>, DEMO). Проверки форм — настоящие,
// база — в tests/db/site-complex.test.ts. На вкладке несколько форм — у каждой своя кнопка.

const complexUrl = (n: number) => `/dev/zhk/00000000-0000-4000-8000-0000000000c${n}`;
const SHODLIK = complexUrl(1);
const NAMUNA = complexUrl(2);

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Панель вкладки по заголовку: «Видео», «Детали проекта», «Документы»… */
const panel = (page: Page, title: string) =>
  page.locator(".admin-panel").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });
const save = (scope: Page | Locator) => scope.getByRole("button", { name: "Сохранить вкладку" }).click();
const saved = (scope: Page | Locator) =>
  expect(scope.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();

test.describe("кабинет · ЖК · видео, детали, документы, переносы сроков", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("«Документы»: завтрашняя дата — ошибка у документа; проверенный сегодня — «Сохранено»", async ({ page }) => {
    await open(page, `${NAMUNA}/dokumenty`);
    const documents = panel(page, "Документы");
    // У Namuna (строится) акта ввода нет — последняя строка; тест в конце снова её очищает.
    const commissioning = documents.getByLabel("Проверен").last();
    await commissioning.fill("2099-01-01");
    await save(documents);
    await expect(documents.getByText("Дата проверки — не позже сегодняшней")).toBeVisible();
    await commissioning.fill("2026-09-11");
    await save(documents);
    await saved(documents);
    await commissioning.fill("");
    await save(documents);
    await saved(documents);
  });

  test("«Документы и проверки»: визит Vodiy House — своей формой, сохраняет только свою дату", async ({ page }) => {
    await open(page, `${NAMUNA}/dokumenty`);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Документы", "Проверено Vodiy House"]);
    // Форма полей ЖК: кнопка — под панелью, поэтому берём форму целиком.
    const visit = page.locator("form").filter({ has: page.getByRole("heading", { name: "Проверено Vodiy House" }) });
    await expect(visit.getByLabel("Визит сотрудника")).toHaveValue("2026-09-18");
    await visit.getByLabel("Визит сотрудника").fill("2026-09-20");
    await save(visit);
    await saved(visit);
    await expect(panel(page, "Документы").locator(".form-status")).toHaveCount(0);
  });

  test("«Видео» на «О ЖК»: не ролик YouTube — ошибка строки; ссылка youtu.be — «Сохранено»; порядок стрелками", async ({ page }) => {
    await open(page, `${SHODLIK}/o-zhk`);
    const videos = panel(page, "Видео");
    await expect(videos.getByText("Видео нет")).toBeVisible();
    await videos.getByRole("button", { name: "+ Добавить видео" }).click();
    await videos.getByLabel("Ссылка на YouTube").fill("https://vimeo.com/123");
    await save(videos);
    await expect(videos.getByText("Не похоже на ссылку на ролик YouTube")).toBeVisible();
    await videos.getByLabel("Ссылка на YouTube").fill("https://youtu.be/dQw4w9WgXcQ?t=5");
    await videos.getByRole("button", { name: "+ Добавить видео" }).click();
    await videos.getByLabel("Ссылка на YouTube").last().fill("https://www.youtube.com/watch?v=aaaaaaaaaaa");
    await videos.getByRole("button", { name: "Выше" }).last().click();
    await expect(videos.getByLabel("Ссылка на YouTube").first()).toHaveValue(/aaaaaaaaaaa/);
    // Правило 1.2: без отметки про канал и превью ролики не сохраняются.
    await save(videos);
    await expect(videos.locator(".form-status").filter({ hasText: "правилу 1.2" })).toBeVisible();
    await videos.getByRole("checkbox", { name: /Правило 1\.2/ }).check();
    await save(videos);
    await saved(videos);
    await expect(videos.getByRole("checkbox", { name: /Правило 1\.2/ })).not.toBeChecked();
  });

  test("«Детали» на «О ЖК»: половина текста и контакты застройщика — ошибки темы; темы без текста — «пусто»", async ({ page }) => {
    await open(page, `${NAMUNA}/o-zhk`);
    const details = panel(page, "Детали проекта");
    const about = details.locator("details").filter({ hasText: "О проекте" });
    await expect(about).toHaveAttribute("open", "");
    await expect(details.locator("details").filter({ hasText: "Качество и стиль" })).toContainText("пусто");
    await about.getByLabel("Matn · UZ").fill("");
    await save(details);
    await expect(about).toContainText("Нужен текст на узбекском");
    await about.getByLabel("Matn · UZ").fill("Biz bilan: t.me/sifat_qurilish");
    await save(details);
    await expect(about).toContainText("правило 1.2");
    await about.getByLabel("Matn · UZ").fill("DEMO: biznes sinf minorasi.");
    await save(details);
    await saved(details);
  });

  test("мастер (3.6): у черновика 8 шагов с номером и «Далее →» до «Публикации»; у опубликованного — без номеров", async ({ page }) => {
    await open(page, `${complexUrl(5)}/foto`);
    const tabs = page.getByRole("navigation", { name: "Разделы ЖК" }).first();
    await expect(tabs.getByRole("link", { name: "5. Фото" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Далее: 6. Расположение" }).click();
    await expect(page).toHaveURL(/\/raspolozhenie$/);
    await page.getByRole("link", { name: "Далее: 7. Документы и проверки" }).click();
    await expect(page).toHaveURL(/\/dokumenty$/);
    await page.getByRole("link", { name: "Далее: 8. Публикация" }).click();
    await expect(page).toHaveURL(/\/publikatsiya$/);
    // Последний шаг: «Далее» нет — подсказка про чек-лист; кнопка «Опубликовать» — здесь же.
    await expect(page.getByRole("link", { name: /^Далее/ })).toHaveCount(0);
    await expect(page.getByText("Последний шаг: проверьте чек-лист выше")).toBeVisible();
    await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();
    await open(page, `${SHODLIK}/foto`);
    await expect(page.getByRole("link", { name: "Фото", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Далее/ })).toHaveCount(0);
  });

  test("порядок в каталоге (3.6): стрелка переставляет опубликованные ЖК, фокус остаётся на стрелке", async ({ page }) => {
    await open(page, "/dev/zhk");
    const order = page.locator(".catalog-order");
    await expect(order.locator("li").first()).toContainText("Shodlik");
    await page.getByRole("button", { name: "Ниже: Shodlik" }).click();
    await expect(order.locator("li").nth(1)).toContainText("Shodlik");
    await expect(page.getByRole("button", { name: "Ниже: Shodlik" })).toBeFocused();
  });

  test("«Блоки»: новый срок — отметка «это перенос»; история переносов с «Убрать из истории»", async ({ page }) => {
    await open(page, `${SHODLIK}/bloki`);
    const blockB = page.getByTestId("block-card").filter({ has: page.getByText("Блок B", { exact: true }) });
    await blockB.getByRole("button", { name: /Изменить/ }).click();
    await expect(blockB).toContainText("2 кв. 2027 → 4 кв. 2027 · записан 20.08.2026");
    await expect(blockB.getByRole("button", { name: "Убрать из истории" })).toBeVisible();
    const shift = blockB.getByRole("checkbox", { name: /Это перенос срока застройщиком/ });
    await expect(shift).toHaveCount(0);
    await blockB.getByLabel("Квартал").selectOption("1");
    await blockB.getByLabel("Год").selectOption("2028");
    await expect(shift).toBeChecked();
    await expect(blockB).toContainText("«перенесён с 4 кв. 2027»");
    await save(page);
    await saved(page);
  });
});
