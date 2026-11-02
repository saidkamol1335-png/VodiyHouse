import { ShowcaseList } from "@/components/ShowcaseList";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { readShowcaseList, showcaseOpen } from "@/lib/admin/server/showcasePage";
import { todayInTashkent } from "@/lib/admin/showcase/period";

export const instant = false;

/** Вкладка «Подборки» (3.16а). */
export default async function ShowcaseCollectionsPage() {
  if (!(await showcaseOpen())) return null;
  const rows = await readShowcaseList("collection");
  return <ShowcaseList kind="collection" rows={rows} base={ADMIN_ROUTES.showcase} today={todayInTashkent()} />;
}
