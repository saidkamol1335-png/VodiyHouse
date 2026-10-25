import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteNowFrom, type SiteNow } from "../home/siteNow";

// «Сейчас на сайте» сессией сотрудника: site_now() сама проверяет роль (руководитель, менеджер).
export async function readSiteNow(supabase: SupabaseClient): Promise<SiteNow> {
  const { data, error } = await supabase.rpc("site_now");
  if (error) throw new Error("site-now-unavailable", { cause: error });
  return siteNowFrom(data);
}
