import { hasCloud } from "./cloud";
import { expect, test } from "./fixtures";
import { collectPageErrors } from "./helpers";

// Подвал по мокапу (.ftr): колонки 3а, контакты только Vodiy House (правило 1.2), знак появляется
// по useReveal. Скриншоты — test-results/screens/<проект>/s31-footer-ru.png.

const footer = (page: import("@playwright/test").Page) => page.locator("footer.site-footer");

test.describe("подвал сайта", () => {
  test("колонки 3а и ссылки на языке страницы; контактов не введено — только офис", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru");
    const root = footer(page);
    // К знаку вверху подвала, а не к середине подвала: с витриной главная на телефоне длиннее, и
    // прокрутка «к подвалу» ставила знак выше экрана — он не проявлялся (useReveal ждёт показа).
    await root.locator(".site-footer__pixels").scrollIntoViewIfNeeded();
    await expect(root.getByRole("link", { name: "Новостройки" })).toHaveAttribute("href", "/ru/novostroyki");
    await expect(root.getByRole("link", { name: "О нас" })).toHaveAttribute("href", "/ru/o-nas");
    await expect(root.getByRole("link", { name: "Как купить" })).toHaveAttribute("href", "/ru/kak-kupit");
    await expect(root.getByRole("link", { name: "Подбор за 1 минуту" })).toHaveAttribute("href", "/ru/podbor");
    await expect(root.getByRole("link", { name: "Стать партнёром" })).toHaveAttribute("href", "/ru/dlya-zastroyshchikov");
    await expect(root.getByRole("link", { name: "Вход для сотрудников" })).toHaveAttribute("href", "/admin");
    await expect(root.getByRole("link", { name: "Политика конфиденциальности" })).toHaveAttribute("href", "/ru/privacy");
    await expect(root).toContainText("Фергана, ул. Сайилгох, 4");
    await expect(root).toContainText("© 2026 Vodiy House");
    // «Спецпредложения» (3.16б) — якорь главной, только при действующей витрине (с облаком — DEMO).
    if (hasCloud) await expect(root.getByRole("link", { name: "Спецпредложения" })).toHaveAttribute("href", "/ru#spetspredlozheniya");
    else await expect(root).not.toContainText("Спецпредложения");
    await expect(root.locator('a[href^="tel:"]')).toHaveCount(0);
    // Снимок — когда знак проявился (full: клетки по диагонали до ~1,5 с); липкая шапка не мешает.
    await expect(root.locator(".site-footer__pixel").last()).toHaveCSS("opacity", "1", { timeout: 5000 });
    await expect(root.locator(".site-footer__pixels")).toHaveCSS("opacity", "1");
    // Снимок страницы целиком: снимок одного элемента теряет SVG с фильтром (full).
    await page.screenshot({
      path: `test-results/screens/${test.info().project.name}/s31-footer-ru.png`,
      fullPage: true,
      // Без своей каретки Playwright красит caret-color полям до гидрации — ложный «hydration mismatch».
      caret: "initial",
      style: ".site-header { visibility: hidden; }",
    });
    expect(errors).toEqual([]);
  });

  test("UZ: обещание с акцентом и колонки на узбекском", async ({ page }) => {
    await page.goto("/uz");
    const root = footer(page);
    await expect(root.locator(".site-footer__accent")).toHaveText("bepul");
    await expect(root.getByRole("link", { name: "Hamkor bo‘lish" })).toHaveAttribute("href", "/uz/dlya-zastroyshchikov");
  });

  test("с введёнными контактами — телефон, Telegram, Instagram и часы", async ({ page }) => {
    await page.goto("/dev/header");
    const root = footer(page);
    await expect(root.getByRole("link", { name: "+998 90 000 00 00" })).toHaveAttribute("href", "tel:+998900000000");
    await expect(root.getByRole("link", { name: "Telegram @vodiyhouse_demo" })).toHaveAttribute("href", "https://t.me/vodiyhouse_demo");
    await expect(root).toContainText("Пн–Сб, 9:00–19:00 (DEMO)");
  });

  test("full: знак появляется, когда подвал показался", async ({ page }) => {
    // Главная пока короткая — подвал виден сразу; стенд шапки длиннее экрана.
    await page.goto("/dev/header?motion=full");
    const pixels = footer(page).locator(".site-footer__pixels");
    await expect(pixels).not.toHaveAttribute("data-revealed");
    await pixels.scrollIntoViewIfNeeded();
    // Режим в момент появления: ниже первого экрана — уже full (стенд длиннее экрана).
    await expect(pixels).toHaveAttribute("data-revealed", "full");
    await expect(pixels.locator(".site-footer__pixel").last()).toHaveCSS("opacity", "1", { timeout: 5000 });
  });
});

test.describe("подвал · без JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("знак виден сразу: прятать до появления можно только когда скрипты работают", async ({ page }) => {
    await page.goto("/ru");
    const pixels = footer(page).locator(".site-footer__pixels");
    await expect(pixels).toHaveCSS("opacity", "1");
    await expect(pixels.locator(".site-footer__pixel").first()).toHaveCSS("opacity", "1");
  });
});

test.describe("подвал · копирование адреса", () => {
  test.skip(({ isMobile }) => isMobile, "буфер обмена — в десктопном Chromium");
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("«Скопировать» кладёт адрес сайта на языке страницы", async ({ page, baseURL }) => {
    await page.goto("/uz");
    await footer(page).getByRole("button", { name: "Nusxalash" }).click();
    await expect(footer(page).getByRole("button", { name: "Nusxalandi" })).toBeVisible();
    // Подпись возвращается: второе нажатие снова слышно диктору.
    await expect(footer(page).getByRole("button", { name: "Nusxalash" })).toBeVisible({ timeout: 5000 });
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/uz`);
  });
});
