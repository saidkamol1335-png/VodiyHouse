import { HouseAdPanel } from "@/components/HouseAdPanel";
import { ShowcaseList } from "@/components/ShowcaseList";
import { setHouseAdAction } from "@/lib/admin/actions/houseAd";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { readHouseAdSettings } from "@/lib/admin/server/houseAd";
import { readShowcaseList, showcaseOpen } from "@/lib/admin/server/showcasePage";
import { byAdOrder, showcaseStatus, todayInTashkent } from "@/lib/admin/showcase/period";
import { siteOrigin } from "@/lib/site/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/**
 * Вкладка «Реклама» (3.16а, Г1 A): очередь на одно место главной — по порядку. Сверху (06.11.2026) —
 * своя реклама Vodiy House: место не пустует, пока у застройщиков нет действующей; её можно выключить.
 */
export default async function ShowcaseAdsPage() {
  if (!(await showcaseOpen())) return null;
  const today = todayInTashkent();
  const [rows, house] = await Promise.all([
    readShowcaseList("ad"),
    readHouseAdSettings(await createSupabaseServerClient()),
  ]);
  // Первая действующая по порядку — она на главной (как adView на сайте, без проверки ЖК каталога).
  const active = rows
    .filter((row) => showcaseStatus(row, today) === "active")
    .map((row) => ({ ...row, validFrom: row.validFrom ?? "", validTo: row.validTo ?? "" }))
    .sort(byAdOrder)[0];
  return (
    <>
      <HouseAdPanel
        enabled={house.enabled}
        activeAd={active?.title ?? null}
        siteHref={`${siteOrigin()}/ru#reklama`}
        action={setHouseAdAction}
      />
      <ShowcaseList kind="ad" rows={rows} base={ADMIN_ROUTES.showcase} today={today} />
    </>
  );
}
