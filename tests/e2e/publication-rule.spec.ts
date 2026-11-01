import { mkdirSync } from "node:fs";
import pg from "pg";
import { contactsFrom, SITE_CONTACTS_KEY } from "../../lib/contacts";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Правило публикации v2 (docs/publication-rule.md) на DEMO из supabase/demo/publication.sql:
// demo-skoro — «Скоро», demo-seryy — полный с неполной планировкой и серым блоком, demo-chernovik — черновик.
// PUBLICATION_SHOTS=1 — ещё и снимки для памятки в docs/design/publication-v2.

const SOON = "/ru/novostroyki/demo-skoro";
const GRAY = "/ru/novostroyki/demo-seryy";
const DRAFT = "/ru/novostroyki/demo-chernovik";
const SHOTS_DIR = "docs/design/publication-v2";

async function shot(page: Page, name: string) {
  if (!process.env.PUBLICATION_SHOTS) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOTS_DIR}/${name}-${page.viewportSize()?.width}.png`, caret: "initial" });
}

/** Общий номер Vodiy House из базы: тот же, что в шапке; цифрами. */
async function sitePhone(): Promise<string | null> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    const { rows } = await client.query("select value from public.settings where key = $1", [SITE_CONTACTS_KEY]);
    return contactsFrom(rows[0]?.value).phone?.replace(/\D/g, "") ?? null;
  } finally {
    await client.end();
  }
}

test.describe("сайт · правило публикации", () => {
  test.skip(!hasCloud, NO_CLOUD);

  test("черновик: контента нет, в sitemap и каталоге нет", async ({ page, request }) => {
    // Первый заход отвечает 200 со страницей «не найдено», повторные — 404 (design-decisions, «404 чужого адреса»).
    await request.get(DRAFT);
    const response = await page.goto(DRAFT);
    expect(response?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText("Chernovik");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("demo-chernovik");
    await page.goto("/ru/novostroyki");
    await expect(page.locator('a[href*="demo-chernovik"]')).toHaveCount(0);
  });

  test("каталог: «Скоро» с меткой, «Цены скоро · позвонить», в конце; фильтр цены его не показывает", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/novostroyki");
    const cards = page.locator(".catalog-card");
    await expect(cards.last().locator('a[href*="demo-skoro"]').first()).toBeAttached();
    const card = cards.last();
    await expect(card.locator(".catalog-card__soon")).toHaveText("Скоро");
    await expect(card).toContainText("Цены скоро");
    await expect(card).not.toContainText(/от \$\d/);
    await card.scrollIntoViewIfNeeded();
    await shot(page, "catalog-soon");

    for (const query of ["do=500000", "ot=1000", "komnat=1"]) {
      await page.goto(`/ru/novostroyki?${query}`);
      await expect(cards.first()).toBeVisible();
      await expect(page.locator('.catalog-card a[href*="demo-skoro"]')).toHaveCount(0);
    }
    await page.goto("/ru");
    await expect(page.locator('.catalog-card a[href*="demo-skoro"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("страница «Скоро»: нет планировок, расчёта и фасада; есть номер Vodiy House", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(SOON);
    const soon = page.locator(".complex-soon");
    await expect(soon).toContainText("Планировки и цены скоро появятся на сайте");
    await expect(page.locator("#planirovki")).toHaveCount(0);
    await expect(page.locator("#vybrat-kvartiru")).toHaveCount(0);
    await expect(page.locator("#nalichie")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Рассчитать/ })).toHaveCount(0);
    await expect(soon.locator("form")).toHaveCount(0);
    await expect(page.locator(".complex-offer__amount")).toHaveText("Цены скоро");

    const phone = await sitePhone();
    if (phone) {
      const link = soon.locator(".complex-soon__phone");
      expect((await link.getAttribute("href"))?.replace(/\D/g, "")).toBe(phone);
    }
    // Правило 1.2: все телефоны блока — только общий номер.
    const phones = await soon.locator('a[href^="tel:"]').evaluateAll((items) =>
      items.map((item) => item.getAttribute("href")?.replace(/\D/g, "") ?? ""),
    );
    expect(phones.filter((digits) => digits !== phone)).toEqual([]);
    await soon.scrollIntoViewIfNeeded();
    await shot(page, "complex-soon");
    expect(errors).toEqual([]);
  });

  test("страница «Скоро» по-узбекски", async ({ page }) => {
    await page.goto(SOON.replace("/ru/", "/uz/"));
    await expect(page.locator(".complex-soon")).toContainText("Rejalar va narxlar tez orada saytda paydo bo‘ladi");
  });

  test("полный ЖК: неполной планировки нет в HTML", async ({ page }) => {
    await page.goto(GRAY);
    await expect(page.locator("#planirovki")).toContainText("42,5");
    const html = await page.content();
    expect(html).toContain("42.5");
    expect(html).not.toContain("64.5");
    expect(html).not.toContain("64,5");
    expect(html).not.toContain("78,0");
  });

  test("фасад: серый блок не кликается, квартиры неполной планировки серые, без цены и формы", async ({ page }) => {
    const errors = collectPageErrors(page);
    const planResponses: string[] = [];
    page.on("response", async (response) => {
      if (response.request().method() === "POST") planResponses.push(await response.text().catch(() => ""));
    });
    await page.goto(GRAY);
    const section = page.locator("#vybrat-kvartiru");
    await section.scrollIntoViewIfNeeded();
    const isPhone = (page.viewportSize()?.width ?? 1440) <= 760;
    const soonBlock = section.locator(isPhone ? ".complex-picker__block--soon" : ".complex-picker__tag--soon");
    await expect(soonBlock).toContainText("Скоро");
    await expect(soonBlock.locator("button, a")).toHaveCount(0);
    if (process.env.PUBLICATION_SHOTS) {
      // Раздел проявляется при прокрутке: снимок — когда прокрутка и появление закончились.
      await soonBlock.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
    }
    await shot(page, "facade-gray-block");

    const openBlock = section.locator(isPhone ? "button.complex-picker__block" : "button.complex-picker__tag", { hasText: "Блок 1" });
    await expect(openBlock).toContainText(/свободно \d+/, { timeout: 15_000 });
    await openBlock.click();
    await expect(section.getByRole("button", { name: "Все корпуса" })).toBeVisible();
    const pending = section.locator(".complex-picker__unit--pending");
    await expect(pending.first()).toBeVisible();
    await expect(pending.first().locator(".complex-picker__unit-price")).toHaveCount(0);
    await expect(pending.first().locator(".complex-picker__unit-rooms")).toHaveCount(0);
    await pending.first().click();
    await expect(section.locator(".complex-picker__note")).toContainText("Цена уточняется — позвоните в Vodiy House");
    await expect(section.locator(".complex-picker__flat")).toHaveCount(0);
    await shot(page, "facade-gray-units");
    // Полная планировка рядом выбирается как обычно, продано — как раньше.
    await expect(section.locator(".complex-picker__unit--free").first()).toBeVisible();
    // Ответ сервера с квартирами блока не раскрывает неполную планировку.
    expect(planResponses.join("\n")).not.toContain("64.5");
    expect(errors).toEqual([]);
  });
});

test.describe("кабинет · правило публикации", () => {
  test.skip(!hasCloud, NO_CLOUD);
  test.use({ storageState: cabinetState("head") });

  test("список: «Черновик (N из M)» и «Скоро»; карточка: «Не хватает» и «Полных квартир: k из n»", async ({ page }) => {
    await page.goto("/admin/zhk");
    const rowOf = (name: string) => page.locator(".complex-list__row", { hasText: `ЖК ${name}` });
    await expect(rowOf("Skoro")).toContainText("Скоро");
    await expect(rowOf("Chernovik")).toContainText(/Черновик \(\d из 6\)/);
    await shot(page, "cabinet-list");

    await rowOf("Chernovik").click();
    const toggle = page.getByRole("button", { name: /Для публикации: \d из 6/ });
    await toggle.click();
    await expect(page.locator(".complex-readiness__list li")).toHaveCount(6);
    await expect(page.locator(".complex-readiness__layouts")).toContainText("Полных квартир: 0 из 0");
    await shot(page, "cabinet-draft");

    await page.goto("/admin/zhk");
    await rowOf("Seryy").click();
    await expect(page.locator(".complex-readiness__layouts")).toContainText("Полных квартир: 1 из 3");
  });

  test("планировки: метка «Не хватает» и фильтр «Только неполные»", async ({ page }) => {
    await page.goto("/admin/zhk");
    await page.locator(".complex-list__row", { hasText: "ЖК Seryy" }).click();
    await page.getByRole("navigation", { name: "Разделы ЖК" }).getByRole("link", { name: /Планировки/ }).click();
    const rows = page.getByTestId("layout-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: /Не хватает: .*чертёж/ })).toHaveCount(1);
    await page.getByRole("checkbox", { name: "Только неполные" }).check();
    await expect(rows).toHaveCount(1);
    await shot(page, "cabinet-layouts");
  });

  test("тип фото: сохраняется, рендер квартиры не считается", async ({ page }) => {
    await page.goto("/admin/zhk");
    await page.locator(".complex-list__row", { hasText: "ЖК Chernovik" }).click();
    await page.getByRole("navigation", { name: "Разделы ЖК" }).getByRole("link", { name: /Фото/ }).click();
    // У черновика рендеров нет — проверяем только, что вкладка открывается без ошибок.
    await expect(page.locator(".complex-photos__lead")).toContainText("для публикации от 5");
  });
});
