import { connection } from "next/server";
import { ShowcaseList } from "@/components/ShowcaseList";
import { demoCollectionRows } from "@/lib/admin/showcase/demo";
import { todayInTashkent } from "@/lib/admin/showcase/period";
import { DEV_SHOWCASE_BASE } from "../base";

export const instant = false;

/** Стенд «Подборки» (3.16а) на DEMO мокапа. */
export default async function DevCollectionsPage() {
  await connection();
  const rows = demoCollectionRows().map((row) => ({ ...row, coverSrc: null }));
  return <ShowcaseList kind="collection" rows={rows} base={DEV_SHOWCASE_BASE} today={todayInTashkent()} />;
}
