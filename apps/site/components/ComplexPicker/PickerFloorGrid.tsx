"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatArea } from "@vh/shared/format";
import type { Locale } from "@/lib/i18n/routing";
import { entranceGroups } from "@/lib/site/picker/model";
import type { PickerUnit } from "@/lib/site/picker/records";
import { useUnitTexts } from "./unitTexts";

type PickerFloorGridProps = {
  units: readonly PickerUnit[];
  selected: string | null;
  onPick: (unit: PickerUnit) => void;
};

/**
 * Этаж без картинки плана (правки 15.11, п. 19: «как в прототипе»): квартиры этажа по подъездам —
 * плитки по порядку стояков с номером, комнатами, площадью и ценой свободной; цвет — статус. Нажатие —
 * как на плане: свободная открывает квартиру, бронь и продана — подсказка. Шахматки нет: только один
 * выбранный этаж.
 */
export function PickerFloorGrid({ units, selected, onPick }: PickerFloorGridProps) {
  const t = useTranslations("complex.pick");
  const groups = entranceGroups(units);
  return (
    <div className="complex-picker__grid">
      {groups.map((group) => (
        <section key={group.entrance} className="complex-picker__cells-group" aria-label={t("entrance", { n: group.entrance })}>
          {groups.length > 1 ? <p className="complex-picker__label">{t("entrance", { n: group.entrance })}</p> : null}
          <ul className="complex-picker__cells">
            {group.units.map((unit) => (
              <li key={unit.id}>
                <GridCell unit={unit} selected={unit.id === selected} onPick={() => onPick(unit)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function GridCell({ unit, selected, onPick }: { unit: PickerUnit; selected: boolean; onPick: () => void }) {
  const locale = useLocale() as Locale;
  const texts = useUnitTexts(unit);
  return (
    <button
      type="button"
      className={`complex-picker__cell complex-picker__cell--${unit.status}${selected ? " complex-picker__cell--selected" : ""}`}
      aria-pressed={unit.status === "free" ? selected : undefined}
      data-unit-id={unit.id}
      aria-label={texts.aria}
      onClick={onPick}
    >
      <span className="complex-picker__cell-number">№{unit.number}</span>
      <span className="complex-picker__cell-meta">{[texts.roomsShort, unit.area !== null ? formatArea(unit.area, locale) : null].filter(Boolean).join(" · ")}</span>
      <span className="complex-picker__cell-price">{unit.status === "free" ? texts.price : texts.tag}</span>
    </button>
  );
}
