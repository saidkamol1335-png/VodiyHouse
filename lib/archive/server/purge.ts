import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { sendTelegramDocument, telegramConfig } from "@/lib/leads/server/channels";
import { MEDIA_BUCKET } from "@/lib/media";
import { siteOrigin } from "@/lib/site/metadata";
import { archiveUnitsCsv, type ArchiveUnit } from "../csv";

// Архив (шаг 3.13, PLAN §3а): раз в сутки — напоминание руководителю за 3 дня до удаления и
// окончательное удаление через 30 дней. CSV квартир уходит в Telegram руководителя (чат тревог) —
// без бота файла некуда отправить, удаление всё равно идёт (TODO-исполнитель: тестовый бот).
// Файлы — Storage API (прямой delete в storage.objects запрещён), строки — purge_archived().

type ArchiveItem = {
  kind: "complex" | "developer";
  id: string;
  slug: string;
  name: { ru: string; uz: string };
  purge_at: string;
  complexes: string[];
  media: string[];
};

const REMOVE_CHUNK = 100;

async function items(admin: SupabaseClient, fn: "archive_due" | "take_archive_reminders"): Promise<ArchiveItem[]> {
  const { data, error } = await admin.rpc(fn);
  if (error) throw new Error(`${fn}-failed`, { cause: error });
  return (data ?? []) as ArchiveItem[];
}

/** CSV квартир — руководителю в Telegram (если бот подключён). */
async function sendUnits(admin: SupabaseClient, item: ArchiveItem, caption: string): Promise<void> {
  const config = telegramConfig();
  if (!config) return;
  const { data, error } = await admin.rpc("archive_units", { p_complexes: item.complexes });
  if (error) throw new Error("archive-units-failed", { cause: error });
  const csv = archiveUnitsCsv((data ?? []) as ArchiveUnit[]);
  const result = await sendTelegramDocument(config, config.alertChatId, { name: `${item.slug}-kvartiry.csv`, content: csv }, caption);
  if (!result.ok) console.error("[archive] CSV не отправлен", item.slug, result.error);
}

const date = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" });
const title = (item: ArchiveItem) => (item.kind === "complex" ? `ЖК «${item.name.ru}»` : `Застройщик «${item.name.ru}» со всеми ЖК`);

/** За 3 дня до удаления: «… удалится dd.mm. Восстановить — в кабинете», с CSV квартир. */
export async function remindArchive(admin: SupabaseClient): Promise<number> {
  const due = await items(admin, "take_archive_reminders");
  const cabinet = `${siteOrigin()}${ADMIN_ROUTES.complexes}`;
  for (const item of due) {
    await sendUnits(admin, item, `${title(item)} в архиве: ${date(item.purge_at)} удалится окончательно. Восстановить — ${cabinet}. Квартиры — в файле.`);
  }
  return due.length;
}

/** Файлы в бакете media пачками; Storage не ответил — в лог (сирота не видна на сайте). */
async function removeFiles(admin: SupabaseClient, paths: readonly string[]): Promise<void> {
  for (let start = 0; start < paths.length; start += REMOVE_CHUNK) {
    const { error } = await admin.storage.from(MEDIA_BUCKET).remove(paths.slice(start, start + REMOVE_CHUNK));
    if (error) console.error("[archive] файлы не удалены", error.message);
  }
}

/** 30 дней в архиве: CSV квартир руководителю, файлы, затем строки (база ещё раз проверит срок). */
export async function purgeArchive(admin: SupabaseClient): Promise<number> {
  let purged = 0;
  for (const item of await items(admin, "archive_due")) {
    await sendUnits(admin, item, `${title(item)} удалён(а) после 30 дней в архиве. Квартиры — в файле.`);
    await removeFiles(admin, item.media);
    const { data, error } = await admin.rpc("purge_archived", { p_kind: item.kind, p_id: item.id });
    if (error) console.error("[archive] не удалено", item.slug, error.message);
    else if (data === true) purged += 1;
  }
  return purged;
}
