import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BACKUP_CODES,
  backupCode,
  hashCode,
  linkToken,
  loginCode,
} from "@/lib/admin/secondFactor/codes";
import { totp } from "@/lib/admin/secondFactor/totp";
import { botConfig, sendTelegram, telegramConfig } from "@/lib/leads/server/channels";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Второй фактор руководителя (PLAN §10, пп. 8, 28). Хранилище фактора — функции базы только для
// секретного ключа; вызывать после requireActionViewer(["head"], { fresh: true, allowSecondFactor }).
// Сессия руководителя (session) нужна Auth: фактор заводится и подтверждается от её имени.

export type FactorState = { telegram: boolean; factorId: string | null; backupLeft: number };

type DbState = { telegram: boolean; factor_id: string | null; backup_left: number };

function admin() {
  return createSupabaseAdminClient();
}

/** Ответ функции базы; отказ — исключение с именем функции. */
function unwrap<T>(fn: string, reply: { data: unknown; error: unknown }): T {
  if (reply.error) throw new Error(`${fn}-failed`, { cause: reply.error });
  return reply.data as T;
}

export async function factorState(userId: string): Promise<FactorState> {
  const state = unwrap<DbState>(
    "head_factor_state",
    await admin().rpc("head_factor_state", { p_user: userId }),
  );
  return {
    telegram: state.telegram,
    factorId: state.factor_id,
    backupLeft: Number(state.backup_left),
  };
}

let botUsername: string | null = null;

/** Имя бота для ссылки t.me/<бот> — у самого Telegram (getMe), один раз на процесс. */
async function readBotUsername(): Promise<string | null> {
  if (botUsername) return botUsername;
  const config = botConfig();
  if (!config) return null;
  const response = await fetch(`https://api.telegram.org/bot${config.token}/getMe`, {
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  }).catch(() => null);
  const body = (await response?.json().catch(() => null)) as {
    result?: { username?: string };
  } | null;
  botUsername = body?.result?.username ?? null;
  return botUsername;
}

/** Ссылка привязки Telegram на 15 минут; null — уже привязан или бот не настроен. */
export async function telegramLink(userId: string): Promise<string | null> {
  const username = await readBotUsername();
  if (!username) return null;
  const token = linkToken();
  const created = unwrap<boolean>(
    "create_staff_telegram_link",
    await admin().rpc("create_staff_telegram_link", {
      p_user: userId,
      p_token_hash: hashCode(token),
    }),
  );
  return created ? `https://t.me/${username}?start=${token}` : null;
}

export type SendCodeResult = "sent" | "noTelegram" | "tooSoon" | "noBot" | "failed";

/** Код входа в Telegram руководителя: 6 цифр, 10 минут, не чаще раза в минуту. */
export async function sendLoginCode(userId: string): Promise<SendCodeResult> {
  const config = telegramConfig() ?? null;
  if (!config) return "noBot";
  const chat = unwrap<number | string | null>(
    "staff_telegram_chat",
    await admin().rpc("staff_telegram_chat", { p_user: userId }),
  );
  if (chat === null) return "noTelegram";
  const code = loginCode();
  const issued = unwrap<boolean>(
    "issue_head_code",
    await admin().rpc("issue_head_code", { p_user: userId, p_code_hash: hashCode(code) }),
  );
  if (!issued) return "tooSoon";
  const sent = await sendTelegram(
    config,
    String(chat),
    `🔐 Код входа в кабинет Vodiy House: ${code}\nДействует 10 минут. Если входили не вы — смените пароль.`,
  );
  if (!sent.ok) console.error("[2fa] код не отправлен", sent.error);
  return sent.ok ? "sent" : "failed";
}

export const checkLoginCode = async (userId: string, code: string) =>
  unwrap<boolean>(
    "check_head_code",
    await admin().rpc("check_head_code", { p_user: userId, p_code_hash: hashCode(code) }),
  );

export const redeemBackupCode = async (userId: string, code: string) =>
  unwrap<boolean>(
    "use_head_backup_code",
    await admin().rpc("use_head_backup_code", { p_user: userId, p_code_hash: hashCode(code) }),
  );

/** 10 новых запасных кодов — прежние больше не действуют. Показать один раз. */
export async function renewBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODES }, backupCode);
  unwrap(
    "save_head_backup_codes",
    await admin().rpc("save_head_backup_codes", { p_user: userId, p_hashes: codes.map(hashCode) }),
  );
  return codes;
}

export type PreparedFactor = { factorId: string; secret: string };

/**
 * TOTP-фактор Supabase для руководителя: есть наш — его секрет; нет — заводим от имени сессии.
 * Любой другой фактор (завёл кто-то напрямую через Auth, зная пароль) удаляет секретный ключ:
 * сессия aal1 чужой подтверждённый фактор снять не может. Код человека здесь ещё не тратится.
 */
export async function prepareFactor(session: SupabaseClient, userId: string): Promise<PreparedFactor> {
  const stored = unwrap<PreparedFactor & { factor_id: string } | null>(
    "head_totp_secret",
    await admin().rpc("head_totp_secret", { p_user: userId }),
  );
  const listed = await admin().auth.admin.mfa.listFactors({ userId });
  if (listed.error) throw new Error("mfa-list-failed", { cause: listed.error });
  for (const factor of listed.data.factors) {
    if (factor.id === stored?.factor_id) continue;
    const removed = await admin().auth.admin.mfa.deleteFactor({ userId, id: factor.id });
    if (removed.error) throw new Error("mfa-delete-failed", { cause: removed.error });
  }
  if (stored && listed.data.factors.some((factor) => factor.id === stored.factor_id)) {
    return { factorId: stored.factor_id, secret: stored.secret };
  }
  const enrolled = await session.auth.mfa.enroll({ factorType: "totp", friendlyName: "Telegram" });
  if (enrolled.error) throw new Error("mfa-enroll-failed", { cause: enrolled.error });
  const { id, totp: secret } = enrolled.data;
  unwrap("save_head_totp", await admin().rpc("save_head_totp", { p_user: userId, p_factor: id, p_secret: secret.secret }));
  return { factorId: id, secret: secret.secret };
}

/**
 * Код из Telegram или запасной уже проверен — сервер подтверждает TOTP от имени сессии
 * руководителя: Auth выдаёт токен с aal2 и свежей отметкой totp (cookie пишет клиент сессии).
 */
export async function confirmSecondFactor(session: SupabaseClient, factor: PreparedFactor): Promise<void> {
  const verified = await session.auth.mfa.challengeAndVerify({ factorId: factor.factorId, code: totp(factor.secret) });
  if (verified.error) throw new Error("mfa-verify-failed", { cause: verified.error });
}
