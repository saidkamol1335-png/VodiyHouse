// Массовые правки руководителя (12.5, Н3–Н4): цена, отделка, «Удалить» выделенные и «Удалить
// список блока». Исполнитель запроса, полоса и перечитывание — общие с правкой строки
// (useUnitsEdit, runEdit); здесь — что отправить и что записать в список после ответа.

import type { UnitFieldsPatch, UnitRecord } from "@/lib/units";
import type { UnitsListEvent } from "./listState";
import { priceFields } from "./priceForm";
import { statusSubject } from "./statusOutcome";
import type { Context, Run, UnitsEditControl } from "./useUnitsEdit";

const stampNow = (viewerName: string | null) => ({ at: new Date().toISOString(), by: viewerName });
const idsOf = (units: readonly UnitRecord[]) => new Set(units.map((unit) => unit.id));

/** Поля массовой правки — в прочитанный список: отметка «кто и когда» — у поменявшихся. */
const patched = (
  units: readonly UnitRecord[],
  fields: UnitFieldsPatch,
  { params }: Context,
): UnitsListEvent => ({
  type: "unitsPatched",
  ids: idsOf(units),
  fields,
  stamp: stampNow(params.viewerName),
});

/** Массовые цена и отделка: поля — в список, итог — в полосу. */
export function fieldEdits(run: Run): Pick<UnitsEditControl, "setPrice" | "setFinishing"> {
  return {
    setPrice: (units, change, shown) =>
      run(
        { what: "price", subject: statusSubject(units), shown },
        ({ params }) =>
          params.actions.price?.({
            blockId: params.blockId,
            unitIds: [...idsOf(units)],
            ...change,
          }) ?? null,
        (done, context) => ({
          event: patched(units, priceFields(change), context),
          message: {
            kind: "priced",
            subject: statusSubject(units),
            changed: done.changed,
            withoutLayout: done.withoutLayout,
            none: change.mode === "none",
          },
        }),
      ),
    setFinishing: (units, finishingId, shown) =>
      run(
        { what: "finishing", subject: statusSubject(units), shown },
        ({ params }) =>
          params.actions.finishing?.({
            blockId: params.blockId,
            unitIds: [...idsOf(units)],
            finishingId,
          }) ?? null,
        (done, context) => ({
          event: patched(units, { finishingId }, context),
          message: { kind: "finished", subject: statusSubject(units), changed: done.changed },
        }),
      ),
  };
}

/** «Удалить» выделенные и «Удалить список блока» (после него — уведомление над генератором). */
export function removeEdits(
  run: Run,
  removedHere: Set<string>,
): Pick<UnitsEditControl, "removeUnits" | "removeList"> {
  return {
    removeUnits: (units, shown) =>
      run(
        { what: "remove", subject: statusSubject(units), shown },
        ({ params }) =>
          params.actions.remove?.({ blockId: params.blockId, unitIds: [...idsOf(units)] }) ?? null,
        (done) => {
          for (const unit of units) removedHere.add(unit.id);
          return {
            event: { type: "unitsRemoved", ids: idsOf(units) },
            message: { kind: "deleted", count: done.deleted },
          };
        },
      ),
    removeList: (confirm, shown) =>
      run(
        { what: "removeList", subject: { number: null, count: 0 }, shown },
        ({ params }) => params.actions.removeList?.({ blockId: params.blockId, confirm }) ?? null,
        (done, { params }) => {
          params.onListRemoved(done.deleted);
          return {};
        },
      ),
  };
}
