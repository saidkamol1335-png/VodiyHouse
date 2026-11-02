import { useTranslations } from "next-intl";
import type { LeadStatus } from "@/lib/leads/types";

/**
 * Статус заявки (мокап CabLeads .st): точка и подпись своего цвета — новая янтарём, в работе
 * синим, перезвонили бирюзой, встреча фиолетовым, сделка зелёным, отказ серым.
 */
export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const t = useTranslations("admin.leads.statuses");
  return (
    <span className={`lead-status lead-status--${status}`}>
      <i className="lead-status__dot" aria-hidden="true" />
      {t(status)}
    </span>
  );
}
