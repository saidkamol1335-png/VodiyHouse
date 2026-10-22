import { ComplexLayoutsForm } from "@/components/ComplexLayoutsForm";
import { saveBlockLayoutsAction } from "@/lib/admin/actions/complexes";
import { attachComplexDrawingAction } from "@/lib/admin/actions/complexMedia";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readBlockLayouts } from "@/lib/admin/server/complexTabs";
import { mediaSrc } from "@/lib/admin/server/developerPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Планировки» (И5): строки выбранного блока, чертежи — PNG на белом. */
export default async function ComplexLayoutsPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "layouts");
  if (!complex) return null;
  const blocks = await readBlockLayouts(await createSupabaseServerClient(), complex.id, mediaSrc);
  return (
    <ComplexLayoutsForm
      key={complex.id}
      complexId={complex.id}
      published={complex.status === "published"}
      blocks={blocks}
      action={saveBlockLayoutsAction}
      attach={attachComplexDrawingAction}
      blocksHref={complexTabHref(`${ADMIN_ROUTES.complexes}/${complex.id}`, "blocks")}
    />
  );
}
