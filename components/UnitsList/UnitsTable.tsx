"use client";

import { useTranslations } from "next-intl";
import { UnitsCheck } from "@/components/UnitsCheck";
import { UnitsRow } from "@/components/UnitsRow";
import { unitsListColumns } from "@/lib/admin/units/columns";
import type { UnitRowContext } from "@/lib/admin/units/rowView";
import { pageCheck } from "@/lib/admin/units/selection";
import type { UnitsListView } from "@/lib/admin/units/useUnitsListView";
import type { UnitsSelection } from "@/lib/admin/units/useUnitsSelection";
import type { UnitRecord, UnitStatus } from "@/lib/units";

type UnitsTableProps = {
  blockName: string;
  units: readonly UnitRecord[];
  rowContext: UnitRowContext;
  view: UnitsListView;
  /** null — галочек нет: с выбранными делать нечего. */
  selection: UnitsSelection | null;
  canEdit: boolean;
  onStatus: ((unit: UnitRecord, to: UnitStatus) => void) | null;
};

/** Явные роли: в карточках у ячеек меняется display, и Safari иначе теряет смысл таблицы. */
export function UnitsTable({
  blockName,
  units,
  rowContext,
  view,
  selection,
  ...props
}: UnitsTableProps) {
  const t = useTranslations("admin.complexes.units.list");
  const columns = unitsListColumns(selection !== null);
  return (
    <div className="units-list__frame">
      <table className="units-list__table" role="table">
        <caption className="sr-only">{t("caption", { name: blockName })}</caption>
        <TableHead columns={columns} units={units} selection={selection} />
        <tbody role="rowgroup">
          {units.map((unit, index) => (
            <UnitsRow
              key={unit.id}
              unit={unit}
              rowContext={rowContext}
              open={view.open?.id === unit.id ? view.open.mode : null}
              alt={index % 2 === 1}
              selected={selection ? selection.ids.has(unit.id) : null}
              onSelect={selection?.toggle ?? noSelect}
              onOpen={view.openRow}
              onPick={props.onStatus}
              canEdit={props.canEdit}
              colSpan={columns.length}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const noSelect = () => {};

type TableHeadProps = {
  columns: ReturnType<typeof unitsListColumns>;
  units: readonly UnitRecord[];
  selection: UnitsSelection | null;
};

function TableHead({ columns, units, selection }: TableHeadProps) {
  const t = useTranslations("admin.complexes.units.list");
  return (
    <thead className="units-list__head" role="rowgroup">
      <tr role="row">
        {columns.map((column) => (
          <th
            key={column}
            className={`units-list__th units-list__th--${column}`}
            role="columnheader"
            scope="col"
          >
            {column !== "select" ? (
              t(`columns.${column}`)
            ) : selection ? (
              <PageCheck units={units} selection={selection} />
            ) : null}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Галочка шапки — показанные строки: все, часть («—») или ни одной. */
function PageCheck({
  units,
  selection,
}: {
  units: readonly UnitRecord[];
  selection: UnitsSelection;
}) {
  const t = useTranslations("admin.complexes.units.list.select");
  const state = pageCheck(units, selection.ids);
  return (
    <UnitsCheck
      label={t("page")}
      checked={state === "all"}
      indeterminate={state === "some"}
      onChange={(on) => selection.setMany(units, on)}
    />
  );
}
