import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { visitorAddress } from "@/lib/clientAddress";
import { hasSupabaseAdminEnv, supabaseSecretKey } from "@/lib/supabase/env";
import { createSupabaseVerifierClient } from "@/lib/supabase/verifier";
import type { ChangePasswordDeps } from "../auth/changePassword";
import type { SignInDeps } from "../auth/signIn";
import { normalizeEmail } from "../credentials";
import { generatePassword } from "../password";
import { readOwnProfile } from "../session";
import type { CreateStaffDeps } from "../staff/createStaff";
import { parseDirectoryRows, type DirectoryRow, type StaffMember } from "../staff/directory";
import { BAN_DURATION, type ManageStaffDeps } from "../staff/manageStaff";

// Адаптеры ядер кабинета к Supabase. Единственное место, где разрешён ключ service_role
// (правило ESLint в eslint.config.mjs): сюда приходят только после проверки сотрудника.

/** Не бросает: выход — уборка, его сбой не меняет ответ сотруднику. */
async function signOutQuietly(supabase: SupabaseClient, scope: "local" | "others"): Promise<void> {
  try {
    await supabase.auth.signOut({ scope });
  } catch {
    // Сессия истечёт сама; сотруднику сообщаем о главном действии, а не об уборке.
  }
}

/**
 * Ключ счётчика попыток входа (20261029060000_login_failures.sql): HMAC секретным ключом от email и
 * адреса посетителя — в базе ни почты, ни адреса, а чужой подбор с другого адреса сотрудника не запирает.
 */
export function loginAttemptKey(email: string, ip: string | null): string {
  return createHmac("sha256", supabaseSecretKey()).update(`login:${normalizeEmail(email)}:${ip ?? "-"}`).digest("hex");
}

/**
 * Счётчик попыток — секретным ключом (функции базы только для service_role). Без ключа (разработка)
 * и при сбое базы вход не закрывается: остаётся лимит Supabase Auth по адресу.
 */
function loginAttemptDeps(): Pick<SignInDeps, "beginAttempt" | "clearAttempts"> {
  if (!hasSupabaseAdminEnv()) return { beginAttempt: async () => true, clearAttempts: async () => undefined };
  const admin = createSupabaseAdminClient();
  // Адрес — как у лимита заявок (lib/clientAddress.ts): заголовок Netlify, IPv6 — сетью /64.
  const keyOf = async (email: string) => loginAttemptKey(email, visitorAddress(await headers()));
  return {
    async beginAttempt(email) {
      try {
        const { data, error } = await admin.rpc("begin_login_attempt", { p_key: await keyOf(email) });
        return Boolean(error) || data !== false;
      } catch {
        return true;
      }
    },
    async clearAttempts(email) {
      try {
        await admin.rpc("clear_login_attempts", { p_key: await keyOf(email) });
      } catch {
        // Счётчик — дополнительная защита; ответ сотруднику от него не зависит.
      }
    },
  };
}

export function signInDeps(supabase: SupabaseClient): SignInDeps {
  return {
    ...loginAttemptDeps(),
    async signInWithPassword({ email, password }) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return { error: error ?? {} };
      return { userId: data.user.id };
    },
    readOwnProfile: (userId) => readOwnProfile(supabase, userId),
    signOutLocal: () => signOutQuietly(supabase, "local"),
  };
}

/** Временный пароль: отдельный вход без cookie; его сессия сразу закрывается. */
async function verifyPassword(
  email: string,
  password: string,
): ReturnType<ChangePasswordDeps["verifyCurrentPassword"]> {
  const verifier = await createSupabaseVerifierClient();
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (error) return error.code === "invalid_credentials" ? "wrong" : { error };
  await signOutQuietly(verifier, "local");
  return "ok";
}

/**
 * «Сотрудники»: session — сессия руководителя (профиль, отключение, «Новый пароль» идут через RLS
 * и журнал), Auth — секретным ключом. Вызывать только после requireActionViewer(["head"], { fresh }).
 */
export function staffDeps(session: SupabaseClient): CreateStaffDeps & ManageStaffDeps {
  const admin = createSupabaseAdminClient();
  return {
    generatePassword: () => generatePassword(),
    async createAuthUser({ email, password }) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) return { error: error ?? {} };
      return { id: data.user.id };
    },
    async insertProfile({ id, fullName, role }) {
      const { error } = await session.from("profiles").insert({ id, full_name: fullName, role });
      return error;
    },
    async deleteAuthUser(id) {
      const { error } = await admin.auth.admin.deleteUser(id);
      return !error;
    },
    async updateActive(id, active) {
      const { data, error } = await session
        .from("profiles")
        .update({ is_active: active })
        .eq("id", id)
        .select("id");
      return error ? { error } : { rows: data?.length ?? 0 };
    },
    async setBan(id, banned) {
      const { error } = await admin.auth.admin.updateUserById(id, {
        ban_duration: banned ? BAN_DURATION : "none",
      });
      return !error;
    },
    async requirePasswordChange(id) {
      const { error } = await session.rpc("require_password_change", { staff_id: id });
      return error;
    },
    async setPassword(id, password) {
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      return !error;
    },
  };
}

/** «Сотрудники» сессией руководителя: функция базы отдаёт строки только ему. */
export async function readStaffDirectory(supabase: SupabaseClient): Promise<StaffMember[]> {
  const { data, error } = await supabase.rpc("staff_directory");
  if (error) throw new Error("staff-directory-unavailable", { cause: error });
  return parseDirectoryRows((data ?? []) as DirectoryRow[]);
}

/** supabase — сессия самого сотрудника (cookie). */
export function passwordDeps(supabase: SupabaseClient): ChangePasswordDeps {
  return {
    verifyCurrentPassword: verifyPassword,
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      return error;
    },
    // Пароль в Auth уже сменён: любой сбой здесь — «вход не завершён», а не падение страницы.
    async clearMustChange(userId) {
      try {
        const { data, error } = await createSupabaseAdminClient()
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", userId)
          .select("id");
        return !error && data?.length === 1;
      } catch {
        return false;
      }
    },
    signOutOthers: () => signOutQuietly(supabase, "others"),
  };
}
