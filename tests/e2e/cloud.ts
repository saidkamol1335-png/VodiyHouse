import { expect, type Page } from "@playwright/test";

// e2e кабинета против облачного Supabase (шаг 8.13). Без ключей в .env.local эти тесты
// пропускаются, а кабинет в разработке открыт без входа (lib/admin/access.ts).

export const hasCloud = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const NO_CLOUD = "нет ключей Supabase в .env.local — проверка ждёт облако";

export type Persona = "head" | "manager" | "videographer" | "newcomer" | "disabled";
export type StaffCredentials = { id: string; email: string; password: string; fullName: string };

/** Тестовые сотрудники из global-setup.ts (через process.env — только в памяти этого прогона). */
export function e2eStaff(): Record<Persona, StaffCredentials> {
  const raw = process.env.E2E_STAFF;
  if (!raw) throw new Error("Нет E2E_STAFF: global-setup.ts не создал тестовых сотрудников");
  return JSON.parse(raw) as Record<Persona, StaffCredentials>;
}

/** Сохранённая сессия (auth.setup.ts); без облака — undefined: кабинет открыт без входа. */
export function cabinetState(persona: "head" | "manager" | "videographer"): string | undefined {
  return hasCloud ? `test-results/.auth/${persona}.json` : undefined;
}

/** Вход через форму /admin/vhod. */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/admin/vhod");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).not.toHaveURL(/\/admin\/vhod/);
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

export const E2E_EMAIL = /^e2e-[a-z0-9]+-[a-z-]+@example\.com$/;
