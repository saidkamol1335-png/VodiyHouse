"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { UnitEditForm } from "@/components/UnitEditForm";
import { UnitStatusPicker } from "@/components/UnitStatusPicker";
import { UpdatedAgo } from "@/components/UpdatedAgo";
import type { UnitRecord, UnitStatus } from "@/lib/units";

type UnitDetailProps = {
  id: string;
  /** Зебра и выбор галочкой — как у строки над раскрытием. */
  alt: boolean;
  selected: boolean;
  unit: UnitRecord;
  mode: "status" | "edit";
  colSpan: number;
  /** null — статус менять нельзя. */
  onPick: ((to: UnitStatus) => void) | null;
  /** null — править нельзя (менеджер, 12.6). */
  onEdit: (() => void) | null;
  onClose: () => void;
};

/**
 * Под строкой: выбор статуса, «Изменить квартиру» и «Обновлено …» (в узком контейнере колонки
 * «Обновлено» нет) — или форма правки квартиры (Н4). Esc закрывает раскрытие.
 */
export function UnitDetail({
  id,
  alt,
  selected,
  unit,
  mode,
  colSpan,
  onPick,
  onEdit,
  onClose,
}: UnitDetailProps) {
  const row = useRef<HTMLTableRowElement>(null);
  // Последняя карточка у нижнего края — раскрытие (и выросшая форма правки) не уходит под край.
  useEffect(() => {
    row.current?.scrollIntoView?.({ block: "nearest" });
  }, [mode]);
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  };
  return (
    <tr ref={row} id={id} className={detailClass(alt, selected)} role="row">
      <td className="unit-detail__cell" role="cell" colSpan={colSpan} onKeyDown={keydown}>
        {mode === "edit" ? (
          <UnitEditForm unit={unit} onDone={onClose} />
        ) : (
          <StatusDetail unit={unit} onPick={onPick} onEdit={onEdit} onClose={onClose} />
        )}
      </td>
    </tr>
  );
}

function detailClass(alt: boolean, selected: boolean) {
  const classes = ["unit-detail"];
  if (alt) classes.push("unit-detail--alt");
  if (selected) classes.push("unit-detail--selected");
  return classes.join(" ");
}

function StatusDetail({
  unit,
  onPick,
  onEdit,
  onClose,
}: Omit<UnitDetailProps, "id" | "alt" | "selected" | "mode" | "colSpan">) {
  const t = useTranslations("admin.complexes.units");
  return (
    <>
      <div className="unit-detail__actions">
        {onPick ? (
          <UnitStatusPicker
            label={t("list.statusPicker", { number: unit.number })}
            status={unit.status}
            onPick={onPick}
            onClose={onClose}
          />
        ) : null}
        {onEdit ? (
          <button type="button" className="unit-detail__edit" onClick={onEdit}>
            <Pencil size={14} aria-hidden="true" />
            {t("edit.open")}
          </button>
        ) : null}
      </div>
      <span className="unit-detail__updated">
        {t("list.statusUpdated")} <UpdatedAgo at={unit.updatedAt} by={unit.updatedByName} />
      </span>
    </>
  );
}
