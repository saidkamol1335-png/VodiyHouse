import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { sendTelegramDocument, telegramConfig } from "@/lib/leads/server/channels";
import { MEDIA_BUCKET } from "@/lib/media";
import { siteOrigin } from "@/lib/site/metadata";
import { archiveUnitsCsv, type ArchiveUnit } from "../csv";
import { archiveTitle, type ArchiveName } from "../title";

// Архив (шаг 3.13, PLAN §3а): раз в сутки — напоминание руководителю за 3 дня до удаления и
// окончательное удаление через 30 дней. CSV квартир уходит в Telegram руководителя (чат тревог) —
// без бота файла некуда отправить, удаление всё равно идёт (TODO-исполнитель: тестовый бот); бот
// есть, а файл не ушёл — удаление ждёт следующей ночи. Сначала строки — purge_archived() (база ещё
// раз проверит срок), потом файлы Storage API (прямой delete в storage.objects запрещён): папки ЖК
// и застройщика целиком, вместе с файлами без строки media_assets.

type ArchiveItem = ArchiveName & {
  id: string;
  slug: string;
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

/** CSV квартир — руководителю в Telegram. false — бот есть, а файл не ушёл (без бота — true). */
async function sendUnits(admin: SupabaseClient, item: ArchiveItem, caption: string): Promise<boolean> {
  const config = telegramConfig();
  if (!config) return true;
  const { data, error } = await admin.rpc("archive_units", { p_complexes: item.complexes });
  if (error) throw new Error("archive-units-failed", { cause: error });
  const csv = archiveUnitsCsv((data ?? []) as ArchiveUnit[]);
  const result = await sendTelegramDocument(config, config.alertChatId, { name: `${item.slug}-kvartiry.csv`, content: csv }, caption);
  if (!result.ok) console.error("[archive] CSV не отправлен", item.slug, result.error);
  return result.ok;
}

const date = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" });

/** За 3 дня до удаления: «… удалится dd.mm. Восстановить — в кабинете», с CSV квартир. */
export async function remindArchive(admin: SupabaseClient): Promise<number> {
  const due = await items(admin, "take_archive_reminders");
  const cabinet = `${siteOrigin()}${ADMIN_ROUTES.complexes}`;
  for (const item of due) {
    // Напоминания уже отмечены: сбой одного не должен оставить без напоминания остальные.
    await sendUnits(admin, item, `${archiveTitle(item)} в архиве: ${date(item.purge_at)} удалится окончательно. Восстановить — ${cabinet}. Квартиры — в файле.`).catch(
      (error: unknown) => console.error("[archive] напоминание не отправлено", item.slug, error),
    );
  }
  return due.length;
}

/** Папки владельцев в бакете media: ЖК — complexes/<id>, застройщик — developers/<id>. */
const foldersOf = (item: ArchiveItem) => [
  ...item.complexes.map((id) => `complexes/${id}`),
  ...(item.kind === "developer" ? [`developers/${item.id}`] : []),
];

/** Всё, что лежит в папках (и пути строк media_assets), — пачками; Storage не ответил — в лог. */
async function removeFiles(admin: SupabaseClient, item: ArchiveItem): Promise<void> {
  const bucket = admin.storage.from(MEDIA_BUCKET);
  const paths = new Set(item.media);
  for (const folder of foldersOf(item)) {
    const { data, error } = await bucket.list(folder, { limit: 1000 });
    if (error) console.error("[archive] папка не прочитана", folder, error.message);
    for (const file of data ?? []) paths.add(`${folder}/${file.name}`);
  }
  const all = [...paths];
  for (let start = 0; start < all.length; start += REMOVE_CHUNK) {
    const { error } = await bucket.remove(all.slice(start, start + REMOVE_CHUNK));
    if (error) console.error("[archive] файлы не удалены", error.message);
  }
}

/**
 * 30 дней в архиве: CSV квартир руководителю, строки (база ещё раз проверит срок), затем файлы.
 * postponed — CSV не ушёл, удаление ждёт следующей ночи (видно в ответе задачи /api/cron/archive).
 */
export async function purgeArchive(admin: SupabaseClient): Promise<{ purged: number; postponed: string[] }> {
  let purged = 0;
  const postponed: string[] = [];
  for (const item of await items(admin, "archive_due")) {
    const kept = await sendUnits(admin, item, `${archiveTitle(item)} удаляется после 30 дней в архиве. Квартиры — в файле.`);
    if (!kept) {
      postponed.push(item.slug);
      console.error("[archive] удаление отложено: CSV не ушёл", item.slug, item.purge_at);
      continue;
    }
    const { data, error } = await admin.rpc("purge_archived", { p_kind: item.kind, p_id: item.id });
    if (error) console.error("[archive] не удалено", item.slug, error.message);
    if (data !== true) continue;
    purged += 1;
    await removeFiles(admin, item);
  }
  return { purged, postponed };
}
