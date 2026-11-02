"use client";

import { useLocale, useTranslations } from "next-intl";
import { LeadDeliveryMarks } from "@/components/LeadDeliveryMarks";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { LeadWhen } from "@/components/LeadWhen";
import { formatPhone } from "@/lib/contacts";
import { sourceText, type LeadRow } from "@/lib/admin/leads/screen";

type LeadsTableProps = {
  rows: readonly LeadRow[];
  selected: number | null;
  onOpen: (number: number) => void;
};

const COLUMNS = ["number", "when", "client", "type", "complex", "source", "status", "manager", "delivery"] as const;

/**
 * Список заявок (мокап CabLeads): шапка моно, строки-зебра, вся строка открывает карточку. Уже
 * 720 px — карточками в две-три строки (шапки нет).
 */
export function LeadsTable({ rows, selected, onOpen }: LeadsTableProps) {
  const t = useTranslations("admin.leads");
  return (
    <div className="leads-table">
      <table className="leads-table__table">
        <thead className="leads-table__head">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={`leads-table__th leads-table__th--${column}`}>
                {t(`columns.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <LeadsTableRow key={row.id} row={row} selected={row.number === selected} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RowProps = { row: LeadRow; selected: boolean; onOpen: (number: number) => void };

function LeadsTableRow({ row, selected, onOpen }: RowProps) {
  const t = useTranslations("admin.leads");
  const locale = useLocale() as "ru";
  const complex = row.subject.complex?.[locale] ?? null;
  return (
    <tr className={selected ? "leads-table__row leads-table__row--selected" : "leads-table__row"} onClick={() => onOpen(row.number)}>
      <td className="leads-table__cell leads-table__cell--number">
        <button type="button" className="leads-table__open" aria-label={t("open", { number: row.number })} onClick={(event) => {
          event.stopPropagation();
          onOpen(row.number);
        }}>
          #{row.number}
        </button>
      </td>
      <td className="leads-table__cell leads-table__cell--when"><LeadWhen at={row.createdAt} /></td>
      <td className="leads-table__cell leads-table__cell--client">
        <b className="leads-table__name">{row.name}</b>
        <span className="leads-table__phone">{formatPhone(row.phone)}</span>
      </td>
      <td className="leads-table__cell leads-table__cell--type">
        {t(`types.${row.type}`)}
        {row.repeat ? <span className="leads-table__repeat">{t("repeatMark")}</span> : null}
      </td>
      <td className="leads-table__cell leads-table__cell--complex">{complex ? t("subject.complex", { name: complex }) : t("noComplex")}</td>
      <td className="leads-table__cell leads-table__cell--source">{sourceText(row.source) ?? t("sourceDirect")}</td>
      <td className="leads-table__cell leads-table__cell--status"><LeadStatusBadge status={row.status} /></td>
      <td className="leads-table__cell leads-table__cell--manager">{row.assigned?.name ?? t("noComplex")}</td>
      <td className="leads-table__cell leads-table__cell--delivery"><LeadDeliveryMarks row={row} /></td>
    </tr>
  );
}
