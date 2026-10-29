import { expect, test, type Page } from "./fixtures";
import { collectPageErrors } from "./helpers";
import { hasCloud } from "./cloud";

// «Ход строительства» (фаза 5, 5C.1) на DEMO из облака (scripts/demoProgress.mjs): у Shodlik — пять
// месяцев отчётов первого блока, фото без видео. Мокап SiteJk / MobJkProg. Скриншот —
// test-results/screens/<проект>/p5-progress.png.

const SHODLIK = "/ru/novostroyki/demo-shodlik";

const shot = (page: Page, name: string) =>
  page
    .locator("#hod-stroitelstva")
    .screenshot({
      path: `test-results/screens/${test.info().project.name}/p5-${name}.png`,
      caret: "initial",
    });

test.describe("ход строительства на странице ЖК", () => {
  test.skip(!hasCloud, "страница читает DEMO из облака");

  test("Shodlik: пункт навигатора, чипы месяцев, плеер со штампами, готовность блока, выбор месяца", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    await page.goto(`${SHODLIK}?motion=none`);
    await page
      .getByRole("navigation", { name: "Разделы страницы" })
      .getByRole("link", { name: "Ход строительства" })
      .click();
    const section = page.locator("#hod-stroitelstva");
    await expect(
      section.getByRole("heading", { level: 2, name: "Ход строительства" }),
    ).toBeVisible();
    await expect(section).toContainText(/Обновлено \d{2}\.\d{2}\.\d{4}/);

    const months = section.getByRole("group", { name: "Месяцы отчётов" }).getByRole("button");
    await expect(months).toHaveCount(5);
    await expect(months.first()).toHaveAttribute("aria-pressed", "true");
    const player = section.locator(".progress-player");
    await expect(player).toContainText(/Блок A/i);
    await expect(player).toContainText(/Фото за/i);
    await expect(section.locator(".complex-progress__comment")).toContainText("DEMO");
    await expect(section).toContainText(/Снято \d{2}\.\d{2}\.\d{4} · Vodiy House/);

    // Слайд-шоу фото: «Смотреть» запускает, счётчик кадров — «1 / 3».
    await expect(player.getByText(/^1 \/ \d+$/)).toBeVisible();
    await player.getByRole("button", { name: /Смотреть отчёт за/ }).click();
    await expect(player.getByRole("button", { name: "Пауза" })).toBeVisible();

    // Другой месяц — его отчёт в плеере, плеер снова на паузе.
    const second = months.nth(1);
    const secondMonth = (await second.textContent())!;
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(player).toContainText(new RegExp(`Фото за ${secondMonth}`, "i"));
    await expect(player.getByRole("button", { name: /Смотреть отчёт за/ })).toBeVisible();

    await expect(section).toContainText(/Готовность блока A/i);
    await expect(section).not.toContainText(/скидк|−\d+\s?%|-\d+\s?%/i);
    // Лента превью на телефоне не распирает страницу.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await shot(page, "progress");
    expect(errors).toEqual([]);
  });
});
