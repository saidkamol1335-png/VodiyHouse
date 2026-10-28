"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import type { FloorCount, EntranceCount } from "@/lib/site/picker/model";
import { useBlockLabels } from "./blockLabels";
import type { PickerBlockView } from "./ComplexPicker";
import { PickerFloorPlan } from "./PickerFloorPlan";
import type { PickerChoice } from "./usePickerChoice";

type PickerPlanProps = {
  block: PickerBlockView;
  choice: PickerChoice;
  failed: boolean;
  onRetry: () => void;
};

const STATUSES = ["free", "reserved", "sold"] as const;

/**
 * План (мокап .vis__plan / MobJkFloor): «Все корпуса» и блок, легенда; этажи сверху вниз с числом
 * свободных; подъезды — переключателем; план этажа с квартирами по статусам.
 */
export function PickerPlan({ block, choice, failed, onRetry }: PickerPlanProps) {
  const t = useTranslations("complex.pick");
  const labels = useBlockLabels();
  const backButton = useRef<HTMLButtonElement>(null);
  // Блок открыт с клавиатуры или касанием — фокус на «Все корпуса»: фасада, где он был, больше нет.
  useEffect(() => backButton.current?.focus({ preventScroll: true }), []);
  return (
    <div className="complex-picker__plan">
      <div className="complex-picker__plan-head">
        <Button ref={backButton} variant="outline" size="sm" onClick={choice.back}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t("back")}
        </Button>
        <p className="complex-picker__plan-block">
          <b>{labels.name(block)}</b>
          <small>{labels.status(block)}</small>
        </p>
        <Legend />
      </div>
      <PlanBody blockName={labels.name(block)} choice={choice} failed={failed} onRetry={onRetry} />
    </div>
  );
}

function PlanBody({ blockName, choice, failed, onRetry }: { blockName: string; choice: PickerChoice; failed: boolean; onRetry: () => void }) {
  const t = useTranslations("complex.pick");
  if (failed && choice.loading) {
    return (
      <p className="complex-picker__status" role="status">
        {t("failed")}{" "}
        <button type="button" className="complex-picker__retry" onClick={onRetry}>
          {t("retry")}
        </button>
      </p>
    );
  }
  if (choice.loading) {
    return (
      <p className="complex-picker__status" role="status">
        {t("loading")}
      </p>
    );
  }
  return (
    <div className="complex-picker__plan-body">
      <Floors floors={choice.floors} floor={choice.floor} onFloor={choice.pickFloor} />
      <div className="complex-picker__plan-main">
        <Entrances entrances={choice.entrances} entrance={choice.entrance} onEntrance={choice.pickEntrance} />
        {choice.plan && choice.floor !== null ? (
          <PickerFloorPlan
            key={`${choice.plan.id}-${choice.floor}`}
            plan={choice.plan}
            floor={choice.floor}
            blockName={blockName}
            units={choice.units}
            selected={choice.unit?.id ?? null}
            onUnit={choice.pickUnit}
          />
        ) : null}
      </div>
    </div>
  );
}

function Legend() {
  const t = useTranslations("complex.pick.legend");
  return (
    <ul className="complex-picker__legend">
      {STATUSES.map((status) => (
        <li key={status}>
          <i className={`complex-picker__swatch complex-picker__swatch--${status}`} aria-hidden="true" />
          {t(status)}
        </li>
      ))}
    </ul>
  );
}

function Floors({ floors, floor, onFloor }: { floors: FloorCount[]; floor: number | null; onFloor: (floor: number) => void }) {
  const t = useTranslations("complex.pick");
  return (
    <div className="complex-picker__floors-wrap">
      <p className="complex-picker__label">{t("floor")}</p>
      <ul className="complex-picker__floors">
        {floors.map((item) => (
          <li key={item.floor}>
            <button
              type="button"
              className={item.free === 0 ? "complex-picker__floor complex-picker__floor--none" : "complex-picker__floor"}
              aria-pressed={item.floor === floor}
              aria-label={t("floorAria", { floor: item.floor, count: item.free })}
              onClick={() => onFloor(item.floor)}
            >
              <b>{item.floor}</b>
              <span>{t("floorFree", { count: item.free })}</span>
              <i aria-hidden="true">
                <em style={{ transform: `scaleX(${item.total ? item.free / item.total : 0})` }} />
              </i>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Entrances({ entrances, entrance, onEntrance }: { entrances: EntranceCount[]; entrance: number | null; onEntrance: (entrance: number | null) => void }) {
  const t = useTranslations("complex.pick");
  if (entrances.length < 2) return null;
  return (
    <div className="complex-picker__entrances" role="group" aria-label={t("entrances")}>
      {entrances.map((item) => (
        <button key={item.entrance ?? 0} type="button" className="complex-picker__entrance" aria-pressed={item.entrance === entrance} onClick={() => onEntrance(item.entrance)}>
          {t("entrance", { n: item.entrance ?? "" })}
          <small>{t("floorFree", { count: item.free })}</small>
        </button>
      ))}
    </div>
  );
}
