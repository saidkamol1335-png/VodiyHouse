import { ComplexUnitsTab } from "@/components/ComplexUnitsTab";
import {
  addUnitAction,
  createBlockUnitsAction,
  deleteBlockUnitsAction,
  saveRisersAction,
  updateUnitAction,
} from "@/lib/admin/actions/units";
import {
  deleteUnitsAction,
  setUnitsFinishingAction,
  setUnitsPriceAction,
} from "@/lib/admin/actions/unitsMass";
import { readBlockUnitsAction } from "@/lib/admin/actions/unitsList";
import { revertUnitsStatusAction, setUnitsStatusAction } from "@/lib/admin/actions/unitsStatus";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readUnitsTab } from "@/lib/admin/server/unitsTab";
import { requireViewer } from "@/lib/admin/session";
import { unitsTabView } from "@/lib/admin/units/view";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type ComplexUnitsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blok?: string | string[] }>;
};

// Права — наличием действия: менеджеру (12.6) edit не передаётся.
const LIST_ACTIONS = {
  read: readBlockUnitsAction,
  status: { set: setUnitsStatusAction, revert: revertUnitsStatusAction },
  edit: {
    add: addUnitAction,
    update: updateUnitAction,
    remove: deleteUnitsAction,
    removeList: deleteBlockUnitsAction,
    price: setUnitsPriceAction,
    finishing: setUnitsFinishingAction,
  },
};

/** Вкладка «Квартиры» (шаг 12): блок из ?blok=, генератор или стояки и список (читает экран). */
export default async function ComplexUnitsPage({ params, searchParams }: ComplexUnitsPageProps) {
  const complex = await complexForTab(params);
  if (!complex) return null;
  const [{ blok }, viewer] = await Promise.all([searchParams, requireViewer()]);
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
      listActions={LIST_ACTIONS}
      viewerName={viewer.name}
    />
  );
}
