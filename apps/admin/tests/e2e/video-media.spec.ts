import { expect, test, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";
import { complexBySlug, hasDb, withDb } from "./progressFixtures";

// «Медиа ЖК» (Проект-2, фаза E, п. 35) против облака: список ЖК с адресом и «Маршрутом» в Яндекс Карты;
// DEMO Shodlik — опубликованные отчёты по месяцам, фото открываются (публичный бакет, 200) и скачиваются.
// Контактов застройщика на странице нет (правило 1.2). Только чтение DEMO.
// Скриншоты — test-results/screens/<проект>/pE-media.png, pE-media-complex.png.

const SLUG = "demo-shodlik";

const screen = (page: Page, name: string) =>
  page.screenshot({
    path: `test-results/screens/${test.info().project.name}/${name}.png`,
    caret: "initial",
  });

/** Телефоны и ссылки застройщика из закрытой карточки (если заполнены) — их не должно быть на странице. */
async function developerContacts(complexId: string): Promise<string[]> {
  return withDb(async (client) => {
    const { rows } = await client.query<{ contacts: unknown }>(
      `select dp.contacts from public.developer_private dp
       join public.complexes c on c.developer_id = dp.developer_id where c.id = $1`,
      [complexId],
    );
    const values: string[] = [];
    const walk = (value: unknown) => {
      if (typeof value === "string" && value.replace(/\D/g, "").length >= 7)
        values.push(value.replace(/\D/g, ""));
      else if (typeof value === "string" && /^(https?:|@|t\.me)/.test(value)) values.push(value);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    rows.forEach((row) => walk(row.contacts));
    return values;
  });
}

async function expectNoDeveloperContacts(page: Page, contacts: readonly string[]) {
  await expect(
    page.locator('main a[href^="tel:"], main a[href*="t.me/"], main a[href^="mailto:"]'),
  ).toHaveCount(0);
  const text = (await page.locator("main").innerText()).replace(/\s/g, "");
  expect(text).not.toMatch(/\+?998\d{9}/);
  const digits = text.replace(/\D/g, "");
  for (const contact of contacts) {
    if (/^\d+$/.test(contact)) expect(digits).not.toContain(contact.slice(-9));
    else expect(text).not.toContain(contact);
  }
}

test.describe("«Медиа ЖК»", () => {
  test.skip(!hasCloud || !hasDb(), NO_CLOUD);
  test.use({ storageState: cabinetState("mobilographer") });

  test("список ЖК: адрес, «N отчётов · последний …», «Маршрут» в Яндекс Карты; без контактов застройщика", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    const shodlik = await complexBySlug(SLUG);
    await page.goto("/video/media");
    await expect(
      page.getByRole("heading", { name: "Медиа ЖК", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Опубликованные фото и видео — чтобы снимать с тех же точек"),
    ).toBeVisible();
    const items = page.locator(".progress-media__complex");
    expect(await items.count()).toBeGreaterThan(1);
    const item = items.filter({
      has: page.locator(`a[href="/video/media?complex=${shodlik.id}"]`),
    });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(/\d+ отч[её]т(а|ов)? · последний — /);
    const route = item.getByRole("link", { name: "Маршрут" });
    await expect(route).toHaveAttribute(
      "href",
      /^https:\/\/yandex\.uz\/maps\/\?rtext=~\d+\.\d+,\d+\.\d+/,
    );
    await expect(route).toHaveAttribute("target", "_blank");
    for (const link of await page.getByRole("link", { name: "Маршрут" }).all()) {
      expect(await link.getAttribute("href")).toMatch(/^https:\/\/yandex\.uz\/maps\/\?rtext=~/);
    }
    await expectNoDeveloperContacts(page, await developerContacts(shodlik.id));
    await screen(page, "pE-media");
    expect(errors).toEqual([]);
  });

  test("ЖК: месяцы → отчёты; фото — 200, «Скачать» с download; «Все ЖК»; без контактов застройщика", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    const shodlik = await complexBySlug(SLUG);
    await page.goto("/video/media");
    await page.locator(`a[href="/video/media?complex=${shodlik.id}"]`).click();
    await expect(page).toHaveURL(`/video/media?complex=${shodlik.id}`);
    await expect(page.getByRole("heading", { name: shodlik.name, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Маршрут" })).toHaveAttribute(
      "href",
      /^https:\/\/yandex\.uz\/maps\/\?rtext=~/,
    );

    const months = page.locator(".progress-media__month");
    expect(await months.count()).toBeGreaterThan(0);
    await expect(months.first().getByRole("heading", { level: 3 })).toHaveText(/\S+ \d{4}/);
    await expect(months.first().locator(".progress-media__report-title").first()).toHaveText(
      /^(Блок \S+|Видео квартиры · блок \S+) · снято \d{2}\.\d{2}\.\d{4}$/,
    );
    const photo = months.first().locator(".progress-media__photo").first();
    const src = (await photo.locator("img").getAttribute("src")) ?? "";
    expect(src).toMatch(
      new RegExp(`/storage/v1/object/public/media/complexes/${shodlik.id}/[0-9a-f-]{36}\\.jpg$`),
    );
    const response = await page.request.get(src);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/jpeg");
    await expect(photo.getByRole("link", { name: /^Фото 1 — открыть$/ })).toHaveAttribute(
      "href",
      src,
    );
    const download = photo.getByRole("link", { name: "Скачать" });
    await expect(download).toHaveAttribute("download", "");
    await expect(download).toHaveAttribute("href", `${src}?download=`);
    expect(
      (await page.request.get(`${src}?download=`)).headers()["content-disposition"] ?? "",
    ).toMatch(/attachment/);
    // Картинки на странице действительно загрузились.
    await photo.locator("img").scrollIntoViewIfNeeded();
    await expect
      .poll(() => photo.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);

    await expectNoDeveloperContacts(page, await developerContacts(shodlik.id));
    await screen(page, "pE-media-complex");
    await page.getByRole("link", { name: "Все ЖК" }).click();
    await expect(page).toHaveURL(/\/video\/media$/);
    expect(errors).toEqual([]);
  });

  test("менеджер тоже видит «Медиа ЖК»", async ({ browser }) => {
    const context = await browser.newContext({ storageState: cabinetState("manager") });
    const page = await context.newPage();
    await page.goto("/video/media");
    await expect(page.locator(".progress-media__complex").first()).toBeVisible();
    await context.close();
  });
});
