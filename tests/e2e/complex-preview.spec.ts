import { expect, test, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";

// Шаг 3.6: предпросмотр ЖК (draftMode) — настоящая страница с пометкой «Предпросмотр» только у
// руководителя; посетителю ссылка предпросмотра ничего не открывает. DEMO в облаке опубликован —
// предпросмотр Shodlik должен совпасть с опубликованной страницей (кроме пометки).

const ANY_ID = "00000000-0000-4000-8000-0000000000c1";

/** Текст страницы без пометки предпросмотра — им предпросмотр сравнивается с опубликованной. */
const mainText = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector("main")!.cloneNode(true) as HTMLElement;
    main.querySelector(".complex-preview")?.remove();
    return main.textContent ?? "";
  });

test.describe("предпросмотр ЖК", () => {
  test.skip(!hasCloud, NO_CLOUD);

  test("посетитель: ссылка предпросмотра ведёт на вход, кривая — 400", async ({ page }) => {
    await page.goto(`/api/predprosmotr?zhk=${ANY_ID}&lang=ru`);
    await expect(page).toHaveURL(/\/admin\/vhod/);
    expect((await page.request.get("/api/predprosmotr?zhk=x&lang=ru")).status()).toBe(400);
    await page.goto("/ru/novostroyki/demo-shodlik");
    await expect(page.getByRole("complementary", { name: "Предпросмотр" })).toHaveCount(0);
  });

  test.describe("руководитель", () => {
    test.use({ storageState: cabinetState("head") });

    test("«Предпросмотр» открывает страницу ЖК с пометкой; она как опубликованная; «Выйти» — в кабинет", async ({ page }) => {
      await page.goto("/admin/zhk");
      await page.getByRole("link", { name: /Shodlik/ }).first().click();
      await page.getByRole("link", { name: "Предпросмотр" }).click();
      const open = page.getByRole("link", { name: "Открыть на весь экран" });
      const href = await open.getAttribute("href");
      expect(href).toMatch(/^\/api\/predprosmotr\?zhk=[0-9a-f-]{36}&lang=ru$/);
      await page.goto(href!);
      await expect(page).toHaveURL(/\/ru\/novostroyki\/demo-shodlik$/);
      const banner = page.getByRole("complementary", { name: "Предпросмотр" });
      await expect(banner).toContainText("опубликован");
      const preview = await mainText(page);
      await banner.getByRole("link", { name: "Выйти" }).click();
      await expect(page).toHaveURL(/\/admin\/zhk\/[0-9a-f-]{36}$/);
      await page.goto("/ru/novostroyki/demo-shodlik");
      await expect(page.getByRole("complementary", { name: "Предпросмотр" })).toHaveCount(0);
      expect(await mainText(page)).toBe(preview);
    });
  });
});
