"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { UnitsFilters } from "@/components/UnitsFilters";
import { UnitsRow } from "@/components/UnitsRow";
import { UNITS_LIST_COLUMNS } from "@/lib/admin/units/columns";
import type { UnitRowContext } from "@/lib/admin/units/rowView";
import { UNITS_PAGE_SIZE } from "@/lib/admin/units/statusOutcome";
import { EMPTY_UNIT_FILTER, type UnitRecord, type UnitStatus } from "@/lib/units";
import { useUnitsListView } from "./useUnitsListView";

type UnitsListProps = {
  /** Название блока («A») — для подписи таблицы диктору. */
  blockName: string;
  /** Прочитанное с правками, которые ещё сохраняются. */
  units: readonly UnitRecord[];
  /** Квартиры, которым сменили статус, — не пропадают из-под фильтра статуса до его смены. */
  sticky: ReadonlySet<string>;
  rowContext: UnitRowContext;
  onFilterChange: () => void;
  /** null — менять статус нельзя. */
  onStatus: ((unit: UnitRecord, to: UnitStatus) => void) | null;
};

/** Список квартир блока (Н1): фильтры, таблица (в узком контейнере — карточки) порциями по 200. */
export function UnitsList({ blockName, units, sticky, rowContext, ...props }: UnitsListProps) {
  const t = useTranslations("admin.complexes.units.list");
  const view = useUnitsListView({
    units,
    sticky,
    rooms: rowContext.rooms,
    onFilterChange: props.onFilterChange,
  });
  return (
    <div className="units-list">
      <UnitsFilters
        filter={view.filter}
        counts={view.counts}
        options={view.options}
        onChange={view.changeFilter}
      />
      <p className="units-list__summary" aria-live="polite" aria-busy={view.busy}>
        {t("shown", { shown: view.shown.length, total: view.visible.length })}
      </p>
      {view.visible.length === 0 ? (
        <NothingFound onReset={() => view.changeFilter(EMPTY_UNIT_FILTER)} />
      ) : (
        <UnitsTable
          blockName={blockName}
          units={view.shown}
          rowContext={rowContext}
          openId={view.openId}
          onToggle={view.toggle}
          onStatus={props.onStatus}
        />
      )}
      <ShowMore left={view.visible.length - view.limit} onClick={view.showMore} />
    </div>
  );
}

/** Фильтр ничего не нашёл — «Сбросить фильтры». */
function NothingFound({ onReset }: { onReset: () => void }) {
  const t = useTranslations("admin.complexes.units.list");
  return (
    <p className="units-list__empty">
      {t("nothingFound")}{" "}
      <button type="button" className="units-list__reset" onClick={onReset}>
        {t("reset")}
      </button>
    </p>
  );
}

/** «Показать ещё 200»: фокус — на первую новую строку, а не на body, когда кнопка исчезнет. */
function ShowMore({ left, onClick }: { left: number; onClick: () => void }) {
  const t = useTranslations("admin.complexes.units.list");
  const anchor = useRef<HTMLDivElement>(null);
  const firstNew = useRef<number | null>(null);
  useEffect(() => {
    if (firstNew.current === null) return;
    const list = anchor.current?.closest(".units-list");
    const buttons = list?.querySelectorAll<HTMLElement>(".units-row__status-button");
    buttons?.[firstNew.current]?.focus();
    firstNew.current = null;
  });
  return (
    <div ref={anchor} className="units-list__more">
      {left > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            firstNew.current =
              anchor.current?.closest(".units-list")?.querySelectorAll(".units-row__status-button")
                .length ?? null;
            onClick();
          }}
        >
          {t("more", { count: Math.min(UNITS_PAGE_SIZE, left) })}
        </Button>
      ) : null}
    </div>
  );
}

type UnitsTableProps = {
  blockName: string;
  units: readonly UnitRecord[];
  rowContext: UnitRowContext;
  openId: string | null;
  onToggle: (id: string | null) => void;
  onStatus: UnitsListProps["onStatus"];
};

/** Явные роли: в карточках у ячеек меняется display, и Safari иначе теряет смысл таблицы. */
function UnitsTable({ blockName, units, rowContext, openId, onToggle, onStatus }: UnitsTableProps) {
  const t = useTranslations("admin.complexes.units.list");
  return (
    <div className="units-list__frame">
      <table className="units-list__table" role="table">
        <caption className="sr-only">{t("caption", { name: blockName })}</caption>
        <thead className="units-list__head" role="rowgroup">
          <tr role="row">
            {UNITS_LIST_COLUMNS.map((column) => (
              <th
                key={column}
                className={`units-list__th units-list__th--${column}`}
                role="columnheader"
                scope="col"
              >
                {t(`columns.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {units.map((unit, index) => (
            <UnitsRow
              key={unit.id}
              unit={unit}
              rowContext={rowContext}
              open={openId === unit.id}
              alt={index % 2 === 1}
              onToggle={onToggle}
              onPick={onStatus}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
