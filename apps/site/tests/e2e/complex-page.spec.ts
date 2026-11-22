import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";
import { hasCloud } from "./cloud";

// Страница ЖК (шаг 3.5) на DEMO из облака: разделы мокапа SiteJk / MobJk, сверх мокапа — Ф4,
// карта и «Удобство локации» — Ф5; без скидок (PLAN §3.13). Скриншоты —
// test-results/screens/<проект>/s35-complex-*.png.

const SHODLIK = "/ru/novostroyki/demo-shodlik";

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/s35-complex-${name}.png`, fullPage: true, caret: "initial" });

/** Ленивые картинки и появление разделов — прокруткой до низа, как читатель. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let top = 0; top < height; top += 600) await page.evaluate((y) => window.scrollTo(0, y), top);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe("страница ЖК", () => {
  test.skip(!hasCloud, "страница читает DEMO из облака");

  test("Shodlik по мокапу: цена, разделы, блоки с переносом срока, наличие, застройщик, документы", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(SHODLIK);
    await expect(page.getByRole("heading", { level: 1, name: "ЖК Shodlik" })).toBeVisible();
    const main = page.locator("main");
    // Правки 15.11, п. 14: в шапке — название, «Проверено Vodiy House» и застройщик; без адреса, ориентира,
    // «до центра» и плашки класса (класс — в «О ЖК»).
    const head = main.locator(".complex-hero__head");
    await expect(head).toContainText("Проверено Vodiy House");
    await expect(head.getByRole("link", { name: "Farg‘ona Sifat Qurilish" })).toBeVisible();
    await expect(head).not.toContainText(/Ориентир|до центра|Мустакиллик|Комфорт/);
    await expect(main.locator("#o-zhk")).toContainText("Комфорт");
    // П. 28 (20.11): «О ЖК» — сетка «значок · подпись · значение» в одном экране (1440 — 5 в ряд, телефон — 2),
    // срок сдачи — первым; ленты 01–09 нет.
    const facts = main.locator("#o-zhk .complex-facts__item");
    const count = await facts.count();
    expect(count).toBeGreaterThanOrEqual(5);
    await expect(facts.first()).toHaveAttribute("data-fact", "deadline");
    await expect(facts.locator(".complex-facts__icon")).toHaveCount(count);
    await expect(main.locator("#o-zhk .complex-facts__rail")).toHaveCount(0);
    const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
    const grid = await main.locator("#o-zhk .complex-facts").boundingBox();
    expect(grid?.height ?? Infinity).toBeLessThan(viewport.height * 0.7);
    const tops = await facts.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
    expect(tops.filter((top) => top === tops[0]).length).toBe(Math.min(count, viewport.width >= 1024 ? 5 : 2));
    await main.locator("#o-zhk").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500); // раздел проявляется при входе в кадр
    await main.locator("#o-zhk").screenshot({ path: `test-results/screens/${test.info().project.name}/pravki-2011-facts.png` });
    // П. 16: под галереей нет плашки цены (цена, платёж, срок, документы, «Записаться», «Показать телефон»).
    await expect(main.locator(".complex-offer")).toHaveCount(0);
    await expect(main.locator(".complex-hero").getByRole("button", { name: /Записаться на просмотр|Показать телефон/ })).toHaveCount(0);
    await expect(main).toContainText(/от \$30\s290/);
    const nav = page.getByRole("navigation", { name: "Разделы страницы" });
    // Разделов без данных нет: у Shodlik нет видео и деталей; «Ход строительства» — DEMO-отчёты (фаза 5).
    // Правки 15.11, п. 17: расположение — сразу после «О ЖК», затем «Блоки и условия»; тот же порядок у разделов.
    // П. 19 (20.11): выбор квартиры — на месте таблицы «Наличие», следом — «Планировки».
    await expect(nav.getByRole("link")).toHaveText(["О ЖК", "Расположение", "Блоки и условия", "Выбрать квартиру", "Планировки", "Ход строительства", "Застройщик", "Документы"]);
    const order = await main.locator("section[id]").evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(order.slice(0, 5)).toEqual(["o-zhk", "raspolozhenie", "bloki", "vybrat-kvartiru", "planirovki"]);
    await expect(main.locator("#nalichie")).toHaveCount(0);
    await expect(main.locator("#bloki")).toContainText("перенесён с 2 кв. 2027");
    await expect(main.locator("#raspolozhenie")).toContainText("Школа №46");
    // Карта — сразу картинкой, без кнопки «Показать на карте»; грузится лениво.
    const map = main.locator("#raspolozhenie .complex-location__image");
    await expect(map).toHaveAttribute("loading", "lazy");
    await expect(map).toHaveAttribute("src", /^https:\/\/static-maps\.yandex\.ru\//);
    await expect(main.getByRole("button", { name: "Показать на карте" })).toHaveCount(0);
    await expect(main.locator("#planirovki h3")).toHaveCount(8);
    await expect(main.locator("#zastroyshchik")).toContainText("Farg‘ona Sifat Qurilish");
    await expect(main.locator("#zastroyshchik")).toContainText("Строится 2 ЖК");
    await expect(main.locator("#dokumenty")).toContainText("Разрешение на строительство");
    await expect(main).not.toContainText(/скидк|−\d+\s?%|-\d+\s?%/i);
    await scrollThrough(page);
    await shot(page, "shodlik");
    expect(errors).toEqual([]);
  });

  test("галерея: стрелки ‹ › и счётчик, нажатие на фото — во весь экран, свайп, размытое превью (правки 15.11, п. 15)", async ({ page, isMobile }) => {
    const errors = collectPageErrors(page);
    await page.goto(`${SHODLIK}?motion=lite`);
    const gallery = page.getByRole("group", { name: "Фото: ЖК Shodlik" });
    await expect(gallery).toHaveCSS("cursor", "zoom-in");
    // Заранее — следующий и предыдущий кадры.
    await expect(gallery.locator(".complex-gallery__preload .site-photo")).toHaveCount(2);
    // Уточнение 20.11: вместо превью с меткой «Далее» — стрелки по краям (видны и на телефоне) и счётчик.
    await expect(gallery.locator(".complex-gallery__thumb, .complex-gallery__label")).toHaveCount(0);
    const prev = gallery.getByRole("button", { name: "Предыдущее фото" });
    const next = gallery.getByRole("button", { name: "Следующее фото" });
    await expect(prev).toBeVisible();
    await expect(next).toBeVisible();
    await page.waitForLoadState("networkidle");
    const total = Number(/из (\d+)/.exec((await gallery.locator(".sr-only").textContent()) ?? "")?.[1]);
    await expect(gallery.locator(".complex-gallery__counter")).toContainText(`/ ${total}`);
    await prev.click();
    await expect(gallery.locator(".sr-only")).toHaveText(`Фото ${total} из ${total}`);
    await next.click();
    await next.click();
    await expect(gallery.locator(".sr-only")).toHaveText(/Фото 2 из \d+/);
    if (isMobile) await page.screenshot({ path: `test-results/screens/${test.info().project.name}/pravki-2011-gallery.png`, caret: "initial" });
    // Свайп влево — следующий кадр, полный экран не открывается.
    const box = (await gallery.locator(".complex-gallery__base").boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(gallery.locator(".sr-only")).toHaveText(/Фото 3 из \d+/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await prev.click();
    await expect(gallery.locator(".sr-only")).toHaveText(/Фото 2 из \d+/);
    // Нажатие на само фото (середина кадра) — во весь экран.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const viewer = page.getByRole("dialog", { name: /Фото 2 из \d+/ });
    await expect(viewer).toBeVisible();
    // Пока кадр грузится — его размытое превью, а не тёмный пустой кадр (было: 4/9 чёрным).
    const slides = viewer.locator(".complex-viewer__slide");
    const blurred = await slides.evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).style.getPropertyValue("--viewer-blur").startsWith("url(")).length);
    expect(blurred).toBe(await slides.count());
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("«Рассчитать платёж» у планировки: расчёт открывается на месте (телефон — шторкой)", async ({ page, isMobile }) => {
    const errors = collectPageErrors(page);
    await page.goto(`${SHODLIK}#planirovki`);
    // Кнопка оживает после гидратации: клик раньше потерялся бы.
    await page.waitForLoadState("networkidle");
    await page.locator(".complex-layout__calc").first().click();
    const calc = page.locator("dialog.flat-calc");
    await expect(calc).toHaveAttribute("open", "");
    await expect(calc.locator(".flat-calc__price")).toContainText(/\$30\s290/);
    expect(await calc.evaluate((dialog) => dialog.matches(":modal"))).toBe(isMobile);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s35-complex-calc.png`, caret: "initial" });
    // Правки 15.11, п. 21 (ТЗ 7.4): чертёж в расчёте — во весь экран по нажатию; Escape закрывает только его.
    await calc.getByRole("button", { name: /^Открыть чертёж крупно/ }).click();
    await expect(page.locator("dialog.complex-drawing")).toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.complex-drawing")).toHaveCount(0);
    await expect(calc).toHaveAttribute("open", "");
    // Повторное нажатие у открытого расчёта — «Свернуть» (мокап pcClose).
    if (!isMobile) {
      await page.locator(".complex-layout__calc").first().click();
      await expect(calc).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test("«Рассчитать платёж» у блока открывает расчёт его самой дешёвой планировки; проданная — «Нет в наличии»", async ({ page, isMobile }) => {
    const errors = collectPageErrors(page);
    await page.goto(SHODLIK);
    await page.waitForLoadState("networkidle");
    // На телефоне блоки — вкладками: открыта первая (Блок A).
    await page.locator(".complex-block__calc").first().click();
    const calc = page.locator("dialog.flat-calc");
    await expect(calc).toHaveAttribute("open", "");
    await expect(calc.locator(".flat-calc__price")).toContainText(/\$30\s290/);
    if (isMobile) await page.keyboard.press("Escape");
    await expect(page.locator(".complex-layout").filter({ hasText: "46,8 м²" })).toContainText("Нет в наличии");
    expect(errors).toEqual([]);
  });

  test("Namuna — разделы сверх мокапа (Ф4): «Детали проекта» и «Что входит в цену»", async ({ page }) => {
    await page.goto("/ru/novostroyki/demo-namuna");
    await expect(page.getByRole("navigation", { name: "Разделы страницы" }).getByRole("link", { name: "Детали проекта" })).toBeVisible();
    await expect(page.locator("#detali")).toContainText("Благоустройство");
    // Правки 15.11, п. 22: карусель «фото + подпись»; нажатие — окно с текстом, стрелки и счётчик «1 / N».
    const cards = page.locator("#detali .complex-details__card");
    const total = await cards.count();
    expect(total).toBeGreaterThanOrEqual(2);
    await cards.first().click();
    const viewer = page.locator("dialog.detail-viewer");
    await expect(viewer).toHaveAttribute("open", "");
    await expect(viewer.locator(".detail-viewer__count")).toHaveText(`1 / ${total}`);
    await viewer.getByRole("button", { name: "Вперёд" }).click();
    await expect(viewer.locator(".detail-viewer__count")).toHaveText(`2 / ${total}`);
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    // Страница не шире экрана — иначе окна во весь экран уезжают (лента комнат на телефоне).
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(page.locator("#bloki")).toContainText(/Место в подземном паркинге\s*отдельно, от \$9\s000/);
  });

  test("без выбора квартиры на фасаде — таблица «Наличие»: итог = сумма по блокам (правки 15.11, п. 19)", async ({ page }) => {
    // У реальных ЖК тестового облака фасада с контурами пока нет (DEMO — все с выбором квартиры).
    await page.goto("/ru/novostroyki/shodlik");
    const main = page.locator("main");
    await expect(main.locator("#vybrat-kvartiru")).toHaveCount(0);
    const total = Number(await main.locator("#nalichie .complex-stock__number").textContent());
    const perBlock = (await main.locator("#nalichie .complex-stock__blocks").textContent()) ?? "";
    await expect(main.locator("#nalichie .complex-stock__caption")).toHaveText("в продаже сейчас");
    expect(total).toBeGreaterThan(0);
    if (perBlock) expect(total).toBe([...perBlock.matchAll(/: (\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 0));
    await expect(main.locator("#nalichie")).toContainText(/обновлено \d{2}\.\d{2}, \d{2}:\d{2}/i);
    await page.goto("/uz/novostroyki/shodlik");
    await expect(page.locator("#nalichie")).toContainText("ta qoldi");
  });

  test("UZ — тексты на узбекском; чужой адрес — 404", async ({ page }) => {
    await page.goto("/uz/novostroyki/demo-shodlik");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shodlik TJM");
    await expect(page.locator("#vybrat-kvartiru")).toBeVisible();
    const response = await page.goto("/ru/novostroyki/net-takogo-zhk");
    expect(response?.status()).toBe(404);
  });
});
