import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// «Настройки → Сотрудники» (шаг 8, С1–С5) на стенде /dev/staff: DEMO мокапа, Supabase подменён.
// Настоящий список и действия против облака — staff.spec.ts.
const PAGE = "/dev/staff";
const isPhone = (projectName: string) => projectName === "mobile-390";

const row = (page: Page, name: string) => page.locator(".staff-list__row").filter({ hasText: name });

test.describe("«Сотрудники» — список", () => {
  test("строки DEMO: роль, состояние, даты; своя строка — «Это вы» без действий", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(PAGE);
    await expect(page.getByRole("heading", { level: 2, name: "Сотрудники" })).toBeVisible();
    await expect(page.locator(".staff-list__count")).toHaveText("6 сотрудников");
    await expect(page.locator(".staff-list__name")).toHaveText([
      "Азиз Рахимов",
      "Бахтиёр Каримов",
      "Дилноза Юсупова",
      "Сардор Алиев",
      "Жасур Тошматов",
      "Нигора Саидова",
    ]);

    await expect(row(page, "Азиз Рахимов")).toContainText("Ждёт первого входа");
    await expect(row(page, "Азиз Рахимов")).toContainText("Ещё не входил");
    await expect(row(page, "Сардор Алиев")).toContainText("Видеограф");
    await expect(row(page, "Нигора Саидова")).toContainText("Отключён");
    await expect(row(page, "Нигора Саидова").locator(".staff-list__warning")).toHaveCount(0);
    await expect(row(page, "Жасур Тошматов").locator(".staff-list__warning")).toHaveText(
      "Вход ещё не закрыт — нажмите «Отключить» ещё раз",
    );

    const self = row(page, "Бахтиёр Каримов");
    await expect(self).toContainText("Это вы");
    await expect(self).toContainText("Руководитель");
    // Даты — по Ташкенту: 20.10.2026 04:12 UTC → 09:12.
    await expect(self).toContainText("Вход 20.10.2026 09:12");
    await expect(self.locator(".staff-list__actions")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("телефон — карточки, без горизонтальной прокрутки", async ({ page }, testInfo) => {
    await page.goto(PAGE);
    const name = row(page, "Дилноза Юсупова").locator(".staff-list__name");
    const badges = row(page, "Дилноза Юсупова").locator(".staff-list__badges");
    const [nameBox, badgesBox] = [await name.boundingBox(), await badges.boundingBox()];
    if (isPhone(testInfo.project.name)) {
      expect(badgesBox!.y).toBeGreaterThan(nameBox!.y + nameBox!.height - 1);
    } else {
      expect(Math.abs(badgesBox!.y + badgesBox!.height / 2 - (nameBox!.y + nameBox!.height / 2))).toBeLessThan(24);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`скриншоты списка · ${theme}`, async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      await page.goto(PAGE);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      const folder = `test-results/screens/${testInfo.project.name}`;
      await page.screenshot({ caret: "initial", path: `${folder}/staff-list-${theme}.png`, fullPage: true });
    });
  }
});

test.describe("«Сотрудники» — действия", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  async function openCreate(page: Page) {
    await page.goto(PAGE);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Добавить сотрудника" }).click();
  }

  test("пустое имя и плохой email — ошибки под полями; роль по умолчанию — менеджер", async ({ page }) => {
    await openCreate(page);
    await expect(page.getByLabel("Роль")).toHaveValue("manager");
    await page.getByLabel("Email для входа").fill("aziz");
    await page.getByRole("button", { name: "Создать и показать пароль" }).click();
    await expect(page.locator(".staff-create .field__error")).toHaveText(["Введите имя", "Проверьте email"]);
    await expect(page.getByLabel("Роль")).toHaveValue("manager");
  });

  test("занятый email — ошибка у поля", async ({ page }) => {
    await openCreate(page);
    await page.getByLabel("Имя и фамилия").fill("Дилноза Юсупова");
    await page.getByLabel("Email для входа").fill("demo-dilnoza@example.com");
    await page.getByRole("button", { name: "Создать и показать пароль" }).click();
    await expect(page.locator(".staff-create .field__error")).toHaveText(["Сотрудник с таким email уже есть"]);
  });

  test("создание → пароль один раз → «Скопировать для Telegram» → «Готово» убирает пароль", async ({ page }) => {
    await openCreate(page);
    await page.getByLabel("Имя и фамилия").fill("  Азиз   Рахимов ");
    await page.getByLabel("Email для входа").fill("Aziz.New@Example.com");
    await page.getByLabel("Роль").selectOption("videographer");
    await expect(page.getByText("Загружает ежемесячные видео и фото стройки")).toBeVisible();
    await page.getByRole("button", { name: "Создать и показать пароль" }).click();

    const reveal = page.locator(".staff-password");
    await expect(reveal.getByRole("heading", { name: "Пароль для Азиз Рахимов" })).toBeFocused();
    await expect(reveal).toContainText("aziz.new@example.com");
    const password = (await reveal.locator(".staff-password__value").textContent()) ?? "";
    expect(password).toMatch(/^[A-HJ-NP-Za-hj-km-np-z2-9]{12}$/);

    await reveal.getByRole("button", { name: "Скопировать для Telegram" }).click();
    await expect(reveal.getByRole("status")).toHaveText("Скопировано — вставьте в чат с сотрудником");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("/admin/vhod");
    expect(copied).toContain("Email: aziz.new@example.com");
    expect(copied).toContain(`Временный пароль: ${password}`);

    await reveal.getByRole("button", { name: "Готово" }).click();
    await expect(page.locator(".staff-password")).toHaveCount(0);
    expect(await page.content()).not.toContain(password);
    expect(page.url()).not.toContain(password);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(password);
  });

  test("«Отключить» → «Да / Отмена» в строке → выполнено", async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForLoadState("networkidle");
    const dilnoza = row(page, "Дилноза Юсупова");
    await dilnoza.getByRole("button", { name: "Отключить" }).click();
    await expect(dilnoza.locator(".staff-actions__question")).toHaveText(
      "Отключить Дилноза Юсупова? Вход в кабинет закроется сразу.",
    );
    await dilnoza.getByRole("button", { name: "Отмена" }).click();
    await expect(dilnoza.locator(".staff-actions__confirm")).toHaveCount(0);
    await dilnoza.getByRole("button", { name: "Отключить" }).click();
    await dilnoza.getByRole("button", { name: "Да" }).click();
    await expect(dilnoza.getByRole("status")).toHaveText("Дилноза Юсупова: доступ отключён");
    await row(page, "Нигора Саидова").getByRole("button", { name: "Включить" }).click();
    await expect(row(page, "Нигора Саидова").getByRole("status")).toHaveText("Нигора Саидова: доступ включён");
  });

  test("расхождение базы и Auth: предупреждение называет кнопку, которая есть в строке", async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForLoadState("networkidle");
    // Жасур отключён в базе, а вход ещё открыт: «нажмите «Отключить» ещё раз».
    const jasur = row(page, "Жасур Тошматов");
    await expect(jasur.locator(".staff-list__warning")).toContainText("«Отключить»");
    await expect(jasur.getByRole("button", { name: "Включить" })).toHaveCount(0);
    await jasur.getByRole("button", { name: "Отключить" }).click();
    await jasur.getByRole("button", { name: "Да" }).click();
    await expect(jasur.getByRole("status")).toHaveText("Жасур Тошматов: доступ отключён");
  });

  test("«Новый пароль» → подтверждение → пароль один раз под строкой", async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForLoadState("networkidle");
    const sardor = row(page, "Сардор Алиев");
    await sardor.getByRole("button", { name: "Новый пароль" }).click();
    await expect(sardor.locator(".staff-actions__question")).toHaveText(
      "Выдать Сардор Алиев новый пароль? Старый перестанет работать.",
    );
    await sardor.getByRole("button", { name: "Да" }).click();
    await expect(sardor.locator(".staff-password__value")).toHaveText(/^[A-HJ-NP-Za-hj-km-np-z2-9]{12}$/);
    await sardor.getByRole("button", { name: "Готово" }).click();
    await expect(sardor.locator(".staff-password")).toHaveCount(0);
  });

  test("скриншоты: форма, пароль, подтверждение", async ({ page }, testInfo) => {
    const folder = `test-results/screens/${testInfo.project.name}`;
    await openCreate(page);
    await page.getByRole("button", { name: "Создать и показать пароль" }).click();
    await expect(page.locator(".staff-create .field__error").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ caret: "initial", path: `${folder}/staff-create-errors.png`, fullPage: true });

    await page.getByLabel("Имя и фамилия").fill("Азиз Рахимов");
    await page.getByLabel("Email для входа").fill("aziz.new@example.com");
    await page.getByRole("button", { name: "Создать и показать пароль" }).click();
    await expect(page.locator(".staff-password")).toBeVisible();
    await page.screenshot({ caret: "initial", path: `${folder}/staff-password.png`, fullPage: true });

    await page.locator(".staff-password").getByRole("button", { name: "Готово" }).click();
    await row(page, "Дилноза Юсупова").getByRole("button", { name: "Отключить" }).click();
    await expect(row(page, "Дилноза Юсупова").locator(".staff-actions__confirm")).toBeVisible();
    await page.screenshot({ caret: "initial", path: `${folder}/staff-confirm.png`, fullPage: true });
  });
});
