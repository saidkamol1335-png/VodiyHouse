import { ComplexUnitsTab } from "@/components/ComplexUnitsTab";
import { UnitsScreenSwitch } from "@/components/UnitsScreenSwitch";
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
import {
  revertUnitsStatusAction,
  setLayoutAvailableAction,
  setUnitsStatusAction,
} from "@/lib/admin/actions/unitsStatus";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { complexForTab, getComplexCompleteness } from "@/lib/admin/server/complexPage";
import { readUnitsTab } from "@/lib/admin/server/unitsTab";
import { requireViewer } from "@/lib/admin/session";
import { unitsActionsFor } from "@/lib/admin/units/access";
import type { UnitsTabActions } from "@/lib/admin/units/types";
import { unitsTabView } from "@/lib/admin/units/view";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type ComplexUnitsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blok?: string | string[] }>;
};

// Права — наличием действий: роли отдаётся только её часть (unitsActionsFor, Н2).
const ACTIONS: UnitsTabActions = {
  list: {
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
  },
  create: createBlockUnitsAction,
  saveRisers: saveRisersAction,
  layoutAvailable: setLayoutAvailableAction,
};

/** Экран «Квартиры» (экран 4, PLAN §10 п. 22): блок из ?blok=, генератор или стояки и список. */
export default async function ComplexUnitsPage({ params, searchParams }: ComplexUnitsPageProps) {
  const complex = await complexForTab(params, "units");
  if (!complex) return null;
  const [{ blok }, viewer] = await Promise.all([searchParams, requireViewer()]);
  const supabase = await createSupabaseServerClient();
  const [tab, completeness] = await Promise.all([
    readUnitsTab(supabase, complex.id, typeof blok === "string" ? blok : null),
    getComplexCompleteness(complex.id),
  ]);
  // «На сайте» и «Только неполные» (экран 4): чертёж планировки знает только база.
  const noDrawing = new Set(
    (completeness?.layouts ?? []).filter((layout) => layout.missing.includes("drawing")).map((layout) => layout.id),
  );
  const layouts = tab.layouts.map((layout) => ({ ...layout, drawingMissing: noDrawing.has(layout.id) }));
  const base = `${ADMIN_ROUTES.complexes}/${complex.id}`;
  return (
    <>
      <UnitsScreenSwitch base={base} />
      <ComplexUnitsTab
      view={unitsTabView({ ...tab, layouts })}
      tabHref={complexTabHref(base, "units")}
      blocksHref={complexTabHref(base, "blocks")}
      layoutsHref={complexTabHref(base, "layouts")}
      published={complex.status === "published"}
      actions={unitsActionsFor(viewer.role, ACTIONS)}
      viewerName={viewer.name}
    />
    </>
  );
}
