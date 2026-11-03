"use server";

import { redirect } from "next/navigation";
import { readText } from "@/lib/admin/credentials";
import { ADMIN_ROUTES, landingPath } from "@/lib/admin/nav";
import { normalizeCode } from "@/lib/admin/secondFactor/codes";
import type { FactorResult } from "@/lib/admin/secondFactor/types";
import {
  checkLoginCode,
  confirmSecondFactor,
  factorState,
  redeemBackupCode,
  sendLoginCode,
  telegramLink,
} from "@/lib/admin/server/secondFactor";
import { requireActionViewer } from "@/lib/admin/session";

// Экран кода второго фактора руководителя (PLAN §10, пп. 8, 28). Пускает руководителя с паролем,
// но без фактора (allowSecondFactor); секретный ключ — после свежей проверки Auth (fresh).

const fail = (error: Extract<FactorResult, { status: "error" }>["error"]): FactorResult => ({
  status: "error",
  error,
});

/** Ссылка привязки Telegram — только пока он не привязан (перепривязка — сбросом разработчика). */
export async function telegramLinkAction(): Promise<FactorResult> {
  const guard = await requireActionViewer(["head"], { fresh: true, allowSecondFactor: true });
  if (!guard.ok) return fail(guard.code);
  const url = await telegramLink(guard.viewer.id).catch(() => null);
  return url ? { status: "link", url } : fail("linked");
}

/** «Отправить код» — в Telegram руководителя. */
export async function sendLoginCodeAction(): Promise<FactorResult> {
  const guard = await requireActionViewer(["head"], { fresh: true, allowSecondFactor: true });
  if (!guard.ok) return fail(guard.code);
  const result = await sendLoginCode(guard.viewer.id).catch(() => "failed" as const);
  if (result === "sent") return { status: "sent", at: Date.now() };
  return fail(result === "failed" ? "sendFailed" : result);
}

/**
 * Код подтверждён — Auth поднимает сессию до aal2. Запасных кодов нет (первый вход или все
 * израсходованы) — экран 10 новых кодов (п. 28); иначе — в кабинет. Отдельным адресом: после
 * смены cookie Next перерисует /kod, и ответ действия до экрана бы не дошёл.
 */
async function finish(
  session: Parameters<typeof confirmSecondFactor>[0],
  userId: string,
): Promise<FactorResult> {
  try {
    await confirmSecondFactor(session, userId);
  } catch (error) {
    console.error("[2fa] фактор не подтверждён", error);
    return fail("unknown");
  }
  const state = await factorState(userId);
  redirect(state.backupLeft === 0 ? ADMIN_ROUTES.backupCodes : landingPath("head"));
}

export async function verifyLoginCodeAction(formData: FormData): Promise<FactorResult> {
  const guard = await requireActionViewer(["head"], { fresh: true, allowSecondFactor: true });
  if (!guard.ok) return fail(guard.code);
  const code = normalizeCode(readText(formData, "code") ?? "");
  if (!/^\d{6}$/.test(code) || !(await checkLoginCode(guard.viewer.id, code)))
    return fail("wrongCode");
  return finish(guard.supabase, guard.viewer.id);
}

/** Запасной код — если Telegram недоступен; код сгорает. */
export async function verifyBackupCodeAction(formData: FormData): Promise<FactorResult> {
  const guard = await requireActionViewer(["head"], { fresh: true, allowSecondFactor: true });
  if (!guard.ok) return fail(guard.code);
  const code = normalizeCode(readText(formData, "code") ?? "");
  if (!/^[A-Z0-9]{8}$/.test(code) || !(await redeemBackupCode(guard.viewer.id, code)))
    return fail("wrongCode");
  return finish(guard.supabase, guard.viewer.id);
}
