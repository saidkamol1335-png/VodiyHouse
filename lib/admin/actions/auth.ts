"use server";

import { redirect, RedirectType } from "next/navigation";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { signIn } from "@/lib/admin/auth/signIn";
import type { SignInState } from "@/lib/admin/auth/types";
import { parseSignIn } from "@/lib/admin/credentials";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { signInDeps } from "@/lib/admin/server/deps";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Действия возвращают коды ошибок — тексты переводит форма (в действиях next-intl без языка падает).
// Пароль не логируется и не возвращается.

/** Вход по email и паролю. Успех — редирект; ошибка — код и введённый email (форма сбрасывается). */
export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = parseSignIn(formData);
  if (!parsed.ok) return { email: parsed.email, error: null, fieldErrors: parsed.fieldErrors };
  const { email } = parsed.value;
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) return { email, error: "notConfigured", fieldErrors: {} };

  const supabase = await createSupabaseServerClient();
  const outcome = await signIn(signInDeps(supabase), parsed.value);
  if (outcome.kind === "error") return { email, error: outcome.code, fieldErrors: {} };
  // Вне try: redirect() бросает NEXT_REDIRECT. replace — «Назад» не вернёт на форму входа.
  redirect(outcome.to, RedirectType.replace);
}

/** Выход только на этом устройстве (по умолчанию Supabase закрыл бы все сессии сотрудника). */
export async function signOutAction(): Promise<void> {
  if (hasSupabaseEnv() && !isCabinetOpenWithoutLogin) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect(ADMIN_ROUTES.login, RedirectType.replace);
}
