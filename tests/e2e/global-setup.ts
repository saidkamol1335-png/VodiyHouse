import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generatePassword } from "../../lib/admin/password";
import { assertE2eProject, hasCloud, type Persona, type StaffCredentials } from "./cloud";

// Перед прогоном против облака: тестовые сотрудники e2e-<прогон>-<роль>@example.com.
// Пароли — только в памяти (process.env наследуют процессы тестов), в файлы не пишутся.

type PersonaSpec = { role: "head" | "manager" | "videographer"; fullName: string; changed: boolean; active: boolean };

const PERSONAS: Record<Persona, PersonaSpec> = {
  head: { role: "head", fullName: "E2E Руководитель", changed: true, active: true },
  manager: { role: "manager", fullName: "E2E Менеджер", changed: true, active: true },
  videographer: { role: "videographer", fullName: "E2E Видеограф", changed: true, active: true },
  newcomer: { role: "manager", fullName: "E2E Новичок", changed: false, active: true },
  disabled: { role: "manager", fullName: "E2E Отключённый", changed: true, active: false },
};

async function createPersona(admin: SupabaseClient, runId: string, persona: Persona): Promise<StaffCredentials> {
  const spec = PERSONAS[persona];
  const email = `e2e-${runId}-${persona}@example.com`;
  const password = generatePassword();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`Auth: ${persona} не создан (${created.error?.code})`);
  const id = created.data.user.id;
  const profile = await admin.from("profiles").insert({ id, full_name: spec.fullName, role: spec.role });
  if (profile.error) throw new Error(`Профиль ${persona}: ${profile.error.message}`);
  const flags = await admin
    .from("profiles")
    .update({ must_change_password: !spec.changed, is_active: spec.active })
    .eq("id", id);
  if (flags.error) throw new Error(`Флаги ${persona}: ${flags.error.message}`);
  if (!spec.active) await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  return { id, email, password, fullName: spec.fullName };
}

export default async function globalSetup(): Promise<void> {
  if (!hasCloud) return;
  // Публичные ключи без секретного или без E2E_SUPABASE_PROJECT_REF — понятная ошибка до тестов.
  const { url, secret } = assertE2eProject();
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const runId = Date.now().toString(36);
  const staff = {} as Record<Persona, StaffCredentials>;
  for (const persona of Object.keys(PERSONAS) as Persona[]) {
    staff[persona] = await createPersona(admin, runId, persona);
  }
  process.env.E2E_STAFF = JSON.stringify(staff);
  process.env.E2E_RUN_ID = runId;
}
