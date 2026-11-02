import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Шаг 3.5: вкладки ЖК «Видео», «Детали», «Документы» и перенос срока в «Блоках» на служебном
// стенде (/dev/zhk/<id>, DEMO). Проверки форм — настоящие, база — в tests/db/site-complex.test.ts.

const complexUrl = (n: number) => `/dev/zhk/00000000-0000-4000-8000-0000000000c${n}`;
const SHODLIK = complexUrl(1);
const NAMUNA = complexUrl(2);

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

const save = (page: Page) => page.getByRole("button", { name: "Сохранить вкладку" }).click();
const saved = (page: Page) => expect(page.locator(".form-status").filter({ hasText: "Сохранено" })).toBeVisible();

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
    // У Namuna (строится) акта ввода нет — последняя строка; тест в конце снова её очищает.
    const commissioning = page.getByLabel("Проверен").last();
    await commissioning.fill("2099-01-01");
    await save(page);
    await expect(page.getByText("Дата проверки — не позже сегодняшней")).toBeVisible();
    await commissioning.fill("2026-09-11");
    await save(page);
    await saved(page);
    await commissioning.fill("");
    await save(page);
    await saved(page);
  });

  test("«Видео»: не ролик YouTube — ошибка строки; ссылка youtu.be — «Сохранено»; порядок стрелками", async ({ page }) => {
    await open(page, `${SHODLIK}/video`);
    await expect(page.getByText("Видео нет")).toBeVisible();
    await page.getByRole("button", { name: "+ Добавить видео" }).click();
    await page.getByLabel("Ссылка на YouTube").fill("https://vimeo.com/123");
    await save(page);
    await expect(page.getByText("Не похоже на ссылку на ролик YouTube")).toBeVisible();
    await page.getByLabel("Ссылка на YouTube").fill("https://youtu.be/dQw4w9WgXcQ?t=5");
    await page.getByRole("button", { name: "+ Добавить видео" }).click();
    await page.getByLabel("Ссылка на YouTube").last().fill("https://www.youtube.com/watch?v=aaaaaaaaaaa");
    await page.getByRole("button", { name: "Выше" }).last().click();
    await expect(page.getByLabel("Ссылка на YouTube").first()).toHaveValue(/aaaaaaaaaaa/);
    // Правило 1.2: без отметки про канал и превью ролики не сохраняются.
    await save(page);
    await expect(page.locator(".form-status").filter({ hasText: "правилу 1.2" })).toBeVisible();
    await page.getByRole("checkbox", { name: /Правило 1\.2/ }).check();
    await save(page);
    await saved(page);
    await expect(page.getByRole("checkbox", { name: /Правило 1\.2/ })).not.toBeChecked();
  });

  test("«Детали»: половина текста и контакты застройщика — ошибки темы; темы без текста — «пусто»", async ({ page }) => {
    await open(page, `${NAMUNA}/detali`);
    const about = page.locator("details").filter({ hasText: "О проекте" });
    await expect(about).toHaveAttribute("open", "");
    await expect(page.locator("details").filter({ hasText: "Качество и стиль" })).toContainText("пусто");
    await about.getByLabel("Matn · UZ").fill("");
    await save(page);
    await expect(about).toContainText("Нужен текст на узбекском");
    await about.getByLabel("Matn · UZ").fill("Biz bilan: t.me/sifat_qurilish");
    await save(page);
    await expect(about).toContainText("правило 1.2");
    await about.getByLabel("Matn · UZ").fill("DEMO: biznes sinf minorasi.");
    await save(page);
    await saved(page);
  });

  test("мастер (3.6): у черновика шаги с номером и «Далее →» до предпросмотра; у опубликованного — без номеров", async ({ page }) => {
    await open(page, `${complexUrl(5)}/foto`);
    const tabs = page.getByRole("navigation", { name: "Разделы ЖК" }).first();
    await expect(tabs.getByRole("link", { name: "5. Фото" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Далее: 6. Видео" }).click();
    await expect(page).toHaveURL(/\/video$/);
    // Черновика Gulzor в облаке нет (на стенде нет и сессии сотрудника) — фрейм получает пустую страницу.
    await page.route("**/novostroyki/demo-gulzor", (route) => route.fulfill({ contentType: "text/html", body: "" }));
    await open(page, `${complexUrl(5)}/predprosmotr`);
    await expect(page.getByText("Опубликовать ЖК — кнопкой «Опубликовать»")).toBeVisible();
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
