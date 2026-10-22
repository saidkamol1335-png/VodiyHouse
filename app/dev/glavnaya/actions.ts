"use server";

import { devOnly } from "../devOnly";
import { demoSiteStockRead, siteStockScenario } from "@/lib/admin/home/demo";
import type { SiteStockResult } from "@/lib/admin/home/siteStock";

// Перечитывание «Остатков по ЖК» на стенде /dev/glavnaya: DEMO не меняется — что «пришло» при
// следующем чтении, решает сценарий (?demo=…, привязан через .bind).

export async function demoReadSiteStockAction(scenario: unknown): Promise<SiteStockResult> {
  devOnly();
  return demoSiteStockRead(siteStockScenario(scenario));
}
