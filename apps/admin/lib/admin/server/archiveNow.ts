import "server-only";
import { removeComplexFiles } from "@/lib/archive/server/purge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Файлы ЖК после «Удалить сейчас» (фаза D, п. 24): строки уже удалила база по праву руководителя,
 * папки в Storage чистит секретный ключ. Вызывать только после проверки руководителя (fresh).
 */
export async function removeDeletedComplexFiles(complexId: string, media: string[]): Promise<void> {
  await removeComplexFiles(createSupabaseAdminClient(), complexId, media);
}
