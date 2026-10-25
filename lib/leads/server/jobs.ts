import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { purgeArchive, remindArchive } from "@/lib/archive/server/purge";
import { alertUndelivered, deliverDue } from "./deliver";

// Работы расписания (/api/cron/<работа>): адрес проверил секрет CRON_SECRET, дальше — секретный
// ключ базы (очередь доставки открыта только серверу).

export type CronJob = () => Promise<Record<string, number>>;

export const CRON_JOBS: Record<string, CronJob> = {
  // Тревога «не дошла за 10 минут» (ТЗ 10.4) — первой: долгая очередь повторов её не задержит.
  leads: async () => {
    const admin = createSupabaseAdminClient();
    const alerted = await alertUndelivered(admin);
    const delivered = await deliverDue(admin);
    return { delivered, alerted };
  },
  // Коды «Написать в Telegram» (Ф8): неоткрытые — через 7 дней, остальные — через 30.
  "tg-starts": async () => {
    const { data, error } = await createSupabaseAdminClient().rpc("cleanup_tg_starts");
    if (error) throw new Error("tg-starts-cleanup-failed", { cause: error });
    return { removed: Number(data ?? 0) };
  },
  // Архив (3.13): напоминание за 3 дня и окончательное удаление через 30 дней — раз в сутки.
  archive: async () => {
    const admin = createSupabaseAdminClient();
    const reminded = await remindArchive(admin);
    const purged = await purgeArchive(admin);
    return { reminded, purged };
  },
  // События сайта (3.12): старше 400 дней.
  events: async () => {
    const { data, error } = await createSupabaseAdminClient().rpc("cleanup_events");
    if (error) throw new Error("events-cleanup-failed", { cause: error });
    return { removed: Number(data ?? 0) };
  },
};
