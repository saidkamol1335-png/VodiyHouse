"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { LeadDrawer, type LeadDrawerActions } from "@/components/LeadDrawer";
import { assignLeadAction, retryLeadDeliveryAction, setLeadStatusAction } from "@/lib/admin/actions/leads";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { LeadActionResult, LeadCard } from "@/lib/admin/leads/card";
import { LEADS_LIMIT, searchFromLeadsFilter, type LeadsFilter, type LeadsScreen as Screen } from "@/lib/admin/leads/screen";
import { LeadsFilters } from "./LeadsFilters";
import { LeadsTable } from "./LeadsTable";

type LeadsScreenProps = {
  screen: Screen;
  filter: LeadsFilter;
  /** Открытая карточка (?n= в адресе); номер есть, а заявки нет — notFound. */
  card: LeadCard | null;
  notFound: boolean;
  viewerId: string | null;
  base: string;
};

/**
 * «Заявки» (шаг 3.7, мокап CabLeads): правило 1.2, фильтры, список и карточка. Всё читает сервер
 * по адресу (?status=&type=&q=&n=): ссылку на заявку или выборку можно переслать коллеге.
 */
export function LeadsScreen({ screen, filter, card, notFound, viewerId, base }: LeadsScreenProps) {
  const t = useTranslations("admin.leads");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = useCallback(
    (next: LeadsFilter, number: number | null = null) =>
      startTransition(() => router.replace(`${base}${searchFromLeadsFilter(next, number ? { n: String(number) } : {})}`, { scroll: false })),
    [base, router],
  );
  const actions = useLeadActions(card, () => startTransition(() => router.refresh()));
  return (
    <div className="leads-screen" aria-busy={pending}>
      <p className="leads-screen__rule">
        <ShieldCheck size={18} aria-hidden="true" />
        {t("rule")}
      </p>
      <LeadsFilters screen={screen} filter={filter} onChange={(next) => go(next)} csvHref={`${base}/csv${searchFromLeadsFilter(filter)}`} />
      {notFound ? <p className="leads-screen__empty">{t("card.notFound")}</p> : null}
      {screen.rows.length > 0 ? (
        <LeadsTable rows={screen.rows} selected={card?.number ?? null} onOpen={(number) => go(filter, number)} />
      ) : (
        <p className="leads-screen__empty">{screen.total === 0 ? t("empty") : t("emptyFilter")}</p>
      )}
      {screen.rows.length >= LEADS_LIMIT ? <p className="leads-screen__limit">{t("limit", { count: LEADS_LIMIT })}</p> : null}
      {card ? (
        <LeadDrawer
          key={card.number}
          card={card}
          viewerId={viewerId}
          actions={actions.handlers}
          pending={pending || actions.busy}
          error={actions.error}
          onClose={() => go(filter)}
        />
      ) : null}
    </div>
  );
}

/** Статус, ответственный, «Повторить»: действие → свежие список и карточка с сервера. */
function useLeadActions(card: LeadCard | null, refresh: () => void) {
  const [error, setError] = useState<ContentErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<LeadActionResult>) => {
    setBusy(true);
    setError(null);
    const result = await action().catch((): LeadActionResult => ({ status: "error", error: "network" }));
    setBusy(false);
    if (result.status === "error") setError(result.error);
    else refresh();
  };
  const handlers: LeadDrawerActions = {
    setStatus: (status) => card && run(() => setLeadStatusAction(card.number, card.id, status)),
    assign: (userId) => card && run(() => assignLeadAction(card.number, card.id, userId)),
    retry: (channel) => card && run(() => retryLeadDeliveryAction(card.number, card.id, channel)),
  };
  return { handlers, error, busy };
}
