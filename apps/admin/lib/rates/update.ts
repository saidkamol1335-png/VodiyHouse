import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCbuUsdRate } from "./cbu";

// Курс ЦБ по расписанию (шаг 3.2): /api/cron/rate раз в сутки. Сбой ЦБ или базы — ошибка в логе
// функции, на сайте остаётся прежний курс; прежний же курс видит и руководитель в «Программах».

/** Курс ЦБ в базу (set_cbu_exchange_rate, ключ сервера); true — курс изменился. */
export async function updateCbuRate(admin: SupabaseClient, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const rate = await fetchCbuUsdRate(fetchImpl);
  const { data, error } = await admin.rpc("set_cbu_exchange_rate", { p_rate: rate.usdUzs, p_date: rate.date });
  if (error) throw new Error("rate-update-failed", { cause: error });
  return data === true;
}
