import { expect, test } from "./fixtures";
import { cabinetState, e2eStaff, hasCloud, NO_CLOUD, signIn } from "./cloud";
import { collectPageErrors } from "./helpers";

// Вход в кабинет против облачного Supabase (шаг 8). Входы с паролем — только на 1440:
// у Supabase предел 30 входов за 5 минут с одного адреса.
test.skip(!hasCloud, NO_CLOUD);

const desktopOnly = (projectName: string) => test.skip(projectName !== "desktop-1440", "входы — только на 1440");
const SECRET_KEY_SHAPE = /sb_secret_[A-Za-z0-9_-]{20,}/;

test.describe("без входа", () => {
  test("/admin и /admin/parol → 307 на /admin/vhod; экран входа без cookie сессии", async ({ request }) => {
    for (const path of ["/admin", "/admin/nastroyki", "/admin/parol"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(response.headers().location).toMatch(/\/admin\/vhod$/);
    }
    const login = await request.get("/admin/vhod");
    expect(login.headers()["set-cookie"] ?? "").not.toMatch(/sb-/);
    expect(login.headers()["x-frame-options"]).toBe("DENY");
    expect(login.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("неверный пароль и отключённый — одна фраза, email остаётся", async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name);
    const { manager, disabled } = e2eStaff();
    for (const [email, password] of [
      [manager.email, "неверный-пароль"],
      [disabled.email, disabled.password],
    ]) {
      await page.goto("/admin/vhod");
      await page.getByLabel("Email").fill(email!);
      await page.getByLabel("Пароль", { exact: true }).fill(password!);
      await page.getByRole("button", { name: "Войти" }).click();
      await expect(page.locator(".login-form .form-status--error")).toHaveText("Неверный email или пароль");
      await expect(page.getByLabel("Email")).toHaveValue(email!);
    }
  });
});

test.describe("руководитель", () => {
  test.use({ storageState: cabinetState("head") });

  test("Главная с именем, «Настройки» в меню, консоль чистая", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E");
    await expect(page.getByRole("navigation", { name: "Разделы кабинета" }).getByRole("link", { name: "Настройки" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("cookie сессии: SameSite=Lax, путь /; секретного ключа нет ни в HTML, ни в JS, ни в ответах", async ({ page, context }) => {
    // Все тела ответов (документ, RSC, скрипты) — ждём их явно, а не в обработчике события.
    const bodies: Promise<string>[] = [];
    page.on("response", (response) => bodies.push(response.text().catch(() => "")));
    await page.goto("/admin");
    await page.goto("/admin/nastroyki");
    await page.waitForLoadState("networkidle");
    const sources = [...(await Promise.all(bodies)), await page.content()];
    expect(sources.filter((source) => source.includes("<script") || source.includes("function")).length).toBeGreaterThan(0);

    const session = (await context.cookies()).find((cookie) => /^sb-.+-auth-token/.test(cookie.name));
    expect(session).toMatchObject({ sameSite: "Lax", path: "/" });
    // Ищем ключ по форме, а не голый префикс: он есть в комментарии env.ts (чанк разработки
    // /admin/nastroyki) и в коде supabase-js — это не утечка.
    const secret = process.env.SUPABASE_SECRET_KEY ?? "";
    for (const source of sources) {
      expect(source).not.toMatch(SECRET_KEY_SHAPE);
      if (secret) expect(source).not.toContain(secret);
    }
  });

  // cloud:check видит ключ в JWKS и тогда, когда он ещё «в ожидании», а сессии подписывает HS256 —
  // это видно только по самому токену. С HS256 каждый переход по кабинету — запрос /user к Auth.
  test("сессия подписана асимметричным ключом, а не HS256", async ({ context }) => {
    const chunks = (await context.cookies())
      .filter((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
    const cookie = chunks.map((chunk) => chunk.value).join("").replace(/^base64-/, "");
    const fromBase64 = (value: string) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const session = fromBase64(cookie) as { access_token: string };
    const header = fromBase64(session.access_token.split(".")[0]!) as { alg: string };
    expect(header.alg).toMatch(/^(ES|RS|PS|EdDSA)/);
  });
});

test.describe("менеджер и видеограф", () => {
  test("менеджер: «Настроек» в меню нет; адрес напрямую — «Раздел доступен руководителю»", async ({ browser }) => {
    const context = await browser.newContext({ storageState: cabinetState("manager") });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(page.getByRole("navigation", { name: "Разделы кабинета" }).getByRole("link", { name: "Настройки" })).toHaveCount(0);
    await page.goto("/admin/nastroyki");
    await expect(page.getByRole("heading", { name: "Раздел доступен руководителю" })).toBeVisible();
    await context.close();
  });

  // 12.6 (Н2): права роли в облаке — меню, список, вкладки и действия квартир (DEMO после demo:seed).
  // Н7 здесь не проверить: в сиде у всех блоков есть список — его проверяют тесты базы и стенд.
  // Только на 1440: оба проекта тапнули бы одну и ту же свободную квартиру общего DEMO в облаке.
  test("менеджер: «ЖК» → список без создания → «Квартиры» без генератора, стояков и правок", async ({ browser }, testInfo) => {
    desktopOnly(testInfo.project.name);
    const context = await browser.newContext({ storageState: cabinetState("manager") });
    const page = await context.newPage();
    await page.goto("/admin");
    await page.getByRole("navigation", { name: "Разделы кабинета" }).getByRole("link", { name: "ЖК", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/zhk$/);
    await expect(page.getByRole("button", { name: "Добавить ЖК" })).toHaveCount(0);
    await expect(page.locator(".complex-list__status")).toHaveCount(0);
    // DEMO-сид: у Shodlik оба блока со списком — проверяем, что видно после чтения списка.
    const shodlik = page.locator(".complex-list__row").filter({ hasText: "ЖК Shodlik" });
    await expect(shodlik).toHaveAttribute("href", /\/admin\/zhk\/[0-9a-f-]{36}\/kvartiry$/);
    const units = (await shodlik.getAttribute("href"))!;
    await page.goto(units.replace(/\/kvartiry$/, "/bloki"));
    await expect(page).toHaveURL(new RegExp(`${units}$`));
    await expect(page.getByRole("button", { name: /Сменить статус$/ }).first()).toBeVisible();
    await expect(page.locator(".admin-entity-head")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Статус и правка$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Стояки/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Квартира" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Удалить список блока" })).toHaveCount(0);
    // Настоящая цепочка «действие → функция базы → тег ЖК» менеджером: тап и «Отменить» — DEMO
    // возвращается сам (приёмка 12.7: стенд ходит в demo-действия, а не в эти).
    const free = page.getByRole("button", { name: /, свободна\. Сменить статус$/ }).first();
    const number = /^Кв\. (\S+),/.exec((await free.getAttribute("aria-label"))!)![1]!;
    await free.click();
    await page
      .getByRole("group", { name: new RegExp(`^Статус кв\\. ${number}`) })
      .getByRole("button", { name: "бронь" })
      .click();
    const bar = page.locator(".units-undo");
    await expect(bar).toContainText(`Кв. ${number}: свободна → бронь`);
    await expect(bar).not.toContainText("Сохраняем");
    await bar.getByRole("button", { name: /Отменить/ }).click();
    await expect(bar).toContainText(`Вернули: кв. ${number} — свободна`);
    await context.close();
  });

  test("видеограф: на Главной — заглушка роли", async ({ browser }) => {
    const context = await browser.newContext({ storageState: cabinetState("videographer") });
    const page = await context.newPage();
    await page.goto("/admin");
    await expect(page.getByText("Ваш раздел «Видео» появится")).toBeVisible();
    await context.close();
  });
});

test.describe("первый вход и выход", () => {
  test("новичок: /admin → /admin/parol; ошибки; свой пароль → Главная; выход и вход новым", async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name);
    // Два входа и смена пароля — три действия сервера: в общем прогоне не укладываются в 30 с.
    test.setTimeout(60_000);
    const { newcomer } = e2eStaff();
    await signIn(page, newcomer.email, newcomer.password);
    await expect(page).toHaveURL(/\/admin\/parol$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/parol$/);

    const fill = async (current: string, next: string, repeat: string) => {
      await page.getByLabel("Временный пароль", { exact: true }).fill(current);
      await page.getByLabel("Новый пароль", { exact: true }).fill(next);
      await page.getByLabel("Повторите новый пароль", { exact: true }).fill(repeat);
      await page.getByRole("button", { name: "Сохранить и войти" }).click();
    };
    await fill("не-тот-пароль", "e2e-новый-пароль", "e2e-новый-пароль");
    await expect(page.locator(".password-change-form .field__error")).toHaveText(["Временный пароль не подходит"]);
    await fill(newcomer.password, newcomer.password, newcomer.password);
    await expect(page.locator(".password-change-form .field__error")).toHaveText(["Совпадает с временным — придумайте другой"]);
    await fill(newcomer.password, "e2e-новый-пароль", "e2e-новый-пароль");
    // Смена пароля и вход — действие сервера: в общем прогоне под нагрузкой дольше 5 с.
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    // Настоящая запись кабинета в истории — чтобы «Назад» после выхода было куда нажать.
    await page.goto("/admin");
    await expect(page.locator(".admin-shell")).toHaveCount(1);

    await page.getByRole("button", { name: "Выйти" }).first().click();
    await expect(page).toHaveURL(/\/admin\/vhod$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/vhod/);
    await expect(page.locator(".admin-shell")).toHaveCount(0);
    await signIn(page, newcomer.email, "e2e-новый-пароль");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  });
});
