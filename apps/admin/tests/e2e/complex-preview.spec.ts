import { expect, test, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { site } from "./site";

// Предпросмотр ЖК (шаг 3.6 → PLAN §10, фаза C): кабинет берёт грант на 15 минут и открывает
// страницу на сайте (/preview/zhk/<slug>?token=…). Страница — как опубликованная, плюс пометка
// «Предпросмотр»; без гранта посетитель черновик не видит. DEMO в облаке опубликован — предпросмотр
// Shodlik должен совпасть с опубликованной страницей (кроме пометки).

/** Текст страницы без пометки предпросмотра — им предпросмотр сравнивается с опубликованной. */
const mainText = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector("main")!.cloneNode(true) as HTMLElement;
    main.querySelector(".complex-preview")?.remove();
    return main.textContent ?? "";
  });

test.describe("предпросмотр ЖК", () => {
  test.skip(!hasCloud, NO_CLOUD);

  // Ревью фазы C: предпросмотр включается только по гранту, который подтвердила база.
  test("посетитель: кривая ссылка и выдуманный токен — 400, черновика не видно", async ({ page }) => {
    expect((await page.request.get(site("/preview/zhk/demo-shodlik?token=x&lang=ru"))).status()).toBe(400);
    const fake = await page.request.get(site(`/preview/zhk/demo-shodlik?token=${"0".repeat(48)}&lang=ru`), { maxRedirects: 0 });
    expect(fake.status()).toBe(400);
    expect((await page.request.get(site("/ru/novostroyki/demo-chernovik"))).status()).toBe(404);
  });

  test.describe("руководитель", () => {
    test.use({ storageState: cabinetState("head") });

    test("«Открыть 1440» — страница на сайте с пометкой, как опубликованная; «Выйти» — без пометки", async ({ page, context }) => {
      await page.goto("/zhk");
      await page.getByRole("link", { name: /Shodlik/ }).first().click();
      await page.getByRole("link", { name: "Предпросмотр" }).click();
      const [preview] = await Promise.all([
        context.waitForEvent("page"),
        page.getByRole("button", { name: "Открыть 1440" }).click(),
      ]);
      await preview.waitForURL(/\/ru\/novostroyki\/demo-shodlik$/);
      expect(preview.url().startsWith(site("/"))).toBe(true);
      const banner = preview.getByRole("complementary", { name: "Предпросмотр" });
      await expect(banner).toContainText("опубликован");
      const shown = await mainText(preview);
      // Выход ведёт на тот же адрес: ждём сам переход через /preview/vyhod и загрузку страницы.
      await Promise.all([
        preview.waitForResponse((response) => response.url().includes("/preview/vyhod")),
        banner.getByRole("link", { name: "Выйти" }).click(),
      ]);
      await preview.waitForURL(/\/ru\/novostroyki\/demo-shodlik$/);
      await preview.waitForLoadState("load");
      await expect(preview.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(preview.getByRole("complementary", { name: "Предпросмотр" })).toHaveCount(0);
      expect(await mainText(preview)).toBe(shown);
    });
  });
});
