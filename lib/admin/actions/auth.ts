"use server";

import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { hasAuthCookie } from "@/lib/admin/gate";
import { isCabinetOpenWithoutLogin, STAFF_ROLES } from "@/lib/admin/access";
import { changeFirstPassword } from "@/lib/admin/auth/changePassword";
import { signIn } from "@/lib/admin/auth/signIn";
import type { PasswordState, SignInState } from "@/lib/admin/auth/types";
import type { PasswordErrorCode } from "@/lib/admin/authErrors";
import { parsePasswordChange, parseSignIn } from "@/lib/admin/credentials";
import { ADMIN_ROUTES, landingPath } from "@/lib/admin/nav";
import { passwordDeps, signInDeps } from "@/lib/admin/server/deps";
import { requireActionViewer, type ActionGuardCode } from "@/lib/admin/session";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Действия возвращают коды ошибок — тексты переводит форма (в действиях next-intl без языка падает).
// Пароль не логируется и не возвращается.

/** Вход по email и паролю. Успех — редирект; ошибка — код и введённый email (форма сбрасывается). */
export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = parseSignIn(formData);
  if (!parsed.ok) return { email: parsed.email, error: null, fieldErrors: parsed.fieldErrors };
  const { email } = parsed.value;
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv())
    return { email, error: "notConfigured", fieldErrors: {} };

  const supabase = await createSupabaseServerClient();
  const outcome = await signIn(signInDeps(supabase), parsed.value);
  if (outcome.kind === "error") return { email, error: outcome.code, fieldErrors: {} };
  // Вне try: redirect() бросает NEXT_REDIRECT. replace — «Назад» не вернёт на форму входа.
  redirect(outcome.to, RedirectType.replace);
}

const GUARD_TO_PASSWORD_ERROR = {
  notConfigured: "notConfigured",
  session: "session",
  // Отключённого или чужую роль на этом экране просим войти заново — кабинет объяснит причину.
  forbidden: "session",
  network: "network",
} as const satisfies Record<ActionGuardCode, PasswordErrorCode>;

/** Первая смена пароля (/admin/parol): временный пароль, новый и повтор. */
export async function changePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const guard = await requireActionViewer(STAFF_ROLES, { allowPasswordChange: true });
  if (!guard.ok) return { error: GUARD_TO_PASSWORD_ERROR[guard.code], fieldErrors: {} };
  // Флаг снимает сервер секретным ключом: без него пароль в Auth сменился бы, а сотрудник
  // застрял бы на этом экране. Проверяем до любых изменений.
  if (!hasSupabaseAdminEnv()) return { error: "notConfigured", fieldErrors: {} };
  const { viewer, email, supabase } = guard;
  if (!viewer.mustChangePassword) redirect(landingPath(viewer.role), RedirectType.replace);
  if (!email) return { error: "session", fieldErrors: {} };

  const fields = parsePasswordChange(formData);
  const outcome = await changeFirstPassword(passwordDeps(supabase), {
    ...fields,
    userId: viewer.id,
    email,
    role: viewer.role,
  });
  if (outcome.kind === "error") return { error: outcome.code, fieldErrors: outcome.fieldErrors };
  redirect(outcome.to, RedirectType.replace);
}

/**
 * Выход только на этом устройстве (по умолчанию Supabase закрыл бы все сессии сотрудника).
 * Если Supabase не ответил, cookie сессии удаляем сами: иначе на общем компьютере следующий
 * открыл бы кабинет под этим сотрудником, хотя экран показал «вход».
 */
export async function signOutAction(): Promise<void> {
  if (hasSupabaseEnv() && !isCabinetOpenWithoutLogin) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      const store = await cookies();
      for (const { name } of store.getAll())
        if (hasAuthCookie([name])) store.delete({ name, path: "/" });
    }
  }
  redirect(ADMIN_ROUTES.login, RedirectType.replace);
}
