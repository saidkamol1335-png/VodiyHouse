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
  prepareFactor,
  redeemBackupCode,
  renewBackupCodes,
  sendLoginCode,
  telegramLink,
  type PreparedFactor,
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

type Session = Parameters<typeof prepareFactor>[0];

/** Фактор в Auth готов до траты кода: сбой Auth не сожжёт код из Telegram или запасной. */
async function prepared(session: Session, userId: string): Promise<PreparedFactor | null> {
  try {
    return await prepareFactor(session, userId);
  } catch (error) {
    console.error("[2fa] фактор не подготовлен", error);
    return null;
  }
}

/**
 * Код подтверждён — Auth поднимает сессию до aal2. Запасных кодов нет (первый вход или все
 * израсходованы) — экран 10 новых кодов (п. 28); иначе — в кабинет. Отдельным адресом: после
 * смены cookie Next перерисует /kod, и ответ действия до экрана бы не дошёл.
 */
async function finish(session: Session, userId: string, factor: PreparedFactor): Promise<FactorResult> {
  try {
    await confirmSecondFactor(session, factor);
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
  if (!/^\d{6}$/.test(code)) return fail("wrongCode");
  const factor = await prepared(guard.supabase, guard.viewer.id);
  if (!factor) return fail("unknown");
  if (!(await checkLoginCode(guard.viewer.id, code))) return fail("wrongCode");
  return finish(guard.supabase, guard.viewer.id, factor);
}

/** Запасной код — если Telegram недоступен; код сгорает. */
export async function verifyBackupCodeAction(formData: FormData): Promise<FactorResult> {
  const guard = await requireActionViewer(["head"], { fresh: true, allowSecondFactor: true });
  if (!guard.ok) return fail(guard.code);
  const code = normalizeCode(readText(formData, "code") ?? "");
  if (!/^[A-Z0-9]{8}$/.test(code)) return fail("wrongCode");
  const factor = await prepared(guard.supabase, guard.viewer.id);
  if (!factor) return fail("unknown");
  if (!(await redeemBackupCode(guard.viewer.id, code))) return fail("wrongCode");
  return finish(guard.supabase, guard.viewer.id, factor);
}

/**
 * 10 запасных кодов на /kod/zapasnye — действием, не открытием страницы: только руководителю со
 * свежим вторым фактором и только когда неизрасходованных нет (п. 28).
 */
export async function issueBackupCodesAction(): Promise<FactorResult> {
  const guard = await requireActionViewer(["head"], { fresh: true });
  if (!guard.ok) return fail(guard.code);
  const state = await factorState(guard.viewer.id);
  if (state.backupLeft > 0) return fail("issued");
  return { status: "codes", codes: await renewBackupCodes(guard.viewer.id) };
}
