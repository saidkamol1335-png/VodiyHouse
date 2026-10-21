import { ComplexUnitsTab } from "@/components/ComplexUnitsTab";
import { createBlockUnitsAction, saveRisersAction } from "@/lib/admin/actions/units";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readUnitsTab } from "@/lib/admin/server/unitsTab";
import { unitsTabView } from "@/lib/admin/units/view";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type ComplexUnitsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blok?: string | string[] }>;
};

/** Вкладка «Квартиры» (шаг 12): блок из ?blok=, генератор или стояки; список — 12.4. */
export default async function ComplexUnitsPage({ params, searchParams }: ComplexUnitsPageProps) {
  const complex = await complexForTab(params);
  if (!complex) return null;
  const { blok } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const tab = await readUnitsTab(supabase, complex.id, typeof blok === "string" ? blok : null);
  const base = `${ADMIN_ROUTES.complexes}/${complex.id}`;
  return (
    <ComplexUnitsTab
      view={unitsTabView(tab)}
      tabHref={complexTabHref(base, "units")}
      blocksHref={complexTabHref(base, "blocks")}
      layoutsHref={complexTabHref(base, "layouts")}
      published={complex.status === "published"}
      createAction={createBlockUnitsAction}
      saveRisersAction={saveRisersAction}
    />
  );
}
