import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// Шаг 2.9б: «Программы оплаты» и /kalkulyator с облачной базой (DEMO — `npm run demo:seed`).
// Только чтение: тумблеры, правки и курс не трогаем — DEMO в облаке общий с исполнителем.
// Без ключей пропускается: то же на DEMO стендов проверяют programs-view, client-calc-view и site-calc-view.

const DEVELOPERS = ["Farg‘ona Sifat Qurilish", "Marg‘ilon Invest", "Kamalak Development"];

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const shot = (page: Page, testInfo: TestInfo, name: string) =>
  page.screenshot({
    path: `test-results/screens/${testInfo.project.name}/${name}.png`,
    caret: "initial",
  });
const cabinetNav = (page: Page) => page.getByRole("navigation", { name: "Разделы кабинета" });

test.describe("облако · программы оплаты и калькулятор с базой", () => {
  test.skip(!hasCloud, NO_CLOUD);
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test.describe("руководитель", () => {
    test.use({ storageState: cabinetState("head") });

    test("список: программы DEMO с тумблерами и курсом; «Расчёт для клиента» считает", async ({
      page,
    }, testInfo) => {
      await page.goto("/admin/programmy");
      await expect(page.getByTestId("program-panel").first()).toBeVisible();
      await expect(page.getByTestId("program-card").first()).toBeVisible();
      await expect(page.getByRole("switch").first()).toBeVisible();
      await expect(page.getByTestId("program-rate")).toContainText("1 $ =");
      await page.waitForLoadState("networkidle");
      await shot(page, testInfo, "s29-cloud-programs");
      await page
        .getByRole("navigation", { name: "Разделы программ оплаты" })
        .getByRole("link", { name: "Расчёт для клиента" })
        .click();
      await expect(page).toHaveURL(/\/admin\/programmy\/raschet/);
      await expect(page.getByTestId("calc-total")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await shot(page, testInfo, "s29-cloud-raschet");
    });
  });

  test.describe("менеджер", () => {
    test.use({ storageState: cabinetState("manager") });

    test("меню открывает сразу расчёт; список программ — без тумблеров", async ({ page }) => {
      await page.goto("/admin");
      const programs = cabinetNav(page).getByRole("link", { name: "Программы оплаты" });
      await expect(programs).toHaveAttribute("href", "/admin/programmy/raschet");
      await programs.click();
      await expect(page.getByTestId("calc-total")).toBeVisible();
      await page.goto("/admin/programmy");
      await expect(page.getByTestId("program-card").first()).toBeVisible();
      await expect(page.getByRole("switch")).toHaveCount(0);
    });
  });

  for (const locale of ["ru", "uz"] as const) {
    test(`/${locale}/kalkulyator: застройщики DEMO из базы, пункт меню, расчёт другого застройщика`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/kalkulyator`);
      await expect(page.locator(".site-calculator__empty")).toHaveCount(0);
      await expect(page.getByTestId("calc-total")).toBeVisible();
      for (const name of DEVELOPERS) await expect(page.getByRole("button", { name })).toBeVisible();
      await page.getByRole("button", { name: "Marg‘ilon Invest" }).click();
      await expect(page).toHaveURL(/\?developer=demo-margilan-invest$/);
      await expect(page.getByRole("button", { name: "Marg‘ilon Invest" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByTestId("calc-total")).toBeVisible();
      if (isPhone(page))
        await page
          .getByRole("button", { name: locale === "ru" ? "Открыть меню" : "Menyuni ochish" })
          .click();
      const nav = page.getByRole("link", { name: locale === "ru" ? "Калькулятор" : "Kalkulyator" });
      await expect(nav.first()).toBeVisible();
    });
  }
});
