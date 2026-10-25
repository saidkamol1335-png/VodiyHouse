import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
};
