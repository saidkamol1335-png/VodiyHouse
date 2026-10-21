"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { UnitStatusPicker } from "@/components/UnitStatusPicker";
import { UNITS_LIST_COLUMNS } from "@/lib/admin/units/columns";
import type { UnitRecord, UnitStatus } from "@/lib/units";
import { UpdatedAgo } from "./UpdatedAgo";

type UnitDetailProps = {
  id: string;
  alt: boolean;
  unit: UnitRecord;
  onPick: (to: UnitStatus) => void;
  onClose: () => void;
};

/** Под строкой: три статуса и «Обновлено …» (в узком контейнере колонки «Обновлено» нет). */
export function UnitDetail({ id, alt, unit, onPick, onClose }: UnitDetailProps) {
  const t = useTranslations("admin.complexes.units.list");
  const row = useRef<HTMLTableRowElement>(null);
  // Последняя карточка у нижнего края — раскрытие не должно уйти под край экрана и полосу.
  useEffect(() => {
    row.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  return (
    <tr
      ref={row}
      id={id}
      className={alt ? "units-row__detail units-row__detail--alt" : "units-row__detail"}
      role="row"
    >
      <td className="units-row__detail-cell" role="cell" colSpan={UNITS_LIST_COLUMNS.length}>
        <UnitStatusPicker
          number={unit.number}
          status={unit.status}
          onPick={onPick}
          onClose={onClose}
        />
        <span className="units-row__detail-updated">
          {t("statusUpdated")} <UpdatedAgo at={unit.updatedAt} by={unit.updatedByName} />
        </span>
      </td>
    </tr>
  );
}
