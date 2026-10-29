import { expect, test } from "./fixtures";
import { collectPageErrors } from "./helpers";
import { hasCloud } from "./cloud";

// Блок E (шаги 3.9–3.10): главная по мокапу, избранное без входа, «Поделиться» и /podborka.
// Скриншоты — test-results/screens/<проект>/s39-*.png, s310-*.png.

test.describe("главная, избранное, подборка", () => {
  test.skip(!hasCloud, "главная и каталог читают DEMO");

  test("главная: заголовок, «Подобрать квартиру» → каталог ниже, цифры из базы, без скидок и контактов застройщика", async ({ page }) => {
    const errors = collectPageErrors(page);
    // lite: режим не зависит от пробы FPS машины — снимок главной ровный.
    await page.goto("/ru?motion=lite");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Квартиры в новостройках Ферганы");
    await expect(page.getByRole("link", { name: /Подобрать квартиру/ }).first()).toHaveAttribute("href", /#katalog$/);
    await expect(page.locator("#katalog .catalog-card").first()).toBeVisible();
    const complexes = page.locator(".home-hero__stat").first();
    await expect(complexes.locator("dt")).toHaveText("жилых комплекса");
    await expect(complexes.locator("dd")).toHaveText("4");
    await expect(page.locator(".home-partner").getByRole("link", { name: /Стать партнёром/ })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/скидк|−\d+%|-\d+%/i);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s39-home.png`, fullPage: true, caret: "initial" });
    expect(errors).toEqual([]);
  });

  test("сердце на карточке → счётчик в шапке → /izbrannoe → «Поделиться подборкой» → /podborka", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/novostroyki");
    await page.getByRole("button", { name: "В избранное: ЖК Shodlik" }).click();
    await page.getByRole("button", { name: "В избранное: ЖК Orzu" }).click();
    await expect(page.getByRole("button", { name: "В избранное: ЖК Shodlik" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "Избранное · 2" })).toBeVisible();
    await page.goto("/ru/izbrannoe");
    await expect(page.getByRole("heading", { name: "В подборке 2 ЖК" })).toBeVisible();
    await expect(page.locator(".catalog-card")).toHaveCount(2);
    await page.getByRole("button", { name: "Поделиться подборкой" }).click();
    const dialog = page.getByRole("dialog", { name: "Поделиться ссылкой" });
    const link = await dialog.getByLabel("Ссылка").inputValue();
    expect(link).toMatch(/\/ru\/podborka\?zhk=demo-(shodlik|orzu)(,|%2C)demo-(shodlik|orzu)$/);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s310-share.png`, caret: "initial" });
    await page.goto(new URL(link).pathname + new URL(link).search);
    await expect(page.getByRole("heading", { name: "Подборка: 2 ЖК" })).toBeVisible();
    await expect(page.locator(".catalog-card")).toHaveCount(2);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s310-podborka.png`, fullPage: true, caret: "initial" });
    expect(errors).toEqual([]);
  });

  test("подборка с несуществующим ЖК — пусто и путь в каталог", async ({ page }) => {
    await page.goto("/ru/podborka?zhk=net-takogo");
    await expect(page.getByText("Подборка пуста или ЖК в ней сняты с продажи.", { exact: false })).toBeVisible();
  });

  // 3.16б, витрина на главной (DEMO: 5 подборок, 1 реклама, 3 спецпредложения).
  test("подборки витрины: клик — фильтр и ?podborka= в адресе, повтор сбрасывает, правка фильтра снимает; бейдж на карточке", async ({ page, isMobile }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru");
    const row = page.locator(".collections");
    const applied = page.locator(".catalog-results__collection");
    await expect(row.locator(".collections__card")).toHaveCount(5);
    const built = row.getByRole("button", { name: /Сданные дома/ });
    await expect(built).toContainText(/\d+ квартир/);
    await built.click();
    await expect(page).toHaveURL(/\?podborka=demo-sdannye-doma&srok=built$/);
    await expect(applied).toContainText("Подборка «Сданные дома» применена");
    await expect(built).toHaveAttribute("aria-pressed", "true");
    // Сданные блоки в DEMO — у Shodlik и Orzu.
    await expect(page.locator(".catalog-card")).toHaveCount(2);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s316-collection.png`, caret: "initial" });
    await built.click();
    await expect(page).toHaveURL(/\/ru$/);
    await expect(applied).toHaveCount(0);
    await expect(page.locator(".catalog-card")).toHaveCount(4);
    // Подборка вручную — только её ЖК; правка фильтра снимает подборку, адрес — без podborka.
    await row.getByRole("button", { name: /Центр Ферганы/ }).click();
    await expect(page).toHaveURL(/\?podborka=demo-tsentr-fergany$/);
    await expect(page.locator(".catalog-card")).toHaveCount(2);
    await expect(page.locator(".catalog-card").first()).toContainText("ЖК Namuna");
    if (isMobile) await page.getByRole("button", { name: "Фильтры" }).click();
    const filter = page.getByRole(isMobile ? "dialog" : "complementary", { name: "Фильтры" });
    await filter.getByRole("group", { name: "Комнаты" }).getByRole("button", { name: "4+" }).click();
    await expect(page).toHaveURL(/\?komnat=4$/);
    await expect(applied).toHaveCount(0);
    // Бейдж спецпредложения на карточке ЖК — «Подарок» у Shodlik (DEMO).
    await page.goto("/ru/novostroyki");
    await expect(page.locator(".catalog-card").filter({ hasText: "ЖК Shodlik" }).locator(".catalog-card__promo")).toHaveText("Подарок");
    await expect(page.locator(".collections")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("реклама и спецпредложения: карточка рекламы с цифрами и «Показать N квартир», карточки условий, заявка, показ рекламы", async ({ page }) => {
    const errors = collectPageErrors(page);
    // Без sendBeacon очередь событий уходит fetch-ом — его тело видно тесту (у beacon тела нет).
    await page.addInitScript(() => Object.defineProperty(navigator, "sendBeacon", { value: undefined }));
    await page.goto("/ru");
    // Показ рекламы: карточка в кадре → ad_view один раз, уходит пачкой через 4 с. Ждём с самого
    // начала: снимок всей страницы ниже показывает карточку раньше явной прокрутки к ней.
    const sent = page.waitForRequest((request) => request.url().endsWith("/api/e") && request.method() === "POST" && (request.postData() ?? "").includes("ad_view"));
    const section = page.locator("#spetspredlozheniya");
    const ad = section.locator(".ad-card");
    await expect(ad).toContainText("Реклама");
    await expect(ad).toContainText("Farg‘ona Sifat Qurilish");
    await expect(ad.getByRole("heading", { name: "Готовые 2-комнатные квартиры в рассрочку" })).toBeVisible();
    await expect(ad).toContainText(/В продаже\s*\d+ квартир/);
    // Реклама «по фильтру» ограничена ЖК своего застройщика (реши сам 3.16б).
    await expect(ad.getByRole("link", { name: /Показать \d+ квартир/ })).toHaveAttribute("href", "/ru/novostroyki?komnat=2&srok=built&zastr=demo-sifat");
    await expect(ad.getByRole("link", { name: /ЖК Shodlik/ })).toHaveAttribute("href", "/ru/novostroyki/demo-shodlik");
    const specials = section.locator(".special-card");
    await expect(specials).toHaveCount(3);
    const gift = specials.first();
    await expect(gift.locator(".special-card__badge")).toHaveText("Подарок");
    await expect(gift).toContainText(/ещё \d+ д/);
    // Фото карточки — та же ссылка, но скрыта от диктора: доступная одна.
    await expect(gift.getByRole("link", { name: /ЖК Shodlik · Фергана/ })).toHaveAttribute("href", "/ru/novostroyki/demo-shodlik");
    await expect(gift.locator(".special-card__media")).toHaveAttribute("aria-hidden", "true");
    await expect(gift).toContainText(/от \$\d/);
    await expect(gift).toContainText(/до \d{2}\.\d{2}\.\d{4}/);
    await expect(specials.nth(1).getByRole("link", { name: "2 ЖК" })).toHaveAttribute("href", /\/ru\/podborka\?zhk=demo-namuna(,|%2C)demo-yulduz$/);
    await expect(section.getByRole("link", { name: "Разместить рекламу" })).toHaveAttribute("href", "/ru/dlya-zastroyshchikov");
    await expect(page.locator("main")).not.toContainText(/скидк|−\d+%|-\d+%/i);
    // «Хочу это условие» → заявка «Спецпредложение» с названием условия.
    await gift.getByRole("button", { name: "Хочу это условие" }).click();
    const dialog = page.getByRole("dialog", { name: "Спецпредложение" });
    await expect(dialog).toContainText("Кухонный гарнитур в подарок");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s316-offers.png`, fullPage: true, caret: "initial" });
    await ad.scrollIntoViewIfNeeded();
    await sent;
    expect(errors).toEqual([]);
  });

  test("UZ: подборки и предложения на узбекском", async ({ page }) => {
    await page.goto("/uz");
    await expect(page.locator(".collections")).toContainText("Tayyor tanlovlar");
    await expect(page.locator(".collections__card").first()).toContainText("Topshirilgan uylar");
    const section = page.locator("#spetspredlozheniya");
    await expect(section.locator(".ad-card__tag")).toHaveText("Reklama");
    await expect(section.locator(".special-card").first().getByRole("button", { name: "Shu shartni xohlayman" })).toBeVisible();
  });
});
