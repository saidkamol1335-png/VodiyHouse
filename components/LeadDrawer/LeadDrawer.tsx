"use client";

import { Copy, Hand, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import type { LeadCard } from "@/lib/admin/leads/card";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import { formatDateTime } from "@/lib/format";
import { LeadContactCard, LeadDeliverySection, LeadInterest, LeadSourceSection, LeadStaffSection } from "./LeadDrawerParts";
import { useCopyPhone } from "./useCopyPhone";

export type LeadDrawerActions = {
  setStatus: (status: LeadCard["status"]) => void;
  assign: (userId: string | null) => void;
  retry: (channel: "telegram" | "sheet") => void;
};

type LeadDrawerProps = {
  card: LeadCard;
  viewerId: string | null;
  actions: LeadDrawerActions;
  pending: boolean;
  error: ContentErrorCode | null;
  onClose: () => void;
};

/**
 * Карточка заявки (мокап CabLeads, шторка справа; на телефоне — во весь экран): контакт, что
 * интересует, статус и ответственный, куда ушла заявка, сообщение бота, источник перехода.
 */
export function LeadDrawer({ card, viewerId, actions, pending, error, onClose }: LeadDrawerProps) {
  const t = useTranslations("admin.leads");
  const tErrors = useTranslations("admin.developers.errors");
  const dialog = useRef<HTMLDialogElement>(null);
  const copy = useCopyPhone(card.phone);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="lead-drawer" aria-labelledby="lead-drawer-title" aria-busy={pending} onClose={onClose}>
      <DrawerHead card={card} onClose={() => dialog.current?.close()} />
      <div className="lead-drawer__body">
        {error ? <FormStatus tone="error">{tErrors(error)}</FormStatus> : null}
        <LeadContactCard card={card} copy={copy} />
        <LeadInterest card={card} />
        <LeadStaffSection card={card} viewerId={viewerId} actions={actions} pending={pending} />
        <LeadDeliverySection card={card} onRetry={actions.retry} pending={pending} />
        <section className="lead-drawer__section">
          <h3 className="lead-drawer__section-title">{t("card.message")}</h3>
          <pre className="lead-drawer__message">{card.texts.botMessage}</pre>
        </section>
        <LeadSourceSection card={card} />
      </div>
      <div className="lead-drawer__foot">
        {viewerId && card.assigned?.id !== viewerId ? (
          <Button pending={pending} onClick={() => actions.assign(viewerId)}>
            <Hand size={16} aria-hidden="true" />
            {t("card.take")}
          </Button>
        ) : null}
        <Button variant="outline" onClick={copy.run}>
          <Copy size={16} aria-hidden="true" />
          {copy.done ? t("card.copied") : t("card.copyPhone")}
        </Button>
      </div>
    </dialog>
  );
}

/** Тип моно, «Заявка #1045», дата и время по Ташкенту; справа — статус и «×». */
function DrawerHead({ card, onClose }: { card: LeadCard; onClose: () => void }) {
  const t = useTranslations("admin.leads");
  return (
    <div className="lead-drawer__head">
      <div>
        <p className="lead-drawer__type">{t(`types.${card.type}`)}</p>
        <h2 id="lead-drawer-title" className="lead-drawer__title">
          {t("card.title", { number: card.number })}
        </h2>
        <p className="lead-drawer__time">{formatDateTime(new Date(card.createdAt))}</p>
      </div>
      <div className="lead-drawer__head-tools">
        <LeadStatusBadge status={card.status} />
        <button type="button" className="lead-drawer__close" aria-label={t("card.close")} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
