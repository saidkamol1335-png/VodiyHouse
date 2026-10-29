import { resolveViewer, type OwnProfileRow } from "../access";
import { signInErrorCode, type AuthErrorLike, type SignInErrorCode } from "../authErrors";
import type { SignInInput } from "../credentials";
import { afterSignInPath } from "../landing";

// Вход в кабинет без Next.js и Supabase: зависимости подставляются (тесты — подделки,
// сервер — lib/admin/server/deps.ts).

export type SignInDeps = {
  /**
   * Попытка записана до проверки пароля; false — 10 попыток за 15 минут с этим email и адресом
   * (20261029060000). Сбой счётчика — не закрыт: остаётся лимит Supabase Auth.
   */
  beginAttempt(email: string): Promise<boolean>;
  /** Пароль верный — попытки стёрты. Не бросает. */
  clearAttempts(email: string): Promise<void>;
  signInWithPassword(input: SignInInput): Promise<{ userId: string } | { error: AuthErrorLike }>;
  /** Под только что открытой сессией; сбой сети — исключение. */
  readOwnProfile(userId: string): Promise<OwnProfileRow | null>;
  /** Закрыть только что открытую сессию: вход не состоялся. Не бросает. */
  signOutLocal(): Promise<void>;
};

export type SignInOutcome = { kind: "redirect"; to: string } | { kind: "error"; code: SignInErrorCode };

/**
 * Счётчик попыток → пароль → профиль → куда вести. Закрытый вход в Auth не идёт.
 * Без профиля или отключённому сессия сразу закрывается.
 */
export async function signIn(deps: SignInDeps, input: SignInInput): Promise<SignInOutcome> {
  if (!(await deps.beginAttempt(input.email))) return { kind: "error", code: "locked" };
  const result = await deps.signInWithPassword(input);
  if ("error" in result) return { kind: "error", code: signInErrorCode(result.error) };
  await deps.clearAttempts(input.email);

  let profile: OwnProfileRow | null;
  try {
    profile = await deps.readOwnProfile(result.userId);
  } catch {
    await deps.signOutLocal();
    return { kind: "error", code: "unknown" };
  }

  const viewer = resolveViewer(result.userId, profile);
  if (viewer.kind === "login" || viewer.kind === "noAccess") {
    await deps.signOutLocal();
    return { kind: "error", code: "noAccess" };
  }
  return { kind: "redirect", to: afterSignInPath(viewer.viewer) };
}
