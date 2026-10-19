import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// Вход и оболочка кабинета по решениям К1–К4 (docs/design-decisions.md, 19.10.2026).
const isPhone = (projectName: string) => projectName === "mobile-390";

test.describe("экран входа /admin/vhod", () => {
  test("карточка, поля, ссылка на сайт, чистая консоль", async ({ page }) => {
    const errors = collectPageErrors(page);
    const response = await page.goto("/admin/vhod");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { level: 1, name: "Кабинет сотрудника" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByRole("link", { name: "На сайт" })).toHaveAttribute("href", "/");
    await expect(page.getByText("Забыли пароль? Обратитесь к руководителю.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("пароль показывается и прячется", async ({ page }) => {
    await page.goto("/admin/vhod");
    const password = page.getByLabel("Пароль", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Показать пароль" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Скрыть пароль" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("фаза 0: вход сообщает о фазе 1 и никуда не отправляет", async ({ page }) => {
    await page.goto("/admin/vhod");
    await page.getByLabel("Email").fill("staff@example.com");
    await page.getByLabel("Пароль", { exact: true }).fill("demo-password");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByRole("status")).toContainText("Вход заработает в фазе 1");
    await expect(page).toHaveURL(/\/admin\/vhod$/);
  });

  test("К1.2: луч по рамке только в full, вращается через transform", async ({ page }) => {
    await page.goto("/admin/vhod?motion=full");
    const beam = page.locator(".login-card__beam");
    await expect(beam).toBeVisible();
    const beamAnimation = await beam.evaluate((element) => getComputedStyle(element, "::before").animationName);
    expect(beamAnimation).toBe("login-card-beam");
    await page.goto("/admin/vhod?motion=lite");
    await expect(beam).toBeHidden();
  });

  test("К1.4: ☀/☾ в шапке экрана, по умолчанию светлая", async ({ page }) => {
    await page.goto("/admin/vhod");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Включить тёмную тему" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("К1.7: без ролика — кадр готового дома, видео нет", async ({ page }) => {
    await page.goto("/admin/vhod?motion=full");
    await expect(page.locator(".login-backdrop__image")).toBeVisible();
    await expect(page.locator(".login-backdrop video")).toHaveCount(0);
  });
});

test.describe("оболочка кабинета /admin (разработка — без входа)", () => {
  test("фаза 0: в меню только «Главная» и «Сайт», Главная активна", async ({ page }, testInfo) => {
    const errors = collectPageErrors(page);
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Разделы кабинета" });
    await expect(nav).toHaveCount(1);
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveText("Главная");
    await expect(links.first()).toHaveAttribute("aria-current", "page");
    await expect(links.last()).toHaveAttribute("href", "/");
    for (const hidden of ["Заявки", "ЖК", "Застройщики", "Статистика", "Настройки"]) {
      await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);
    }
    await expect(page.locator(isPhone(testInfo.project.name) ? ".admin-nav--strip" : ".admin-shell__side")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("К4: заголовок — приветствие по времени Ташкента, подпись — дата", async ({ page }) => {
    await page.goto("/admin");
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText(/^(Доброе утро|Добрый день|Добрый вечер)$/);
    await expect(page.locator(".admin-topbar__subtitle")).toContainText(/\d{2}\.\d{2}\.\d{4} · кабинет Vodiy House/);
  });

  test("К2: десктоп — панель 250 px и карточка сотрудника с выходом", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "боковая панель — только ≥ 981 px");
    await page.goto("/admin");
    const side = page.locator(".admin-shell__side");
    expect((await side.boundingBox())?.width).toBe(250);
    await expect(side.getByText("Руководитель")).toBeVisible();
    await expect(side.getByRole("link", { name: "Выйти" })).toHaveAttribute("href", "/admin/vhod");
    await expect(page.locator(".admin-user-menu")).toBeHidden();
  });

  test("К4.2: верхняя строка прилипает на десктопе", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "на телефоне прилипает лента пилюль");
    await page.goto("/admin");
    await expect(page.locator(".admin-topbar")).toHaveCSS("position", "sticky");
  });

  test("К3: телефон — лента пилюль прилипает, «Выйти» в меню аватара", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "лента — только ≤ 980 px");
    await page.goto("/admin");
    await expect(page.locator(".admin-nav--strip")).toHaveCSS("position", "sticky");
    await expect(page.locator(".admin-shell__side")).toBeHidden();
    const toggle = page.getByRole("button", { name: /Сотрудник:/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Выйти" })).toHaveAttribute("href", "/admin/vhod");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("линий колонок в кабинете нет (Э1)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator(".bg-columns")).toHaveCount(0);
    await page.goto("/admin/vhod");
    await expect(page.locator(".bg-columns")).toHaveCount(0);
  });
});
