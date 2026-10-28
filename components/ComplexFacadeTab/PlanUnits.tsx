"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { CONTOUR_POINTS, slotKey, type Point, type UnitContour } from "@/lib/admin/facade/contours";
import type { FacadeActions, FacadeBlock, FacadePlan } from "@/lib/admin/facade/types";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import { ContourEditor } from "./ContourEditor";
import { ContourTools } from "./ContourTools";

type PlanUnitsProps = { block: FacadeBlock; plan: FacadePlan; actions: FacadeActions; onChanged: () => void };

/**
 * Квартиры плана: места на этаже из списка квартир (у плана подъезда — только его места); выбрать
 * место → обвести квартиру на плане; «Сохранить контуры квартир» — все сразу. На сайте контур
 * встаёт на квартиру с тем же подъездом и позицией на каждом этаже плана.
 */
export function PlanUnits({ block, plan, actions, onChanged }: PlanUnitsProps) {
  const t = useTranslations("admin.complexes.facade");
  const tErrors = useTranslations("admin.developers.errors");
  const slots = block.slots.filter((slot) => plan.entrance === null || slot.entrance === plan.entrance);
  const [contours, setContours] = useState<Record<string, Point[]>>(() =>
    Object.fromEntries(plan.contours.map((item) => [slotKey(item.entrance, item.position), item.points])),
  );
  const [active, setActive] = useState(slots[0] ? slotKey(slots[0].entrance, slots[0].position) : null);
  const [result, setResult] = useState<{ error: ContentErrorCode | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const incomplete = slots.filter((slot) => {
    const count = contours[slotKey(slot.entrance, slot.position)]?.length ?? 0;
    return count > 0 && count < CONTOUR_POINTS.min;
  }).length;
  const done = slots.filter((slot) => (contours[slotKey(slot.entrance, slot.position)]?.length ?? 0) >= CONTOUR_POINTS.min);
  const save = () =>
    startTransition(async () => {
      const list: UnitContour[] = done.map((slot) => ({ ...slot, points: contours[slotKey(slot.entrance, slot.position)]! }));
      const answer = await actions.setPlanContours(plan.id, plan.entrance, list);
      setResult({ error: answer.status === "error" ? answer.error : null });
      if (answer.status === "done") onChanged();
    });
  if (!active) return <p className="field__meta">{t("noUnits")}</p>;
  const others = done
    .filter((slot) => slotKey(slot.entrance, slot.position) !== active)
    .map((slot) => ({ key: slotKey(slot.entrance, slot.position), label: `${slot.entrance}·${slot.position}`, points: contours[slotKey(slot.entrance, slot.position)]! }));
  return (
    <div className="facade-tab__units">
      <p className="field__meta">{t("contoursCount", { done: done.length, total: slots.length })}</p>
      <SlotPills slots={slots} contours={contours} active={active} onChoose={setActive} />
      <ContourEditor image={plan.image} alt={t("image")} others={others} value={contours[active] ?? []} onChange={(points) => setContours({ ...contours, [active]: points })} />
      <ContourTools points={contours[active] ?? []} onChange={(points) => setContours({ ...contours, [active]: points })}>
        <Button size="sm" pending={pending} onClick={save}>
          {t("saveUnits")}
        </Button>
      </ContourTools>
      {/* Под редактором: над ним строка сдвигала бы картинку посреди обводки. */}
      {incomplete > 0 ? <FormStatus tone="notice">{t("unitsIncomplete", { count: incomplete })}</FormStatus> : null}
      {result ? <FormStatus tone={result.error ? "error" : "success"}>{result.error ? tErrors(result.error) : t("saved")}</FormStatus> : null}
    </div>
  );
}

type Slot = { entrance: number; position: number };

function SlotPills({ slots, contours, active, onChoose }: { slots: Slot[]; contours: Record<string, Point[]>; active: string; onChoose: (key: string) => void }) {
  const t = useTranslations("admin.complexes.facade");
  return (
    <div className="facade-tab__pills" role="group" aria-label={t("units")}>
      {slots.map((slot) => {
        const key = slotKey(slot.entrance, slot.position);
        return (
          <button key={key} type="button" className="facade-tab__pill" aria-pressed={key === active} onClick={() => onChoose(key)}>
            {t("unitSlot", { entrance: slot.entrance, position: slot.position })}
            <small>{(contours[key]?.length ?? 0) >= CONTOUR_POINTS.min ? t("unitDone") : t("unitTodo")}</small>
          </button>
        );
      })}
    </div>
  );
}
