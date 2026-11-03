import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { INCOMING_BUCKET, INCOMING_PATH_PATTERN } from "@/lib/media";

// Ночная уборка приватного incoming (фаза E, п. 13): файлы старше 48 часов, на которые не ссылается ни
// один отчёт, — загрузки, брошенные до сохранения, убранные из черновика, отчёты, удалённые с ЖК. Новый
// файл база берёт в отчёт только моложе суток, поэтому уборка не гонится с сохранением.

const BATCH = 100;

/** Сколько файлов удалено; список даёт база (только секретный ключ), имя ещё раз сверяется с шаблоном. */
export async function sweepIncoming(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.rpc("progress_incoming_orphans", { p_limit: 1000 });
  if (error) throw new Error("incoming-orphans-unavailable", { cause: error });
  const names = ((data ?? []) as unknown[]).filter(
    (name): name is string => typeof name === "string" && INCOMING_PATH_PATTERN.test(name),
  );
  let removed = 0;
  for (let start = 0; start < names.length; start += BATCH) {
    const chunk = names.slice(start, start + BATCH);
    const { error: removeError } = await admin.storage.from(INCOMING_BUCKET).remove(chunk);
    if (removeError) console.error("[incoming] файлы не удалены", removeError.message);
    else removed += chunk.length;
  }
  return removed;
}
