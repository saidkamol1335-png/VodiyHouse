import { expect, test } from "@playwright/test";
import { cabinetState, e2eStaff, hasCloud, NO_CLOUD, signIn } from "./cloud";
import { collectPageErrors } from "./helpers";

// Вход в кабинет против облачного Supabase (шаг 8). Входы с паролем — только на 1440:
// у Supabase предел 30 входов за 5 минут с одного адреса.
test.skip(!hasCloud, NO_CLOUD);

const desktopOnly = (projectName: string) => test.skip(projectName !== "desktop-1440", "входы — только на 1440");

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

  test("cookie сессии: SameSite=Lax, путь /; секретного ключа нет в загруженном JS", async ({ page, context }) => {
    const scripts: string[] = [];
    page.on("response", async (response) => {
      if (response.request().resourceType() === "script") scripts.push(await response.text().catch(() => ""));
    });
    await page.goto("/admin");
    const session = (await context.cookies()).find((cookie) => /^sb-.+-auth-token/.test(cookie.name));
    expect(session).toMatchObject({ sameSite: "Lax", path: "/" });
    const secret = process.env.SUPABASE_SECRET_KEY ?? "";
    for (const source of scripts) {
      expect(source).not.toContain("sb_secret_");
      if (secret) expect(source).not.toContain(secret);
    }
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
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("button", { name: "Выйти" }).first().click();
    await expect(page).toHaveURL(/\/admin\/vhod$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/admin$/);
    await signIn(page, newcomer.email, "e2e-новый-пароль");
    await expect(page).toHaveURL(/\/admin$/);
  });
});
