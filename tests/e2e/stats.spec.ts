import { expect, test, type Page } from "./fixtures";
import { cabinetState, hasCloud, NO_CLOUD } from "./cloud";
import { collectPageErrors } from "./helpers";

// Фаза 6, 6B: «Статистика сайта» /admin/statistika (мокап CabStats) против облака с DEMO-посещениями
// (supabase/demo/stats.sql). Только руководитель; менеджеру и видеографу — «Раздел доступен
// руководителю», CSV — 403. Скриншоты — test-results/screens/<проект>/p6-stats-*.png.

const STATS = "/admin/statistika";
const isPhone = (name: string) => name === "mobile-390";
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const shot = (page: Page, name: string) =>
  page.screenshot({
    path: `test-results/screens/${test.info().project.name}/p6-stats-${name}.png`,
    fullPage: true,
    caret: "initial",
  });
const cookieHeader = async (page: Page) =>
  (await page.context().cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
/** «9 114» → 9114. */
const numberIn = (text: string | null) => Number((text ?? "").replace(/\D/g, ""));

test.describe("кабинет · статистика · руководитель", () => {
  test.skip(!hasCloud, NO_CLOUD);
  test.use({ storageState: cabinetState("head") });

  test("30 дней по умолчанию: KPI, график, панели, меню; без ошибок и прокрутки вбок", async ({
    page,
  }, testInfo) => {
    const errors = collectPageErrors(page);
    await page.goto(STATS);
    await expect(page.getByRole("heading", { level: 1, name: "Статистика сайта" })).toBeVisible();
    const periods = page.getByRole("group", { name: "Период" });
    await expect(periods.getByRole("link", { name: "30 дней" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator(".stats-screen__period")).toContainText(/30 дней · сравнение с/);
    const kpis = page.locator(".stats-screen__kpi");
    await expect(kpis).toHaveCount(6);
    await expect(kpis.first()).toContainText("Посетители");
    expect(
      numberIn(await kpis.first().locator(".stats-screen__kpi-value").textContent()),
    ).toBeGreaterThan(0);
    await expect(page.locator(".stats-chart__line")).toHaveCount(1);
    await expect(page.locator(".stats-chart__prev")).toHaveCount(1);
    for (const title of [
      "Источники",
      "Устройства и язык",
      "Типы заявок",
      "Популярные ЖК",
      "Рекламные креативы · UTM",
      "Путь посетителя",
      "Сейчас на сайте",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /^ЖК / }).first()).toHaveAttribute(
      "href",
      /^\/ru\/novostroyki\/demo-/,
    );
    if (!isPhone(testInfo.project.name)) {
      await expect(
        page
          .getByRole("navigation", { name: "Разделы кабинета" })
          .getByRole("link", { name: "Статистика сайта" }),
      ).toHaveAttribute("aria-current", "page");
    }
    expect(await noHorizontalScroll(page)).toBe(0);
    await shot(page, "30");
    expect(errors).toEqual([]);
  });

  test("график: вкладка «Заявки», подсказка наведением и стрелками; «Застройщики» в топе", async ({
    page,
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "наведение мышью — на 1440");
    await page.goto(`${STATS}?per=7`);
    await page
      .getByRole("group", { name: "Что показать на графике" })
      .getByRole("button", { name: "Заявки" })
      .click();
    await expect(page.locator(".stats-chart__legend")).toContainText("Заявки · выбранный период");
    const plot = page.locator(".stats-chart__plot");
    const box = (await plot.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(".stats-chart__tip")).toContainText(/· заявки/);
    await expect(page.locator(".stats-chart__tip")).toContainText(/прошлый период: \d+/);
    await page.mouse.move(box.x - 60, box.y - 60);
    await expect(page.locator(".stats-chart__tip")).toHaveCount(0);
    await plot.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".stats-chart__tip")).toContainText(/\d{2}\.\d{2}\.\d{4}/);
    await page.getByRole("button", { name: "Застройщики" }).click();
    await expect(page.locator(".stats-objects th").first()).toHaveText(/Застройщик/i);
  });

  test("период в адресе: «Сегодня» по часам, «Период…» с датами, перезагрузка держит выбор", async ({
    page,
  }) => {
    await page.goto(STATS);
    await page
      .getByRole("group", { name: "Период" })
      .getByRole("link", { name: "Сегодня" })
      .click();
    await expect(page).toHaveURL(/[?&]per=today\b/);
    await expect(page.locator(".stats-screen__period")).toContainText(
      /Сегодня, \d{2}\.\d{2}\.\d{4} · данные до \d{2}:\d{2}/,
    );
    await expect(page.locator(".stats-chart__x span").first()).toHaveText("00:00");
    await page
      .getByRole("group", { name: "Период" })
      .getByRole("link", { name: "Период…" })
      .click();
    await expect(page).toHaveURL(/per=custom&from=\d{4}-\d{2}-\d{2}&to=/);
    await page.getByLabel("С", { exact: true }).fill("2026-10-01");
    await page.getByLabel("По", { exact: true }).fill("2026-10-10");
    await page.getByRole("button", { name: "Показать" }).click();
    await expect(page).toHaveURL(/per=custom&from=2026-10-01&to=2026-10-10/);
    await page.reload();
    await expect(page.locator(".stats-screen__period")).toContainText(
      "01.10.2026 — 10.10.2026 · 10 дней",
    );
    await expect(
      page.getByRole("group", { name: "Период" }).getByRole("link", { name: "Период…" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("CSV: файл за тот же период, цифры итога = KPI экрана", async ({ page }) => {
    await page.goto(`${STATS}?per=7`);
    const visitors = numberIn(
      await page
        .locator(".stats-screen__kpi")
        .first()
        .locator(".stats-screen__kpi-value")
        .textContent(),
    );
    const href = await page.getByRole("link", { name: "CSV" }).getAttribute("href");
    expect(href).toBe(`${STATS}/csv?per=7`);
    const csv = await page.request.get(href!, { headers: { cookie: await cookieHeader(page) } });
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(csv.headers()["content-disposition"]).toMatch(
      /vodiyhouse-statistika-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv/,
    );
    const lines = (await csv.text()).split("\r\n");
    expect(lines[0]).toBe("﻿Дата;Посетители;Визиты;Просмотры;Заявки;Контакты (телефон / Telegram)");
    expect(lines.slice(1, 8).every((line) => /^\d{2}\.\d{2}\.\d{4};/.test(line))).toBe(true);
    const total = lines.find((line) => line.startsWith("Итого"))!;
    // Посетители могли прийти между загрузкой страницы и файлом — итог не меньше KPI.
    expect(Number(total.split(";")[1])).toBeGreaterThanOrEqual(visitors);
  });

  test("Главная руководителя: «Сайт сегодня» ведёт в статистику «Сегодня»", async ({ page }) => {
    await page.goto("/admin");
    const card = page.getByRole("link", { name: /Сайт сегодня/ });
    await expect(card).toHaveAttribute("href", `${STATS}?per=today`);
    await expect(card).toContainText(/посетителей/);
    await shot(page, "home-head");
    await card.click();
    await expect(
      page.getByRole("group", { name: "Период" }).getByRole("link", { name: "Сегодня" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("тёмная тема — скриншот", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vh-theme", "dark"));
    await page.goto(`${STATS}?motion=none`);
    await expect(page.locator(".stats-chart__line")).toHaveCount(1);
    await shot(page, "30-dark");
  });
});

for (const persona of ["manager", "videographer"] as const) {
  test.describe(`кабинет · статистика · ${persona}`, () => {
    test.skip(!hasCloud, NO_CLOUD);
    test.use({ storageState: cabinetState(persona) });

    test("раздел недоступен, пункта в меню нет, CSV — 403, на Главной нет «Сайт сегодня»", async ({
      page,
    }) => {
      await page.goto(STATS);
      await expect(
        page.getByRole("heading", { name: "Раздел доступен руководителю" }),
      ).toBeVisible();
      await expect(page.locator(".stats-chart")).toHaveCount(0);
      await expect(
        page
          .getByRole("navigation", { name: "Разделы кабинета" })
          .getByRole("link", { name: /Статистика/ }),
      ).toHaveCount(0);
      const csv = await page.request.get(`${STATS}/csv?per=7`, {
        headers: { cookie: await cookieHeader(page) },
        maxRedirects: 0,
      });
      expect(csv.status()).toBe(403);
      if (persona === "manager") {
        await page.goto("/admin");
        await expect(page.getByRole("link", { name: /Свободно на сайте/ })).toBeVisible();
        await expect(page.getByRole("link", { name: /Сайт сегодня/ })).toHaveCount(0);
      }
    });
  });
}
