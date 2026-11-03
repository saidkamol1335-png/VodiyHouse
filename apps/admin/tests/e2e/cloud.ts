import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { backupCode, hashCode } from "../../lib/admin/secondFactor/codes";

// e2e кабинета против облачного Supabase (шаг 8.13). Без ключей в .env.local эти тесты
// пропускаются, а кабинет в разработке открыт без входа (lib/admin/access.ts).

export const hasCloud = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const NO_CLOUD = "нет ключей Supabase в .env.local — проверка ждёт облако";

export type Persona = "head" | "manager" | "mobilographer" | "mobilographer2" | "newcomer" | "disabled";

/** Персоны с сохранённой сессией (auth.setup.ts). */
export type CabinetPersona = "head" | "manager" | "mobilographer" | "mobilographer2";
export type StaffCredentials = { id: string; email: string; password: string; fullName: string };

/** Тестовые сотрудники из global-setup.ts (через process.env — только в памяти этого прогона). */
export function e2eStaff(): Record<Persona, StaffCredentials> {
  const raw = process.env.E2E_STAFF;
  if (!raw) throw new Error("Нет E2E_STAFF: global-setup.ts не создал тестовых сотрудников");
  return JSON.parse(raw) as Record<Persona, StaffCredentials>;
}

/** Сохранённая сессия (auth.setup.ts); без облака — undefined: кабинет открыт без входа. */
export function cabinetState(persona: CabinetPersona): string | undefined {
  return hasCloud ? `test-results/.auth/${persona}.json` : undefined;
}

/** Отправка формы /admin/vhod без ожидания перехода — для входов, которые должны не пройти. */
export async function submitSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/vhod");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
}

/**
 * Вход через форму /admin/vhod. Переход — после Auth во Франкфурте, чтения профиля и отрисовки
 * /admin (первый раз — с компиляцией): 5 с по умолчанию мало, а упавший вход в проекте setup
 * снимает с прогона все тесты, и стенды тоже.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await submitSignIn(page, email, password);
  await expect(page).not.toHaveURL(/\/vhod/, { timeout: 30_000 });
}

/** Тестовые сотрудники создаются и удаляются только в проекте E2E_SUPABASE_PROJECT_REF. */
export function assertE2eProject(): { url: string; secret: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const secret = process.env.SUPABASE_SECRET_KEY ?? "";
  const allowed = process.env.E2E_SUPABASE_PROJECT_REF ?? "";
  const ref = new URL(url).hostname.split(".")[0];
  if (!secret) throw new Error("Для e2e против облака нужен SUPABASE_SECRET_KEY в .env.local");
  if (!allowed || ref !== allowed) {
    throw new Error(`e2e создают сотрудников только в проекте E2E_SUPABASE_PROJECT_REF (сейчас ${ref}) — см. .env.example`);
  }
  return { url, secret };
}

// Персона может кончаться цифрой (mobilographer2, фаза E).
export const E2E_EMAIL = /^e2e-[a-z0-9]+-[a-z0-9-]+@example\.com$/;

/**
 * Второй фактор руководителя (PLAN §10, п. 8) на e2e: Telegram тестового сотрудника не привязан —
 * сервисным ключом выдаём один запасной код и входим им; затем экран 10 новых кодов → кабинет.
 */
export async function passSecondFactor(page: Page, userId: string): Promise<void> {
  const { url, secret } = assertE2eProject();
  const code = backupCode();
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.rpc("save_head_backup_codes", { p_user: userId, p_hashes: [hashCode(code)] });
  if (error) throw new Error(`запасной код не выдан: ${error.message}`);
  await page.goto("/kod");
  await page.getByRole("button", { name: /Войти запасным кодом/ }).click();
  await page.getByLabel("Запасной код").fill(code);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  // Коды выдаёт кнопка на /kod/zapasnye (открытие страницы ничего не меняет).
  await page.getByRole("button", { name: "Показать запасные коды" }).click({ timeout: 30_000 });
  await page.getByRole("link", { name: "Я сохранил коды — в кабинет" }).click({ timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/kod/, { timeout: 30_000 });
}
