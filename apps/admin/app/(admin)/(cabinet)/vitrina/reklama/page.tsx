import { ShowcaseList } from "@/components/ShowcaseList";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { readShowcaseList, showcaseOpen } from "@/lib/admin/server/showcasePage";
import { todayInTashkent } from "@/lib/admin/showcase/period";

export const instant = false;

/** Вкладка «Реклама» (3.16а, Г1 A): очередь на одно место главной — по порядку. */
export default async function ShowcaseAdsPage() {
  if (!(await showcaseOpen())) return null;
  const rows = await readShowcaseList("ad");
  return <ShowcaseList kind="ad" rows={rows} base={ADMIN_ROUTES.showcase} today={todayInTashkent()} />;
}
