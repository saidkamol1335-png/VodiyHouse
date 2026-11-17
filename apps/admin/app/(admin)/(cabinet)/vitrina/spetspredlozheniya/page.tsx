import { DiscountsPanel } from "@/components/DiscountsPanel";
import { ShowcaseList } from "@/components/ShowcaseList";
import { setDiscountsAction } from "@/lib/admin/actions/discounts";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { readDiscountSettings } from "@/lib/admin/server/discounts";
import { readShowcaseList, showcaseOpen } from "@/lib/admin/server/showcasePage";
import { todayInTashkent } from "@/lib/admin/showcase/period";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Спецпредложения» (3.16а); сверху — «Скидки на сайте» (правки 15.11, п. 4 + 21). */
export default async function ShowcaseSpecialsPage() {
  if (!(await showcaseOpen())) return null;
  const [rows, discounts] = await Promise.all([
    readShowcaseList("special"),
    readDiscountSettings(await createSupabaseServerClient()),
  ]);
  return (
    <>
      <DiscountsPanel enabled={discounts.enabled} action={setDiscountsAction} />
      <ShowcaseList kind="special" rows={rows} base={ADMIN_ROUTES.showcase} today={todayInTashkent()} />
    </>
  );
}
