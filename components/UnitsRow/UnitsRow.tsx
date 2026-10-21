"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useRef, type RefObject } from "react";
import { UnitStatusBadge } from "@/components/UnitStatusBadge";
import { unitRowView, type UnitRowContext } from "@/lib/admin/units/rowView";
import type { UnitRecord, UnitStatus } from "@/lib/units";
import { FinishingCell, LayoutCell, PriceCell } from "./UnitsRowCells";
import { UnitDetail } from "./UnitDetail";
import { UpdatedAgo } from "./UpdatedAgo";

type UnitsRowProps = {
  unit: UnitRecord;
  rowContext: UnitRowContext;
  open: boolean;
  /** Зебра — по номеру строки: раскрытие вставляет свою строку, и :nth-child сбивался бы. */
  alt: boolean;
  onToggle: (id: string | null) => void;
  /** null — статус менять нельзя: плашка без кнопки. */
  onPick: ((unit: UnitRecord, to: UnitStatus) => void) | null;
};

/**
 * Строка квартиры (Н1): № · подъезд · этаж · планировка · цена · отделка · обновлено · статус;
 * в узком контейнере — карточка в две строки (CSS). Тап по плашке раскрывает под строкой выбор
 * статуса. memo — по ссылке квартиры и подписи контекста: перечитанный список и новые пропсы
 * страницы не перерисовывают все строки.
 */
export const UnitsRow = memo(
  function UnitsRow({ unit, rowContext, open, alt, onToggle, onPick }: UnitsRowProps) {
    const button = useRef<HTMLButtonElement>(null);
    const detailId = `unit-${unit.id}-status`;
    const close = () => {
      onToggle(null);
      button.current?.focus();
    };
    return (
      <>
        <tr className={rowClass(open, alt)} role="row">
          <UnitCells unit={unit} rowContext={rowContext} />
          <StatusCell
            unit={unit}
            open={open}
            detailId={detailId}
            button={button}
            {...{ onToggle, onPick }}
          />
        </tr>
        {open && onPick ? (
          <UnitDetail
            id={detailId}
            alt={alt}
            unit={unit}
            onPick={(to) => {
              onPick(unit, to);
              close();
            }}
            onClose={close}
          />
        ) : null}
      </>
    );
  },
  (prev, next) =>
    prev.unit === next.unit &&
    prev.open === next.open &&
    prev.alt === next.alt &&
    prev.rowContext.signature === next.rowContext.signature &&
    prev.onToggle === next.onToggle &&
    prev.onPick === next.onPick,
);

/** Ячейки до статуса: № · подъезд · этаж · планировка · цена · отделка · обновлено. */
function UnitCells({ unit, rowContext }: Pick<UnitsRowProps, "unit" | "rowContext">) {
  const t = useTranslations("admin.complexes.units.list");
  const view = unitRowView(unit, rowContext);
  return (
    <>
      <td className="units-row__number" role="cell">
        {unit.number}
      </td>
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

function rowClass(open: boolean, alt: boolean) {
  const classes = ["units-row"];
  if (alt) classes.push("units-row--alt");
  if (open) classes.push("units-row--open");
  return classes.join(" ");
}

type StatusCellProps = Pick<UnitsRowProps, "unit" | "open" | "onToggle" | "onPick"> & {
  detailId: string;
  button: RefObject<HTMLButtonElement | null>;
};

/** Плашка статуса: с правом менять — кнопка, раскрывающая выбор под строкой. */
function StatusCell({ unit, open, detailId, button, onToggle, onPick }: StatusCellProps) {
  const t = useTranslations("admin.complexes.units.list");
  const tStatus = useTranslations("admin.journal.unitStatus");
  if (!onPick)
    return (
      <td className="units-row__status" role="cell">
        <UnitStatusBadge status={unit.status} />
      </td>
    );
  return (
    <td className="units-row__status" role="cell">
      <button
        ref={button}
        type="button"
        className="units-row__status-button"
        aria-label={t("statusButton", { number: unit.number, status: tStatus(unit.status) })}
        aria-expanded={open}
        aria-controls={open ? detailId : undefined}
        onClick={() => onToggle(open ? null : unit.id)}
      >
        <UnitStatusBadge status={unit.status} />
        <ChevronDown className="units-row__chevron" size={14} aria-hidden="true" />
      </button>
    </td>
  );
}
