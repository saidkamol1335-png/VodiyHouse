"use server";

import { demoSiteStockRead, siteStockScenario } from "@/lib/admin/home/demo";
import type { SiteStockResult } from "@/lib/admin/home/siteStock";

// Перечитывание «Остатков по ЖК» на стенде /dev/glavnaya: DEMO не меняется — что «пришло» при
// следующем чтении, решает сценарий (?demo=…, привязан через .bind).

function devOnly() {
  if (process.env.NODE_ENV === "production") throw new Error("Стенд только для разработки");
}

export async function demoReadSiteStockAction(scenario: unknown): Promise<SiteStockResult> {
  devOnly();
  return demoSiteStockRead(siteStockScenario(scenario));
}
