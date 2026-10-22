import { expect, test } from "@playwright/test";
import { cabinetState, hasCloud } from "./cloud";
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
    await expect(page.getByRole("button", { name: "Показать пароль" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Показать пароль" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("без ключей Supabase: форма отправляется, «сервер не настроен», email остаётся", async ({
    page,
  }) => {
    test.skip(
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      "с ключами — настоящий вход (auth.spec.ts)",
    );
    await page.goto("/admin/vhod");
    await page.getByLabel("Email").fill("Staff@Example.com ");
    await page.getByLabel("Пароль", { exact: true }).fill("demo-password");
    await page.getByRole("button", { name: "Войти" }).click();
    // У Next.js в разработке свой role=alert (объявления маршрута) — ищем внутри формы.
    await expect(page.locator(".login-form .form-status--error")).toHaveText(
      "Вход временно недоступен — сервер не настроен.",
    );
    await expect(page.getByLabel("Email")).toHaveValue("staff@example.com");
    await expect(page).toHaveURL(/\/admin\/vhod$/);
  });

  test("пустые поля — ошибки под полями, без перехода", async ({ page }) => {
    await page.goto("/admin/vhod");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.locator(".login-form .field__error")).toHaveText([
      "Введите email",
      "Введите пароль",
    ]);
    await page.getByLabel("Email").fill("staff");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.locator(".login-form .field__error").first()).toHaveText("Проверьте email");
    await expect(page).toHaveURL(/\/admin\/vhod$/);
  });

  test("отключённого сотрудника встречает уведомление", async ({ page }) => {
    await page.goto("/admin/vhod?prichina=otklyuchen");
    await expect(page.locator(".login-form .form-status--notice")).toHaveText(
      "Ваш доступ отключён. Обратитесь к руководителю.",
    );
    await page.goto("/admin/vhod");
    await expect(page.locator(".form-status")).toHaveCount(0);
  });

  test("К1.2: луч по рамке только в full, вращается через transform", async ({ page }) => {
    await page.goto("/admin/vhod?motion=full");
    const beam = page.locator(".login-card__beam");
    await expect(beam).toBeVisible();
    const beamAnimation = await beam.evaluate(
      (element) => getComputedStyle(element, "::before").animationName,
    );
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

  test("К1.2: карточка не мигает, когда режим переключается lite → full (первый заход)", async ({
    page,
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "full — только десктоп");
    // Прозрачность карточки по кадрам с первой отрисовки: проявилась — больше не гаснет. Переключение
    // делаем сами, как MotionController после пробы FPS: под нагрузкой проба честно выбирает lite.
    await page.addInitScript(() => {
      const state = { samples: [] as number[], switched: false };
      (window as unknown as { card: typeof state }).card = state;
      const tick = () => {
        const card = document.querySelector(".login-card");
        if (card) {
          const opacity = Number(getComputedStyle(card).opacity);
          state.samples.push(opacity);
          if (opacity >= 0.95 && !state.switched) {
            state.switched = true;
            document.documentElement.setAttribute("data-motion", "full");
          }
        }
        if (state.samples.length < 150) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto("/admin/vhod?motion=lite");
    const card = () =>
      page.evaluate(
        () => (window as unknown as { card: { samples: number[]; switched: boolean } }).card,
      );
    await expect.poll(async () => (await card()).samples.length).toBeGreaterThanOrEqual(150);
    const { samples, switched } = await card();
    expect(switched).toBe(true);
    const shown = samples.findIndex((opacity) => opacity >= 0.95);
    expect(Math.min(...samples.slice(shown))).toBeGreaterThan(0.9);
  });

  test("К1.7: без ролика — кадр готового дома, видео нет", async ({ page }) => {
    await page.goto("/admin/vhod?motion=full");
    await expect(page.locator(".login-backdrop__image")).toBeVisible();
    await expect(page.locator(".login-backdrop video")).toHaveCount(0);
  });
});

test.describe("оболочка кабинета /admin", () => {
  // Без ключей кабинет открыт без входа; с ключами — сохранённая сессия руководителя (auth.setup.ts).
  test.use({ storageState: cabinetState("head") });

  test("меню руководителя: Главная, ЖК, Застройщики, Настройки и Сайт; Главная активна", async ({
    page,
  }, testInfo) => {
    const errors = collectPageErrors(page);
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Разделы кабинета" });
    await expect(nav).toHaveCount(1);
    const links = nav.getByRole("link");
    await expect(links).toHaveText(["Главная", "ЖК", "Застройщики", "Настройки", /сайт/i]);
    await expect(links.first()).toHaveAttribute("aria-current", "page");
    await expect(links.nth(1)).toHaveAttribute("href", "/admin/zhk");
    await expect(links.nth(2)).toHaveAttribute("href", "/admin/zastroyshchiki");
    await expect(links.nth(3)).toHaveAttribute("href", "/admin/nastroyki");
    await expect(links.last()).toHaveAttribute("href", "/");
    for (const hidden of ["Заявки", "Статистика"]) {
      await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);
    }
    await expect(
      page.locator(isPhone(testInfo.project.name) ? ".admin-nav--strip" : ".admin-shell__side"),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("К4: заголовок — приветствие по времени Ташкента, подпись — дата (мокап главной)", async ({
    page,
  }) => {
    await page.goto("/admin");
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText(/^(Доброе утро|Добрый день|Добрый вечер)(, .+)?$/);
    await expect(page.locator(".admin-topbar__subtitle")).toContainText(
      /\d{2}\.\d{2}\.\d{4} · данные общие с сайтом и обновляются вживую/,
    );
  });

  test("К2: десктоп — панель 250 px и карточка сотрудника с выходом", async ({
    page,
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "боковая панель — только ≥ 981 px");
    await page.goto("/admin");
    const side = page.locator(".admin-shell__side");
    expect((await side.boundingBox())?.width).toBe(250);
    await expect(side.locator(".admin-user__role")).toHaveText("Руководитель");
    await expect(page.locator(".admin-user-menu")).toBeHidden();
    // Выход — POST-форма (Server Action), а не ссылка. С облаком нажатие закрыло бы общую
    // сессию остальных тестов — там выход проверяет auth.spec.ts своим входом.
    await expect(side.getByRole("link", { name: "Выйти" })).toHaveCount(0);
    if (hasCloud) return;
    await side.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/admin\/vhod$/);
  });

  test("К4.2: верхняя строка прилипает на десктопе", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "на телефоне прилипает лента пилюль");
    await page.goto("/admin");
    await expect(page.locator(".admin-topbar")).toHaveCSS("position", "sticky");
  });

  test("К3: телефон — лента пилюль прилипает, «Выйти» в меню аватара", async ({
    page,
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "лента — только ≤ 980 px");
    await page.goto("/admin");
    await expect(page.locator(".admin-nav--strip")).toHaveCSS("position", "sticky");
    await expect(page.locator(".admin-shell__side")).toBeHidden();
    const toggle = page.getByRole("button", { name: /Сотрудник:/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    if (hasCloud) return; // выход с облаком — auth.spec.ts (см. К2)
    await toggle.click();
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/admin\/vhod$/);
  });

  test("«Настройки»: вкладки Сотрудники · Справочники · Журнал, без ключей — панель «Supabase не подключён»", async ({
    page,
  }) => {
    test.skip(
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      "с ключами — список из базы (staff.spec.ts)",
    );
    const errors = collectPageErrors(page);
    await page.goto("/admin/nastroyki");
    await expect(page.getByRole("heading", { level: 1, name: "Настройки" })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Разделы настроек" });
    await expect(tabs.getByRole("link")).toHaveText(["Сотрудники", "Справочники", "Журнал"]);
    await expect(tabs.getByRole("link", { name: "Сотрудники" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByText("Supabase не подключён — список сотрудников появится"),
    ).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Разделы кабинета" });
    await expect(nav.getByRole("link", { name: "Настройки" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBe(0);
    expect(errors).toEqual([]);
  });

  test("без ключей «Остатки», «Застройщики», «Справочники» и «Журнал» говорят, что база не подключена", async ({
    page,
  }) => {
    test.skip(
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      "с ключами — данные из базы (шаг 10.2 в облаке)",
    );
    const errors = collectPageErrors(page);
    for (const path of [
      "/admin",
      "/admin/zastroyshchiki",
      "/admin/nastroyki/spravochniki",
      "/admin/nastroyki/zhurnal",
    ]) {
      await page.goto(path);
      await expect(
        page.getByText("Облачная база не подключена — данные появятся после шага 7"),
      ).toBeVisible();
    }
    await expect(
      page
        .getByRole("navigation", { name: "Разделы настроек" })
        .getByRole("link", { name: "Журнал" }),
    ).toHaveAttribute("aria-current", "page");
    expect(errors).toEqual([]);
  });

  test("линий колонок в кабинете нет (Э1)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator(".bg-columns")).toHaveCount(0);
    await page.goto("/admin/vhod");
    await expect(page.locator(".bg-columns")).toHaveCount(0);
  });
});
