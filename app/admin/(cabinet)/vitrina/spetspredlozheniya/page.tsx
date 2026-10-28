import { ShowcaseList } from "@/components/ShowcaseList";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { readShowcaseList, showcaseOpen } from "@/lib/admin/server/showcasePage";
import { todayInTashkent } from "@/lib/admin/showcase/period";

export const instant = false;

/** Вкладка «Спецпредложения» (3.16а). */
export default async function ShowcaseSpecialsPage() {
  if (!(await showcaseOpen())) return null;
  const rows = await readShowcaseList("special");
  return <ShowcaseList kind="special" rows={rows} base={ADMIN_ROUTES.showcase} today={todayInTashkent()} />;
}
