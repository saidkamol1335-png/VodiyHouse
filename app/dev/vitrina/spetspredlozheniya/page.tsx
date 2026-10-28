import { connection } from "next/server";
import { ShowcaseList } from "@/components/ShowcaseList";
import { demoSpecialRows } from "@/lib/admin/showcase/demo";
import { todayInTashkent } from "@/lib/admin/showcase/period";
import { DEV_SHOWCASE_BASE } from "../base";

export const instant = false;

/** Стенд «Спецпредложения» (3.16а) на DEMO: те же компоненты, что у /admin/vitrina. */
export default async function DevSpecialsPage() {
  // Периоды DEMO считаются от сегодняшнего дня — страница живёт на запросе, не в пререндере.
  await connection();
  const rows = demoSpecialRows().map((row) => ({ ...row, coverSrc: null }));
  return <ShowcaseList kind="special" rows={rows} base={DEV_SHOWCASE_BASE} today={todayInTashkent()} />;
}
