import { ComplexFacadeTab } from "@/components/ComplexFacadeTab";
import {
  deleteFloorPlanAction,
  removeComplexFacadeAction,
  saveFloorPlanAction,
  setBlockContourAction,
  setComplexFacadeAction,
  setFloorPlanContoursAction,
} from "@/lib/admin/actions/complexFacade";
import type { FacadeActions } from "@/lib/admin/facade/types";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readComplexFacade } from "@/lib/admin/server/complexFacade";
import { mediaSrc } from "@/lib/admin/server/developerPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

const FACADE_ACTIONS: FacadeActions = {
  setFacade: setComplexFacadeAction,
  removeFacade: removeComplexFacadeAction,
  setBlockContour: setBlockContourAction,
  savePlan: saveFloorPlanAction,
  setPlanContours: setFloorPlanContoursAction,
  deletePlan: deleteFloorPlanAction,
};

/** Вкладка «Фасад и планы» (фаза 4): раздел «Выбрать квартиру» на странице ЖК; сохраняется сразу. */
export default async function ComplexFacadePage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "facade");
  if (!complex) return null;
  const data = await readComplexFacade(await createSupabaseServerClient(), complex.id, mediaSrc);
  return (
    <ComplexFacadeTab key={complex.id} complexId={complex.id} published={complex.status === "published"} data={data} actions={FACADE_ACTIONS} />
  );
}
