"use server";

import {
  archiveFilterItem,
  FILTER_ARCHIVE_KEY,
  FILTER_ARCHIVE_MAX,
  type FilterArchive,
  isFilterArchiveId,
  restoreFilterItem,
} from "@vh/shared/filterArchive";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { readFilterArchiveRow } from "@/lib/admin/server/filterArchive";
import { type ActionGuardCode, requireActionViewer } from "@/lib/admin/session";
import { expireSiteSettings } from "@/lib/cache";

// «Настройки → Фильтр сайта» (06.11.2026): кнопку или блок фильтра — в архив и обратно. Правят
// руководитель и менеджер (решение заказчика); права ещё раз проверяет RLS settings (20261106120000),
// журнал — триггер аудита. Запись публичная: её читает сайт ролью посетителя.
// Запись — целым значением, но с проверкой версии (updated_at): два сотрудника одновременно не
// затирают правки друг друга — второй перечитывает архив и применяет своё поверх.

export type FilterArchiveResult =
  | { status: "saved"; archive: FilterArchive }
  | { status: "error"; error: ContentErrorCode | ActionGuardCode | "busy" };

export type FilterArchiveMode = "archive" | "restore";

/** Попыток записи при одновременной правке: больше двух подряд у кабинета не бывает. */
const ATTEMPTS = 3;

type Guarded = Extract<Awaited<ReturnType<typeof requireActionViewer>>, { ok: true }>;
type Attempt = FilterArchiveResult | "stale";

async function attempt(guard: Guarded, id: string, mode: FilterArchiveMode): Promise<Attempt> {
  const row = await readFilterArchiveRow(guard.supabase);
  if (!row.ok) return { status: "error", error: "network" };
  const current = row.archive;
  const present = current.items.some((item) => item.id === id);
  // Уже так, как просят (коллега успел раньше), — не пишем.
  if (present === (mode === "archive")) return { status: "saved", archive: current };
  if (mode === "archive" && current.items.length >= FILTER_ARCHIVE_MAX)
    return { status: "error", error: "tooMany" };
  const next =
    mode === "archive"
      ? archiveFilterItem(current, id, new Date().toISOString())
      : restoreFilterItem(current, id);
  const value = { key: FILTER_ARCHIVE_KEY, value: next, is_public: true };
  const { data, error } =
    row.updatedAt === null
      ? await guard.supabase.from("settings").insert(value).select("key")
      : await guard.supabase
          .from("settings")
          .update(value)
          .eq("key", FILTER_ARCHIVE_KEY)
          .eq("updated_at", row.updatedAt)
          .select("key");
  // Строку успел создать коллега (unique) — перечитать и повторить.
  if (error?.code === "23505") return "stale";
  if (error) return { status: "error", error: contentDbErrorCode(error) };
  if (data.length === 0)
    return (await changedSince(guard, row.updatedAt))
      ? "stale"
      : { status: "error", error: "forbidden" };
  return { status: "saved", archive: next };
}

/**
 * 0 строк при обновлении: либо коллега поменял архив (версия другая — повторить), либо RLS не пустил
 * (версия та же: правка запрещена, а не «занято»).
 */
async function changedSince(guard: Guarded, updatedAt: string | null): Promise<boolean> {
  const row = await readFilterArchiveRow(guard.supabase);
  return !row.ok || row.updatedAt !== updatedAt;
}

export async function setFilterArchiveAction(
  id: string,
  mode: FilterArchiveMode,
): Promise<FilterArchiveResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return { status: "error", error: guard.code };
  if (!isFilterArchiveId(id) || (mode !== "archive" && mode !== "restore"))
    return { status: "error", error: "invalid" };
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const result = await attempt(guard, id, mode);
    if (result === "stale") continue;
    // Фильтр — на главной и в каталоге: кнопка исчезает с сайта сразу.
    if (result.status === "saved") expireSiteSettings();
    return result;
  }
  return { status: "error", error: "busy" };
}
