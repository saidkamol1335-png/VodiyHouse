"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useLayoutEffect, useRef, type RefObject } from "react";
import { UnitStatusBadge } from "@/components/UnitStatusBadge";
import { UnitDetail } from "@/components/UnitDetail";
import { UnitsCheck } from "@/components/UnitsCheck";
import { unitRowView, type UnitRowContext } from "@/lib/admin/units/rowView";
import type { UnitRecord, UnitStatus } from "@/lib/units";
import { UpdatedAgo } from "@/components/UpdatedAgo";
import { FinishingCell, LayoutCell, PriceCell } from "./UnitsRowCells";

export type UnitsRowOpen = "status" | "edit" | null;

type UnitsRowProps = {
  unit: UnitRecord;
  rowContext: UnitRowContext;
  open: UnitsRowOpen;
  /** Зебра — по номеру строки: раскрытие вставляет свою строку, и :nth-child сбивался бы. */
  alt: boolean;
  /** null — колонки выбора нет (с выбранными делать нечего). */
  selected: boolean | null;
  onSelect: (id: string, on: boolean) => void;
  /** false — раскрытое не сменилось (правку не бросили). */
  onOpen: (id: string | null, mode?: "status" | "edit") => boolean;
  /** null — статус менять нельзя: плашка без кнопки. */
  onPick: ((unit: UnitRecord, to: UnitStatus) => void) | null;
  /** Правка квартиры руководителем (Н4) — в том же раскрытии. */
  canEdit: boolean;
  colSpan: number;
};

/**
 * Строка квартиры (Н1): [выбор] · № · подъезд · этаж · планировка · цена · отделка · обновлено ·
 * статус; в узком контейнере — карточка в две строки (CSS). Тап по плашке раскрывает под строкой
 * выбор статуса и «Изменить квартиру». memo — по ссылке квартиры и подписи контекста:
 * перечитанный список и новые пропсы страницы не перерисовывают все строки.
 */
export const UnitsRow = memo(function UnitsRow(props: UnitsRowProps) {
  const { unit, open, alt, onOpen, onPick } = props;
  const button = useRef<HTMLButtonElement>(null);
  const detailId = `unit-${unit.id}-detail`;
  const row = useFocusOutOnUnmount(detailId);
  const close = () => {
    // Правку не бросили — фокус остаётся в форме.
    if (onOpen(null)) button.current?.focus();
  };
  return (
    <>
      <tr
        ref={row}
        className={rowClass(open !== null, alt, props.selected === true)}
        role="row"
        data-unit-id={unit.id}
      >
        {props.selected === null ? null : <SelectCell {...props} />}
        <UnitCells unit={unit} rowContext={props.rowContext} />
        <StatusCell {...props} detailId={detailId} button={button} />
      </tr>
      {open ? (
        <UnitDetail
          id={detailId}
          alt={alt}
          selected={props.selected === true}
          unit={unit}
          mode={open}
          colSpan={props.colSpan}
          onPick={
            onPick
              ? (to) => {
                  onPick(unit, to);
                  close();
                }
              : null
          }
          onEdit={props.canEdit ? () => onOpen(unit.id, "edit") : null}
          onClose={close}
        />
      ) : null}
    </>
  );
}, sameRow);

/**
 * Строка уходит из списка, а фокус в ней или в её раскрытии (её перечитали, удалили, закрыли
 * раскрытие строки, которая держалась только им) — на сводку списка без прокрутки, а не на body.
 * Очистка layout-эффекта идёт, пока строка ещё в DOM.
 */
function useFocusOutOnUnmount(detailId: string) {
  const row = useRef<HTMLTableRowElement>(null);
  useLayoutEffect(() => {
    const element = row.current;
    return () => {
      const focused = document.activeElement;
      const detail = document.getElementById(detailId);
      if (!focused || !(element?.contains(focused) || detail?.contains(focused))) return;
      const summary = element
        ?.closest(".units-list")
        ?.querySelector<HTMLElement>(".units-list__summary");
      summary?.focus({ preventScroll: true });
    };
  }, [detailId]);
  return row;
}

function sameRow(prev: UnitsRowProps, next: UnitsRowProps) {
  return (
    prev.unit === next.unit &&
    prev.open === next.open &&
    prev.alt === next.alt &&
    prev.selected === next.selected &&
    prev.canEdit === next.canEdit &&
    prev.colSpan === next.colSpan &&
    prev.rowContext.signature === next.rowContext.signature &&
    prev.onOpen === next.onOpen &&
    prev.onSelect === next.onSelect &&
    prev.onPick === next.onPick
  );
}

function rowClass(open: boolean, alt: boolean, selected: boolean) {
  const classes = ["units-row"];
  if (alt) classes.push("units-row--alt");
  if (open) classes.push("units-row--open");
  if (selected) classes.push("units-row--selected");
  return classes.join(" ");
}

function SelectCell({ unit, selected, onSelect }: UnitsRowProps) {
  const t = useTranslations("admin.complexes.units.list.select");
  return (
    <td className="units-row__select" role="cell">
      <UnitsCheck
        label={t("row", { number: unit.number })}
        checked={selected === true}
        onChange={(on) => onSelect(unit.id, on)}
      />
    </td>
  );
}

/** Ячейки до статуса: № · подъезд · этаж · планировка · цена · отделка · обновлено. */
function UnitCells({ unit, rowContext }: Pick<UnitsRowProps, "unit" | "rowContext">) {
  const t = useTranslations("admin.complexes.units.list");
  const view = unitRowView(unit, rowContext);
  return (
    <>
      {/* Номер — заголовок строки: диктор в навигации по столбцу называет квартиру. */}
      <th className="units-row__number" scope="row" role="rowheader">
        {unit.number}
      </th>
      <td className="units-row__entrance" role="cell">
        <span className="units-row__prefix">{t("card.entrance")} </span>
        {unit.entrance}
      </td>
      <td className="units-row__floor" role="cell">
        <span className="units-row__prefix">{t("card.floor")} </span>
        {unit.floor}
      </td>
      <LayoutCell view={view} />
      <PriceCell view={view} />
      <FinishingCell view={view} />
      <td className="units-row__updated" role="cell">
        <UpdatedAgo at={unit.updatedAt} by={unit.updatedByName} />
      </td>
    </>
  );
}

type StatusCellProps = UnitsRowProps & {
  detailId: string;
  button: RefObject<HTMLButtonElement | null>;
};

/** Плашка статуса: можно менять статус или править — кнопка, раскрывающая строку. */
function StatusCell({ unit, open, detailId, button, onOpen, onPick, canEdit }: StatusCellProps) {
  const t = useTranslations("admin.complexes.units.list");
  const tStatus = useTranslations("admin.journal.unitStatus");
  if (!onPick && !canEdit)
    return (
      <td className="units-row__status" role="cell">
        <UnitStatusBadge status={unit.status} />
      </td>
    );
  const label = { number: unit.number, status: tStatus(unit.status) };
  return (
    <td className="units-row__status" role="cell">
      <button
        ref={button}
        type="button"
        className="units-row__status-button"
        aria-label={canEdit ? t("statusButtonEdit", label) : t("statusButton", label)}
        aria-expanded={open !== null}
        aria-controls={open ? detailId : undefined}
        onClick={() => onOpen(open ? null : unit.id)}
      >
        <UnitStatusBadge status={unit.status} className="units-row__badge" />
        <ChevronDown className="units-row__chevron" size={14} aria-hidden="true" />
      </button>
    </td>
  );
}
