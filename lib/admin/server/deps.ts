import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignInDeps } from "../auth/signIn";
import { readOwnProfile } from "../session";

// Адаптеры ядер кабинета к Supabase. Единственное место, где разрешён ключ service_role
// (правило ESLint в eslint.config.mjs): сюда приходят только после проверки сотрудника.

/** Не бросает: выход — уборка после неудачного входа, его сбой не меняет ответ. */
async function signOutQuietly(supabase: SupabaseClient, scope: "local" | "others"): Promise<void> {
  try {
    await supabase.auth.signOut({ scope });
  } catch {
    // Сессия истечёт сама; сотруднику сообщаем о причине входа, а не об уборке.
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
