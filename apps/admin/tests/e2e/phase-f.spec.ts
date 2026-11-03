import { expect, test, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// Фаза F (PLAN §10, пп. 40–42, 45) против облака: «Памятка» каждой роли (руководителю — и памятки
// сотрудников), «Ход стройки» в статистике, CSP с nonce на каждом ответе, метка vh-staff после
// входа. Скриншоты — test-results/screens/<проект>/pF-*.png.

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const shot = (page: Page, name: string) =>
  page.screenshot({
    path: `test-results/screens/${test.info().project.name}/pF-${name}.png`,
    fullPage: true,
    caret: "initial",
  });

test.describe("CSP кабинета с nonce (п. 45)", () => {
  test("вход: свой nonce на каждый ответ, у каждого скрипта страницы он же; страница оживает", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    const first = await page.goto("/vhod");
    const policy = first!.headers()["content-security-policy"] ?? "";
    expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    const nonce = /'nonce-([^']+)'/.exec(policy)![1]!;
    const html = await first!.text();
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(script).toContain(`nonce="${nonce}"`);
    await expect(page.locator("html[data-hydrated]")).toHaveCount(1);
    const again = await page.request.get("/vhod");
    expect(again.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);
    expect(errors).toEqual([]);
  });
});

test.describe("кабинет · фаза F · руководитель", () => {
  test.skip(!hasCloud, NO_CLOUD);
  test.use({ storageState: cabinetState("head") });

  test("после входа браузер помечен vh-staff: путь /, Lax, читается сайтом (п. 40)", async ({
    page,
  }) => {
    await page.goto("/");
    const mark = (await page.context().cookies()).find((cookie) => cookie.name === "vh-staff");
    expect(mark).toMatchObject({ value: "1", path: "/", sameSite: "Lax", httpOnly: false });
  });

  test("«Памятка»: своя и памятки сотрудников вкладками; без прокрутки вбок", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Разделы кабинета" })
      .getByRole("link", { name: "Памятка" })
      .click();
    await expect(page).toHaveURL(/\/pamyatka$/);
    await expect(page.getByRole("heading", { level: 1, name: "Памятка" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "1. Вход и второй фактор" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Почему квартира не видна на сайте" }),
    ).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Памятки сотрудников" }).getByRole("link");
    await expect(tabs).toHaveText(["Руководитель", "Менеджер", "Мобилограф"]);
    await expect(tabs.first()).toHaveAttribute("aria-current", "page");
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    await shot(page, "guide-head");
    await tabs.nth(2).click();
    await expect(page).toHaveURL(/\/pamyatka\?rol=mobilograf$/);
    await expect(page.getByRole("heading", { level: 2, name: "2. Как снимать" })).toBeVisible();
    await expect(tabs.nth(2)).toHaveAttribute("aria-current", "page");
    expect(errors).toEqual([]);
  });

  test("статистика: «Ход стройки» — 4 цифры и ЖК без отчёта за месяц; CSV с секцией", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto("/statistika");
    const panel = page
      .locator(".admin-panel")
      .filter({ has: page.getByRole("heading", { level: 2, name: "Ход стройки" }) });
    await expect(panel).toBeVisible();
    await expect(panel.locator(".stats-screen__kpi")).toHaveCount(4);
    for (const label of [
      "Опубликовано отчётов",
      "Возвратов автору",
      "Среднее ожидание проверки",
      "Ждут проверки сейчас",
    ])
      await expect(panel.getByText(label, { exact: true })).toBeVisible();
    await expect(
      panel.getByRole("heading", { level: 3, name: /^ЖК без отчёта за [а-я]+ \d{4}/ }),
    ).toBeVisible();
    await expect(panel.getByRole("link", { name: "Открыть «Проверку»" })).toHaveAttribute(
      "href",
      "/video",
    );
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/screens/${test.info().project.name}/pF-stats-progress.png`,
      caret: "initial",
    });
    const csv = await page.request.get("/statistika/csv?per=30");
    expect(csv.status()).toBe(200);
    const text = await csv.text();
    expect(text).toMatch(/\r\nХод стройки \d\d\.\d\d\.\d{4} — \d\d\.\d\d\.\d{4}\r\n/);
    expect(text).toContain("Среднее ожидание проверки, ч;");
    expect(errors).toEqual([]);
  });
});

test.describe("кабинет · фаза F · менеджер и мобилограф", () => {
  test.skip(!hasCloud, NO_CLOUD);

  test.describe("менеджер", () => {
    test.use({ storageState: cabinetState("manager") });
    test("своя «Памятка», без вкладок и памяток других ролей", async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.goto("/pamyatka?rol=mobilograf");
      await expect(
        page.getByRole("heading", { level: 2, name: "3. Публикация — через руководителя" }),
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Памятки сотрудников" })).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 2, name: "2. Как снимать" })).toHaveCount(0);
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await shot(page, "guide-manager");
      expect(errors).toEqual([]);
    });
  });

  test.describe("мобилограф", () => {
    test.use({ storageState: cabinetState("mobilographer") });
    test("«Памятка» в меню рядом с видео, последним пунктом", async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.goto("/video");
      const nav = page.getByRole("navigation", { name: "Разделы кабинета" }).getByRole("link");
      await expect(nav).toHaveText(["Видео и ход стройки", "Памятка", /сайт/i]);
      await nav.nth(1).click();
      await expect(page.getByRole("heading", { level: 2, name: "3. Новый отчёт" })).toBeVisible();
      await expect(
        page.getByText("Каждый строящийся блок — раз в месяц, лучше до 20-го числа."),
      ).toBeVisible();
      expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
      await shot(page, "guide-mobilographer");
      expect(errors).toEqual([]);
    });
  });
});
