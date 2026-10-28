import { connection } from "next/server";
import { ShowcaseList } from "@/components/ShowcaseList";
import { demoAdRows } from "@/lib/admin/showcase/demo";
import { todayInTashkent } from "@/lib/admin/showcase/period";
import { DEV_SHOWCASE_BASE } from "../base";

export const instant = false;

/** Стенд «Реклама» (3.16а): две записи с пересечением периодов — предупреждение очереди (Г1 A). */
export default async function DevAdsPage() {
  await connection();
  const rows = demoAdRows().map((row) => ({ ...row, coverSrc: null }));
  return <ShowcaseList kind="ad" rows={rows} base={DEV_SHOWCASE_BASE} today={todayInTashkent()} />;
}
