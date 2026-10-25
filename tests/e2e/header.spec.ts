import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Шапка по решениям Ш1–Ш6 (docs/design-decisions.md). Скриншоты — test-results/screens/header/.
const shot = (page: Page, name: string) =>
  page.screenshot({ caret: "initial", path: `test-results/screens/header/${name}.png` });

test.describe("шапка · десктоп 1440", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1280, "только десктоп");

  test("3а: четыре пункта, RU/UZ, тема, избранное; кнопки меню нет", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru");
    const nav = page.locator(".header-nav");
    // «Спецпредложения» и «Застройщики» — с 3б (PLAN §7, фаза 3).
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(nav).toContainText("Новостройки");
    await expect(nav).toContainText("Застройщикам");
    await expect(nav).not.toContainText("Спецпредложения");
    await expect(page.getByRole("link", { name: "Избранное" })).toHaveAttribute("href", "/ru/izbrannoe");
    await expect(page.locator(".site-header__menu-button")).toBeHidden();
    await expect(page.getByRole("group", { name: "Язык" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Избранное" })).toBeVisible();
    await shot(page, "1440-top");
    expect(errors).toEqual([]);
  });

  test("над обложкой прозрачная, после прокрутки — стекло", async ({ page }) => {
    await page.goto("/dev/header");
    const header = page.locator(".site-header");
    await expect(header).not.toHaveClass(/site-header--solid/);
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveClass(/site-header--solid/);
  });

  test("Ш1: в full буквы перекатываются, в lite — нет", async ({ page }) => {
    await page.goto("/ru?motion=full");
    const link = page.locator(".header-nav__link").nth(2);
    await link.hover();
    const char = link.locator(".roll-text__char > span").first();
    // translateY(-100%) от строки 1,3em при 14 px ≈ −18,2 px.
    await expect(char).toHaveCSS("transform", /matrix\(1, 0, 0, 1, 0, -18\.2\d*\)/);
    await shot(page, "1440-hover-full");
    await page.goto("/ru?motion=lite");
    await page.locator(".header-nav__link").nth(2).hover();
    await expect(page.locator(".header-nav__link").nth(2).locator(".roll-text__char > span").first()).toHaveCSS("transform", "none");
  });

  test("Ш3: RU → UZ — та же страница на другом языке; консоль чистая (переход — загрузкой страницы)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/ru/o-nas");
    await page.getByRole("group", { name: "Язык" }).getByRole("link", { name: "UZ" }).click();
    await expect(page).toHaveURL(/\/uz\/o-nas$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "uz");
    expect(errors).toEqual([]);
  });

  test("Ф9: «Показать телефон» — номер из «Настройки → Контакты», второй клик звонит", async ({ page }) => {
    await page.goto("/dev/header");
    await page.getByRole("button", { name: "Показать телефон" }).click();
    const phone = page.getByRole("banner").getByRole("link", { name: "+998 90 000 00 00" });
    await expect(phone).toHaveAttribute("href", "tel:+998900000000");
  });

  test("☾ переключает тему", async ({ page }) => {
    await page.goto("/ru");
    await page.getByRole("button", { name: "Включить тёмную тему" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await shot(page, "1440-dark");
  });
});

test.describe("шапка · планшет 1100", () => {
  test.use({ viewport: { width: 1100, height: 900 } });
  test.skip(({ isMobile }) => isMobile, "десктопный браузер");

  test("Ш4: кнопка меню открывает список под шапкой, Escape закрывает", async ({ page }) => {
    await page.goto("/ru");
    await expect(page.locator(".header-nav")).toBeHidden();
    const toggle = page.getByRole("button", { name: "Открыть меню" });
    await toggle.click();
    const menu = page.locator(".tablet-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator(".tablet-menu__link")).toHaveCount(4);
    await expect(page.locator(".phone-menu")).toBeHidden();
    await shot(page, "1100-menu");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(toggle).toBeFocused();
  });
});

test.describe("шапка · телефон 390", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 760, "только телефон");

  test("Ш5: меню на весь экран — 01–04, офис, язык, тема", async ({ page }) => {
    await page.goto("/ru");
    await shot(page, "390-top");
    await page.getByRole("button", { name: "Открыть меню" }).click();
    const menu = page.getByRole("dialog", { name: "Меню" });
    await expect(menu).toBeVisible();
    await expect(menu.locator(".phone-menu__item")).toHaveCount(4);
    await expect(menu.locator(".phone-menu__number").first()).toHaveText("01");
    await expect(menu).toContainText("Фергана, ул. Сайилгох, 4");
    await expect(menu.getByRole("link", { name: "O‘zbekcha" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Тёмная" })).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    await shot(page, "390-menu");
    await menu.getByRole("button", { name: "Закрыть меню" }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
  });

  test("Ф9: в меню — телефон, Telegram, Instagram и часы из «Настройки → Контакты»", async ({ page }) => {
    await page.goto("/dev/header");
    await expect(page.getByRole("link", { name: "Позвонить" })).toHaveAttribute("href", "tel:+998900000000");
    await page.getByRole("button", { name: "Открыть меню" }).click();
    const contacts = page.getByRole("dialog", { name: "Меню" }).locator(".phone-menu__contacts");
    await expect(contacts.getByRole("link", { name: /\+998 90 000 00 00/ })).toHaveAttribute("href", "tel:+998900000000");
    await expect(contacts.getByRole("link", { name: /@vodiyhouse_demo/ })).toHaveAttribute("href", "https://t.me/vodiyhouse_demo");
    await expect(contacts.getByRole("link", { name: /@vodiyhouse\.demo/ })).toHaveAttribute("href", "https://www.instagram.com/vodiyhouse.demo/");
    await expect(contacts).toContainText("Пн–Сб, 9:00–19:00 (DEMO)");
    await shot(page, "390-menu-contacts");
  });

  test("Ш6: поверх фото → после прокрутки стекло и название страницы", async ({ page }) => {
    await page.goto("/dev/header?motion=full");
    const header = page.locator(".site-header");
    await expect(header).toHaveClass(/site-header--over-photo/);
    await expect(page.getByRole("link", { name: "Назад" })).toBeVisible();
    await shot(page, "390-over-photo");
    // На эмуляции телефона колесо мыши не прокручивает — прокручиваем явно.
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect(header).toHaveClass(/site-header--solid/);
    await expect(header).not.toHaveClass(/site-header--over-photo/);
    await expect(page.locator(".site-header__title")).toHaveClass(/site-header__title--visible/);
    await expect(page.locator(".logo__text").first()).toBeHidden();
    await shot(page, "390-scrolled");
  });
});
