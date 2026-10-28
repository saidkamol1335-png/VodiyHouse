import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Приёмка фазы 1 (PLAN §7) без облака: «руководитель с телефона создаёт ЖК с блоками,
// планировками и квартирами; блок 16 эт. × 3 подъезда × 4 кв. создаётся генератором < 1 мин».
// Стенды /dev/zhk на DEMO не сохраняют, поэтому путь — по шагам на тех же экранах: создание
// черновика, новый блок, новая планировка, генератор. Цепочку с записью в базу (каждый шаг видит
// предыдущий) проверит облако — шаг 14б.

const complexUrl = (n: number) => `/dev/zhk/00000000-0000-4000-8000-0000000000c${n}`;
const NAMUNA = complexUrl(2);

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

const formStatus = (page: Page, text: string) =>
  page.locator(".form-status").filter({ hasText: text });

const position = (page: Page, n: number) =>
  page.locator(".risers-editor__position").filter({ hasText: `Позиция ${n}` });

test.describe("приёмка фазы 1 · руководитель с телефона", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("ЖК → блок → планировка → квартиры: каждый шаг сохраняется", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-390", "приёмка — с телефона");

    await open(page, "/dev/zhk");
    await page.getByRole("button", { name: "Добавить ЖК" }).click();
    await page.getByLabel("Название · RU").fill("Приёмка");
    await page.getByLabel("Застройщик").selectOption({ label: "Kamalak Development" });
    await page.getByRole("button", { name: "Создать черновик" }).click();
    await expect(page).toHaveURL(complexUrl(5));

    await open(page, `${complexUrl(5)}/bloki`);
    await page.getByRole("button", { name: "Добавить блок" }).click();
    const block = page.getByTestId("block-card").last();
    await block.getByLabel("Название").fill("A");
    await block.getByLabel("Этажей всего").fill("16");
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(formStatus(page, "Сохранено")).toBeVisible();

    await open(page, `${NAMUNA}/planirovki`);
    await page.getByRole("button", { name: "Добавить планировку" }).click();
    const layout = page.getByTestId("layout-row").last();
    await layout.getByRole("radio", { name: "2", exact: true }).check({ force: true });
    await layout.getByLabel("Площадь, м²").fill("64,5");
    await layout.getByLabel(/^Цена от/).fill("45 000");
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(formStatus(page, "Сохранено")).toBeVisible();
  });

  // Сверка 390 / 1440 с мокапом и решениями интервью (шаг 14): экраны ЖК руководителя в обеих темах.
  for (const theme of ["light", "dark"] as const) {
    test(`скриншоты экранов ЖК руководителя · ${theme}`, async ({ page }, testInfo) => {
      const dir = `test-results/screens/${testInfo.project.name}`;
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      const screens = [
        ["s14-complexes", "/dev/zhk"],
        ["s14-complex-main", complexUrl(1)],
        ["s14-complex-blocks", `${complexUrl(1)}/bloki`],
        ["s14-complex-layouts", `${complexUrl(1)}/planirovki`],
        ["s14-complex-photos", `${complexUrl(1)}/foto`],
      ] as const;
      for (const [name, url] of screens) {
        await open(page, url);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `${dir}/${name}-${theme}.png`,
          fullPage: true,
          caret: "initial",
          animations: "disabled",
        });
      }
    });
  }

  test("блок 16 эт. × 3 подъезда × 4 кв. — генератором меньше чем за минуту", async ({ page }) => {
    const started = Date.now();
    await open(page, `${NAMUNA}/kvartiry`);
    const generator = page.locator(".units-generator");
    const layouts = [
      "Студия · 34,2 м²",
      "1-комн. · 48,6 м²",
      "1-комн. · 52,4 м²",
      "2-комн. · 71,3 м²",
    ];
    for (const [index, label] of layouts.entries()) {
      await position(page, index + 1)
        .getByLabel("Планировка")
        .selectOption({ label });
    }
    await page.getByLabel("Подъезды", { exact: true }).fill("3");
    // Этажность блока — 16, жилые со 2-го (коммерция внизу): 15 × 3 × 4.
    await expect(generator.locator(".units-generator__total")).toContainText("180 квартир");
    await page.getByRole("button", { name: "Создать 180 квартир" }).click();
    await expect(page.getByText("Создано: 180 квартир")).toBeVisible();
    const seconds = (Date.now() - started) / 1000;
    test.info().annotations.push({ type: "генератор, с", description: seconds.toFixed(1) });
    expect(seconds).toBeLessThan(60);
  });
});
