import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseVerifierClient } from "@/lib/supabase/verifier";
import type { ChangePasswordDeps } from "../auth/changePassword";
import type { SignInDeps } from "../auth/signIn";
import { readOwnProfile } from "../session";
import { parseDirectoryRows, type DirectoryRow, type StaffMember } from "../staff/directory";

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

export function signInDeps(supabase: SupabaseClient): SignInDeps {
  return {
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
async function verifyPassword(email: string, password: string): ReturnType<ChangePasswordDeps["verifyCurrentPassword"]> {
  const verifier = createSupabaseVerifierClient();
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (error) return error.code === "invalid_credentials" ? "wrong" : { error };
  await signOutQuietly(verifier, "local");
  return "ok";
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
    async clearMustChange(userId) {
      const { data, error } = await createSupabaseAdminClient()
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", userId)
        .select("id");
      return !error && data?.length === 1;
    },
    signOutOthers: () => signOutQuietly(supabase, "others"),
  };
}
