"use server";

import type { TelegramLinkResult } from "@/lib/admin/progress/types";
import { unlinkStaffTelegram } from "@/lib/admin/server/progressNotify";
import { telegramLink } from "@/lib/admin/server/secondFactor";
import { requireActionViewer } from "@/lib/admin/session";

// Telegram мобилографа (фаза E, п. 36): по желанию — «Возвращён: причина» и «Опубликован» приходят в
// личный чат. Ссылка t.me с одноразовым токеном на 15 минут (тот же механизм, что у руководителя; вид
// привязки база берёт из роли); отвязать и привязать заново мобилограф может сам.

export async function progressTelegramLinkAction(): Promise<TelegramLinkResult> {
  const guard = await requireActionViewer(["mobilographer"], { fresh: true });
  if (!guard.ok) return { status: "error", error: guard.code };
  const url = await telegramLink(guard.viewer.id).catch(() => null);
  return url ? { status: "link", url } : { status: "error", error: "telegramNoBot" };
}

export async function progressTelegramUnlinkAction(): Promise<TelegramLinkResult> {
  const guard = await requireActionViewer(["mobilographer"], { fresh: true });
  if (!guard.ok) return { status: "error", error: guard.code };
  return (await unlinkStaffTelegram(guard.viewer.id)) ? { status: "unlinked" } : { status: "error", error: "unknown" };
}
