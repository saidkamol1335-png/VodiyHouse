import { expect, test, type Page } from "./fixtures";
import { hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// Шаг 3.17: квиз «Подбор за 1 минуту». 1440 — раздел главной (#podbor): четыре вопроса, живой
// счётчик теми же функциями фильтра, что и выдача каталога, поэтому «Показать N ЖК» открывает
// ровно N карточек; контакты → заявка quiz с ответами и ссылкой (имя «E2E …», удаляет
// global-teardown). 390 — на главной только вступление и «Начать подбор» → /podbor с анкетой
// во весь экран и счётчиком внизу. Скриншоты — test-results/screens/<проект>/s317-*.png.

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/s317-${name}.png`, caret: "initial" });
/** Местный номер оператора 90 (не «98…»: маска не примет его за код страны). */
const phoneOf = (seed: number) => `90${String(seed % 10_000_000).padStart(7, "0")}`;

test.use({ extraHTTPHeaders: { "x-nf-client-connection-ip": `e2e-${crypto.randomUUID()}` } });

test.describe("квиз «Подбор за 1 минуту»", () => {
  test.skip(!hasCloud, NO_CLOUD);

  test("1440: раздел главной — ответы меняют счётчик, контакты → заявка с номером, «Показать N ЖК» открывает ровно N", async ({ page, isMobile }) => {
    test.skip(isMobile, "на телефоне анкета живёт на /podbor");
    const errors = collectPageErrors(page);
    await page.goto("/ru?motion=lite#podbor");
    const quiz = page.locator("#podbor .quiz");
    const count = quiz.locator(".quiz__intro .quiz__count b");
    await expect(count).toHaveText("4");
    await expect(page.locator(".home-hero__quiz")).toHaveAttribute("href", "#podbor");
    await shot(page, "home-quiz");
    // Комнаты — несколько; без выбора — «Пропустить».
    await expect(quiz.getByRole("button", { name: "Пропустить" })).toBeVisible();
    await quiz.getByRole("button", { name: "2-комн." }).click();
    await expect(quiz.getByRole("button", { name: "2-комн." })).toHaveAttribute("aria-pressed", "true");
    await quiz.getByRole("button", { name: "Дальше" }).click();
    await expect(quiz.locator(".quiz__step")).toHaveText("Вопрос 2 из 5");
    // Один вариант — сразу следующий вопрос; «Назад» возвращает.
    await quiz.getByRole("button", { name: "Не важно" }).click();
    await expect(quiz.locator(".quiz__step")).toHaveText("Вопрос 3 из 5");
    await quiz.getByRole("button", { name: "Назад" }).click();
    await expect(quiz.locator(".quiz__step")).toHaveText("Вопрос 2 из 5");
    await quiz.getByRole("button", { name: /до \$45/ }).click();
    await quiz.getByRole("button", { name: "Рассрочка" }).click();
    await expect(quiz.locator(".quiz__step")).toHaveText("Вопрос 4 из 5");
    await quiz.getByRole("button", { name: "В течение года" }).click();
    await expect(quiz.locator(".quiz__step")).toHaveText("Вопрос 5 из 5");
    await expect(quiz.getByRole("heading", { name: "Куда прислать подборку?" })).toBeVisible();
    const answers = quiz.getByRole("list", { name: "Ваши ответы" });
    await expect(answers).toContainText("2-комн.");
    await expect(answers).toContainText("Рассрочка");
    await expect(answers).toContainText("В течение года");
    const total = Number(await count.textContent());
    expect(total).toBeGreaterThan(0);
    await shot(page, "home-contact");
    // Контакты — те же правила, что у формы заявки (ТЗ 10.2).
    await quiz.getByRole("button", { name: "Получить подборку" }).click();
    await expect(quiz.getByText("Укажите имя")).toBeVisible();
    await quiz.getByLabel("Имя").fill("E2E Квиз");
    await quiz.getByLabel("Телефон").fill(phoneOf(Date.now() + Math.floor(Math.random() * 1000)));
    await quiz.getByRole("button", { name: "Получить подборку" }).click();
    const done = quiz.getByRole("status");
    await expect(done).toContainText("Подборка готова", { timeout: 15_000 });
    await expect(done).toContainText(/Номер заявки #\d+/);
    await expect(done).toBeFocused();
    await expect(quiz.locator(".quiz__step")).toHaveText("Подборка готова");
    await shot(page, "home-done");
    // «Показать N ЖК» — каталог с теми же ответами в адресе и ровно N карточками.
    const show = done.getByRole("link", { name: `Показать ${total} ЖК` });
    await expect(show).toHaveAttribute("href", /\/ru\/novostroyki\?.*komnat=2/);
    await expect(show).toHaveAttribute("href", /oplata=inst/);
    await show.click();
    await expect(page).toHaveURL(/\/ru\/novostroyki\?/);
    // Прошлая страница остаётся в DOM скрытой (кэш маршрутов Next) — считаем только видимые карточки.
    await expect(page.locator("main:visible .catalog-card")).toHaveCount(total);
    await expect(page.locator("main:visible .catalog-results__count")).toHaveText(`Найден ${total} ЖК`);
    expect(errors).toEqual([]);
  });

  test("390: на главной — вступление и «Начать подбор»; /podbor — анкета во весь экран, счётчик внизу, без горизонтальной прокрутки", async ({ page, isMobile }) => {
    test.skip(!isMobile, "телефонная анкета");
    const errors = collectPageErrors(page);
    await page.goto("/ru?motion=lite#podbor");
    const section = page.locator("#podbor .quiz");
    await expect(section.locator(".quiz__card")).toBeHidden();
    await expect(section.locator(".quiz__count b")).toHaveText("4");
    await shot(page, "home-intro");
    await section.getByRole("link", { name: /Начать подбор/ }).click();
    await expect(page).toHaveURL(/\/ru\/podbor$/);
    const quiz = page.locator(".quiz--page");
    await expect(quiz.getByRole("heading", { level: 1 })).toContainText("Подберём за 1 минуту");
    await expect(quiz.getByRole("heading", { name: "Сколько комнат нужно?" })).toBeVisible();
    await expect(quiz.locator(".quiz__intro .quiz__live")).toBeHidden();
    await expect(quiz.locator(".quiz__foot .quiz__count b")).toHaveText("4");
    await quiz.getByRole("button", { name: "Студия" }).click();
    await quiz.getByRole("button", { name: "Дальше" }).click();
    await expect(quiz.locator(".quiz__step")).toHaveText("Вопрос 2 из 5");
    await shot(page, "podbor");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    expect(errors).toEqual([]);
  });

  test("UZ /podbor: тексты на узбекском, заголовок страницы; обе страницы в карте сайта", async ({ page, request }) => {
    await page.goto("/uz/podbor");
    await expect(page).toHaveTitle("1 daqiqada kvartira tanlash — Vodiy House");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("1 daqiqada tanlab beramiz");
    await expect(page.getByRole("heading", { name: "Necha xona kerak?" })).toBeVisible();
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toMatch(/<loc>[^<]+\/ru\/podbor<\/loc>/);
    expect(xml).toMatch(/<loc>[^<]+\/uz\/podbor<\/loc>/);
  });
});
