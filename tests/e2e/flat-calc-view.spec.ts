import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шаг 2.7: раскладка «Расчёта для этой квартиры» — без горизонтальной прокрутки, итог без луча
// (В4 A: луч — только у /kalkulyator), скриншоты s27 против SiteJkCalc1, MobFlat и MobFlatTerm.

const STAND = "/dev/raschet-kvartiry";
const LAYOUT_64 = "00000000-0000-4000-8000-0000000e1001";
const LAYOUT_78 = "00000000-0000-4000-8000-0000000e1002";
const UNIT_43 = "00000000-0000-4000-8000-0000000e2002";
const SCHEME = "00000000-0000-4000-8000-000000000102";
const IPOTEKA = "00000000-0000-4000-8000-000000000103";
const SHOT_TIME = new Date("2026-10-24T09:46:00Z");

const flat = (page: Page) => page.locator("dialog.flat-calc");

async function settle(page: Page) {
  await expect(flat(page)).toHaveAttribute("open", "");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // Бесконечные (фон и блики в full) не ждём — только появление панели.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getTiming().iterations === Infinity,
      ),
  );
}

test.describe("сайт · расчёт квартиры: раскладка", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("без горизонтальной прокрутки; итог с нейтральной рамкой и без луча даже в full", async ({
    page,
  }) => {
    await page.goto(`${STAND}?motion=full&plan=${LAYOUT_78}`);
    await settle(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    // На телефоне шторка прокручивается сама — вбок не должна и она (лента квартир — своя прокрутка).
    await page.goto(`${STAND}?plan=${LAYOUT_64}`);
    await settle(page);
    expect(await flat(page).evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(
      0,
    );
    await expect(flat(page).locator(".calc-total .beam")).toHaveCount(0);
    await expect(flat(page).locator(".calc-total--plain")).toHaveCount(1);
  });

  test("скриншоты s27: панель 1440 / шторка 390, банк, свой срок, узбекский, тёмная", async ({
    page,
  }, testInfo) => {
    const dir = `test-results/screens/${testInfo.project.name}`;
    await page.clock.setFixedTime(SHOT_TIME);
    await page.goto(`${STAND}?plan=${LAYOUT_78}`);
    await settle(page);
    await page.screenshot({ path: `${dir}/s27-flat.png`, fullPage: true, caret: "initial" });
    await page.goto(`${STAND}?plan=${LAYOUT_78}&program=${IPOTEKA}&down=20&months=24&out=UZS`);
    await settle(page);
    await flat(page).getByTestId("calc-total").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/s27-bank.png`, caret: "initial" });
    await page.goto(
      `${STAND}?plan=${LAYOUT_64}&unit=${UNIT_43}&program=${SCHEME}&down=50&months=17`,
    );
    await settle(page);
    await page.screenshot({ path: `${dir}/s27-unit.png`, caret: "initial" });
    await flat(page).locator(".calc-term").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/s27-term.png`, caret: "initial" });
    await page.goto(`${STAND}/uz?plan=${LAYOUT_78}`);
    await settle(page);
    await page.screenshot({ path: `${dir}/s27-flat-uz.png`, caret: "initial" });
    await page.evaluate(() => {
      localStorage.setItem("vh-theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });
    await settle(page);
    await page.screenshot({ path: `${dir}/s27-flat-dark.png`, caret: "initial" });
    await page.evaluate(() => localStorage.setItem("vh-theme", "light"));
  });
});
