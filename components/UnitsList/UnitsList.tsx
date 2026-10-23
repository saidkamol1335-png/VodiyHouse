"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { UnitsFilters } from "@/components/UnitsFilters";
import type { UnitRowContext } from "@/lib/admin/units/rowView";
import { UNITS_PAGE_SIZE } from "@/lib/admin/units/statusOutcome";
import type { UnitsListView } from "@/lib/admin/units/useUnitsListView";
import type { UnitsSelection } from "@/lib/admin/units/useUnitsSelection";
import { EMPTY_UNIT_FILTER, type UnitRecord, type UnitStatus } from "@/lib/units";
import { UnitsTable } from "./UnitsTable";

type UnitsListProps = {
  /** Название блока («A») — для подписи таблицы диктору. */
  blockName: string;
  /** id сводки «Показано N из M»: на неё уходит фокус, когда исчезает то, на чём он был. */
  summaryId: string;
  rowContext: UnitRowContext;
  /** Фильтр, порция и раскрытая строка — у блока: их видит и массовая панель. */
  view: UnitsListView;
  selection: UnitsSelection | null;
  canEdit: boolean;
  /** null — менять статус нельзя. */
  onStatus: ((unit: UnitRecord, to: UnitStatus) => void) | null;
};

/** Список квартир блока (Н1): фильтры, таблица (в узком контейнере — карточки) порциями по 200. */
export function UnitsList({
  blockName,
  summaryId,
  rowContext,
  view,
  selection,
  ...props
}: UnitsListProps) {
  return (
    <div className="units-list">
      <UnitsFilters
        filter={view.filter}
        counts={view.counts}
        options={view.options}
        onChange={view.changeFilter}
      />
      <SummaryRow view={view} selection={selection} summaryId={summaryId} />
      {view.visible.length === 0 ? (
        <NothingFound onReset={() => view.changeFilter(EMPTY_UNIT_FILTER)} />
      ) : (
        <UnitsTable
          blockName={blockName}
          units={view.shown}
          rowContext={rowContext}
          view={view}
          selection={selection}
          canEdit={props.canEdit}
          onStatus={props.onStatus}
        />
      )}
      {/* Закреплённые за порцией уже на экране — «ещё» считает только скрытые. */}
      <ShowMore
        left={view.visible.length - view.shown.length}
        limit={view.limit}
        onClick={view.showMore}
      />
    </div>
  );
}

/** «Показано N из M» (на неё уходит фокус, когда исчезает кнопка) и кнопки выделения. */
function SummaryRow({
  view,
  selection,
  summaryId,
}: {
  view: UnitsListView;
  selection: UnitsSelection | null;
  summaryId: string;
}) {
  const t = useTranslations("admin.complexes.units.list");
  return (
    <div className="units-list__summary-row">
      <p
        id={summaryId}
        className="units-list__summary"
        tabIndex={-1}
        aria-live="polite"
        aria-busy={view.busy}
      >
        {t("shown", { shown: view.shown.length, total: view.visible.length })}
      </p>
      {selection ? (
        <SelectionButtons view={view} selection={selection} summaryId={summaryId} />
      ) : null}
    </div>
  );
}

type SelectionButtonsProps = {
  view: UnitsListView;
  selection: UnitsSelection;
  summaryId: string;
};

/**
 * «Выбрать все N по фильтру» добавляет к выделенным (найденные поиском раньше не пропадают) — по
 * текущему фильтру, пока отложенный догоняет ввод, кнопка недоступна. «Снять выделение» — всё.
 * Нажатая кнопка исчезает — фокус переходит на соседнюю (или на сводку), а не на body.
 */
function SelectionButtons({ view, selection, summaryId }: SelectionButtonsProps) {
  const t = useTranslations("admin.complexes.units.list.select");
  const next = useRef<"all" | "clear" | null>(null);
  const focusIf = (which: "all" | "clear") => (element: HTMLButtonElement | null) => {
    if (!element || next.current !== which) return;
    next.current = null;
    element.focus();
  };
  const allPicked = view.visible.every((unit) => selection.ids.has(unit.id));
  const pickAll = () => {
    next.current = "clear";
    selection.setMany(view.matchingNow(), true);
  };
  const clear = () => {
    next.current = view.visible.length > 0 ? "all" : null;
    if (next.current === null) document.getElementById(summaryId)?.focus();
    selection.clear();
  };
  return (
    <div className="units-list__selection">
      {view.visible.length > 0 && !allPicked ? (
        <button
          ref={focusIf("all")}
          type="button"
          className="units-list__select-button"
          aria-disabled={view.busy}
          onClick={view.busy ? undefined : pickAll}
        >
          {t("all", { count: view.visible.length })}
        </button>
      ) : null}
      {selection.selected.length > 0 ? (
        <button
          ref={focusIf("clear")}
          type="button"
          className="units-list__select-button"
          onClick={clear}
        >
          {t("clear")}
        </button>
      ) : null}
      <ToBulkActions count={selection.selected.length} />
    </div>
  );
}

/**
 * «К действиям · N»: панель внизу экрана — последняя в порядке Tab, с клавиатуры до неё — сразу
 * отсюда (фокус на её первую кнопку; UnitsBulkBar помечена data-units-bulk).
 */
function ToBulkActions({ count }: { count: number }) {
  const t = useTranslations("admin.complexes.units.list.select");
  if (count === 0) return null;
  const jump = () => document.querySelector<HTMLElement>("[data-units-bulk] button")?.focus();
  return (
    <button
      type="button"
      className="units-list__select-button units-list__select-button--skip"
      onClick={jump}
    >
      {t("toActions", { count })}
    </button>
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
function ShowMore({ left, limit, onClick }: { left: number; limit: number; onClick: () => void }) {
  const t = useTranslations("admin.complexes.units.list");
  const anchor = useRef<HTMLDivElement>(null);
  const firstNew = useRef<number | null>(null);
  const rowsOf = () =>
    anchor.current?.closest(".units-list")?.querySelectorAll<HTMLElement>(".units-row") ?? null;
  useEffect(() => {
    if (firstNew.current === null) return;
    const row = rowsOf()?.[firstNew.current];
    row?.querySelector<HTMLElement>("button, input")?.focus();
    firstNew.current = null;
  });
  return (
    <div ref={anchor} className="units-list__more">
      {left > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="units-list__more-button"
          onClick={() => {
            // Первая новая — сразу за порцией (закреплённые встанут на свои места по номеру).
            firstNew.current = limit;
            onClick();
          }}
        >
          {t("more", { count: Math.min(UNITS_PAGE_SIZE, left) })}
        </Button>
      ) : null}
    </div>
  );
}
