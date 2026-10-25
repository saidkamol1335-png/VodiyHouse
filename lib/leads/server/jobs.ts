import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { alertUndelivered, deliverDue } from "./deliver";

// Работы расписания (/api/cron/<работа>): адрес проверил секрет CRON_SECRET, дальше — секретный
// ключ базы (очередь доставки открыта только серверу).

export type CronJob = () => Promise<Record<string, number>>;

export const CRON_JOBS: Record<string, CronJob> = {
  // Повтор доставки заявок и тревога «не дошла за 10 минут» (ТЗ 10.4).
  leads: async () => {
    const admin = createSupabaseAdminClient();
    const delivered = await deliverDue(admin);
    const alerted = await alertUndelivered(admin);
    return { delivered, alerted };
  },
  // Коды «Написать в Telegram» (Ф8): неоткрытые — через 2 дня, остальные — через 30.
  "tg-starts": async () => {
    const { data, error } = await createSupabaseAdminClient().rpc("cleanup_tg_starts");
    if (error) throw new Error("tg-starts-cleanup-failed", { cause: error });
    return { removed: Number(data ?? 0) };
  },
};
