import { expect, test } from "./fixtures";
import { collectPageErrors, demoCards } from "./helpers";
import { hasCloud } from "./cloud";

// Блок E (шаги 3.9–3.10): главная по мокапу, избранное без входа, «Поделиться» и /podborka.
// Скриншоты — test-results/screens/<проект>/s39-*.png, s310-*.png.

test.describe("главная, избранное, подборка", () => {
  test.skip(!hasCloud, "главная и каталог читают DEMO");

  test("главная: заголовок, «Подобрать квартиру» → каталог ниже, цифры из базы, без скидок и контактов застройщика", async ({ page }) => {
    const errors = collectPageErrors(page);
    // lite: режим не зависит от пробы FPS машины — снимок главной ровный.
    await page.goto("/ru?motion=lite");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Новостройки Ферганы — по цене застройщика");
    await expect(page.locator(".home-hero__lead")).toHaveText("На портале Vodiy House: цена как у застройщика, подбор и показ — бесплатно.");
    await expect(page.getByRole("link", { name: /Подобрать квартиру/ }).first()).toHaveAttribute("href", /#katalog$/);
    await expect(page.locator("#katalog .catalog-card").first()).toBeVisible();
    const complexes = page.locator(".home-hero__stat").first();
    await expect(complexes.locator("dt")).toHaveText(/^жилых комплекс/);
    await expect(complexes.locator("dd")).toHaveText(/^\d+$/);
    await expect(page.locator(".home-partner").getByRole("link", { name: /Стать партнёром/ })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/скидк|−\d+%|-\d+%/i);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s39-home.png`, fullPage: true, caret: "initial" });
    expect(errors).toEqual([]);
  });

  test("сердце на карточке → счётчик в шапке → /izbrannoe → «Поделиться подборкой» → /podborka", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/novostroyki");
    const shodlikHeart = demoCards(page).getByRole("button", { name: "В избранное: ЖК Shodlik" });
    await shodlikHeart.click();
    await page.getByRole("button", { name: "В избранное: ЖК Orzu" }).click();
    await expect(shodlikHeart).toHaveAttribute("aria-pressed", "true");
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
    await expect(demoCards(page)).toHaveCount(4);
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
    await expect(demoCards(page).filter({ hasText: "ЖК Shodlik" }).locator(".catalog-card__promo")).toHaveText("Подарок");
    await expect(page.locator(".collections")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("реклама и спецпредложения: без баннеров — своя реклама Vodiy House с цифрами, карточки условий, заявка", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru");
    // Правки 15.11, п. 4 + 13: реклама застройщика — баннер; у DEMO-рекламы картинки нет, поэтому здесь —
    // своя реклама Vodiy House из каталога (баннер проверяет кабинетная ad-banner.spec.ts).
    const section = page.locator("#reklama");
    const ad = section.locator(".ad-card");
    await expect(section.locator(".ad-banner")).toHaveCount(0);
    await expect(ad).toContainText("Реклама");
    await expect(ad.getByRole("heading", { level: 3 })).toBeVisible();
    await expect(ad).toContainText(/В продаже\s*\d+ (квартир|ЖК)/);
    await expect(ad.getByRole("link", { name: /Показать \d+ (квартир|ЖК)/ })).toHaveAttribute("href", /^\/ru\/novostroyki/);
    await expect(section.getByRole("link", { name: "Разместить рекламу" })).toHaveAttribute("href", "/ru/dlya-zastroyshchikov");
    // Спецпредложения с 06.11.2026 — на карточках ленты «Проекты» (ТЗ 5.6): ЖК с предложением — первыми.
    const gallery = page.locator("#spetspredlozheniya");
    await expect(gallery.locator(".eyebrow")).toHaveText(/Спецпредложения/);
    // Правки 15.11, п. 3 (уточнение 20.11): «Проекты Vodiy House» выше рекламы; надписи над рекламой нет.
    await expect(section.locator(".eyebrow")).toHaveCount(0);
    await expect(section.getByRole("heading", { level: 2 })).toHaveText("Предложения от застройщиков");
    const order = await page.evaluate(() => {
      const projects = document.getElementById("spetspredlozheniya");
      const ads = document.getElementById("reklama");
      return projects && ads ? projects.compareDocumentPosition(ads) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
    });
    expect(order).toBeTruthy();
    const offers = gallery.locator(".jk-gallery__offer--special");
    await expect(offers.first().locator(".jk-gallery__badge")).toBeVisible();
    await expect(offers.first()).toContainText(/до \d{2}\.\d{2}\.\d{4}( · (ещё \d+ д|последний день))?/);
    const first = gallery.locator(".jk-gallery__card").first();
    await expect(first.locator(".jk-gallery__offer--special")).toHaveCount(1);
    await expect(first.getByRole("link")).toHaveAccessibleName(/ЖК .+ — .+ — до \d{2}\.\d{2}\.\d{4}/);
    await expect(page.locator("main")).not.toContainText(/скидк|−\d+%|-\d+%/i);
    // «Хочу это условие» у своей рекламы → заявка «Спецпредложение» с её заголовком.
    const heading = (await ad.getByRole("heading", { level: 3 }).textContent()) ?? "";
    await ad.getByRole("button", { name: "Хочу это условие" }).click();
    const dialog = page.getByRole("dialog", { name: "Спецпредложение" });
    await expect(dialog).toContainText(heading.trim());
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}/s316-offers.png`, fullPage: true, caret: "initial" });
    expect(errors).toEqual([]);
  });

  test("UZ: подборки и предложения на узбекском", async ({ page }) => {
    await page.goto("/uz");
    await expect(page.locator(".collections")).toContainText("Tayyor tanlovlar");
    await expect(page.locator(".collections__card").first()).toContainText("Topshirilgan uylar");
    await expect(page.locator("#reklama .ad-card__tag")).toHaveText("Reklama");
    await expect(page.locator("#reklama .eyebrow")).toHaveCount(0);
    await expect(page.locator("#reklama").getByRole("button", { name: "Shu shartni xohlayman" })).toBeVisible();
    await expect(page.locator("#spetspredlozheniya .eyebrow")).toHaveText(/Maxsus takliflar/);
    await expect(page.locator("#spetspredlozheniya .jk-gallery__until").first()).toContainText(/gacha/);
  });

  test("«Почему через Vodiy House?» в full: строки свёрнуты, открытая показывает карточку (правки 15.11, п. 6)", async ({ page }) => {
    await page.goto("/ru?motion=full");
    const why = page.locator(".home-why");
    await expect(why.getByRole("heading", { level: 3 })).toHaveCount(await why.locator(".home-why__summary").count());
    await expect(why.locator(".home-why__row[open]")).toHaveCount(0);
    await why.getByRole("heading", { name: "Цена как у застройщика, наценка 0%" }).click();
    const tile = why.locator(".home-why__tile--fee");
    await expect(tile).toBeVisible();
    await expect(tile).toHaveCSS("opacity", "1", { timeout: 5_000 });
    await expect(tile).toContainText("Комиссию платит застройщик");
  });
});
