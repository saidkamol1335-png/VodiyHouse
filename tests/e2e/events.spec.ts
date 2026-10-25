import { expect, test } from "@playwright/test";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// Шаг 3.12: события сайта. Посетитель (обычный браузер, не «безголовый» — ботов не считаем) отмечает
// ЖК в избранное на его странице → событие уходит пачкой при уходе со страницы → руководитель видит
// его в «Сейчас на сайте». Сотрудник с сессией кабинета на сайте не считается.

const VISITOR_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

test.describe("события сайта → «Сейчас на сайте»", () => {
  test.skip(!hasCloud, NO_CLOUD);

  test("избранное на странице ЖК — в ленте кабинета с ЖК, источником и устройством", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "одна запись в базу на прогон");
    const visitor = await browser.newContext({ userAgent: VISITOR_AGENT });
    const site = await visitor.newPage();
    const errors = collectPageErrors(site);
    await site.goto("/ru/novostroyki/demo-shodlik?utm_source=e2e_events");
    const heart = site.getByRole("button", { name: "В избранное: ЖК Shodlik" }).first();
    // Избранное — событие «сразу»: пачка уходит по нажатию.
    const sent = site.waitForRequest((request) => request.url().endsWith("/api/e") && request.method() === "POST");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await sent;
    await site.goto("/ru");
    expect(errors).toEqual([]);
    await visitor.close();

    const cabinet = await browser.newContext({ storageState: cabinetState("head") });
    const admin = await cabinet.newPage();
    await admin.goto("/admin");
    const panel = admin.getByRole("region", { name: "Сейчас на сайте" });
    await expect(panel.getByText("Избранное · ЖК Shodlik").first()).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText("e2e_events · компьютер").first()).toBeVisible();
    await expect(panel).toContainText(/онлайн: [1-9]/i);
    await admin.screenshot({ caret: "initial", path: `test-results/screens/${testInfo.project.name}/s312-site-now.png` });
    await cabinet.close();
  });

  test("сотрудник с сессией кабинета и безголовый браузер — без событий", async ({ browser }) => {
    const staff = await browser.newContext({ storageState: cabinetState("head"), userAgent: VISITOR_AGENT });
    const page = await staff.newPage();
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/e")) posts.push(request.url());
    });
    await page.goto("/ru/novostroyki");
    await page.goto("/ru");
    expect(posts).toEqual([]);
    await staff.close();
  });
});
