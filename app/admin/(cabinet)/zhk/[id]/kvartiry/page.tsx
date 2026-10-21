import { ComplexUnitsSummary } from "@/components/ComplexUnitsSummary";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readBlockUnitLines } from "@/lib/admin/server/complexTabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Квартиры»: генератор, стояки и список — шаг 12; пока — сводка по блокам. */
export default async function ComplexUnitsPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params);
  if (!complex) return null;
  const blocks = await readBlockUnitLines(await createSupabaseServerClient(), complex.id);
  const base = `${ADMIN_ROUTES.complexes}/${complex.id}`;
  return (
    <ComplexUnitsSummary
      blocks={blocks}
      blocksHref={complexTabHref(base, "blocks")}
      layoutsHref={complexTabHref(base, "layouts")}
    />
  );
}
