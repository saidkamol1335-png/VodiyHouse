"use client";

import { Check, ExternalLink, Lock, Phone, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { FilterPills } from "@/components/FilterPills";
import type { LeadCard, LeadCardDelivery } from "@/lib/admin/leads/card";
import { sourceText } from "@/lib/admin/leads/screen";
import { formatPhone } from "@/lib/contacts";
import { formatDate, formatDayTime } from "@/lib/format";
import { complexRoute } from "@/lib/routes";
import { LEAD_CHANNELS, LEAD_STATUSES, type LeadChannel } from "@/lib/leads/types";
import type { LeadDrawerActions } from "./LeadDrawer";
import type { CopyPhone } from "./useCopyPhone";

/** Повтор, контакт с «Номер» и удобный язык (мокап: .notice--amber, .card .ava). */
export function LeadContactCard({ card, copy }: { card: LeadCard; copy: CopyPhone }) {
  const t = useTranslations("admin.leads");
  const lang = card.contactLang ? t(`langs.${card.contactLang}`) : t(`langs.${card.siteLang}`);
  return (
    <>
      {card.repeatOf ? (
        <p className="lead-drawer__notice">
          <RefreshCw size={16} aria-hidden="true" />
          {t("card.repeat", {
            number: card.repeatOf.number,
            date: formatDate(new Date(card.repeatOf.createdAt)),
            who: card.repeatOf.assigned ? t("card.repeatBy", { name: card.repeatOf.assigned }) : t("card.repeatNobody"),
          })}
        </p>
      ) : null}
      <div className="lead-drawer__contact">
        <Avatar name={card.name} />
        <span className="lead-drawer__who">
          <b>{card.name}</b>
          <a className="lead-drawer__phone" href={`tel:${card.phone}`}>
            {formatPhone(card.phone)}
          </a>
        </span>
        <Button size="sm" onClick={copy.run}>
          <Phone size={16} aria-hidden="true" />
          {t("card.phone")}
        </Button>
        <p className="lead-drawer__lang">{t("card.lang", { lang })}</p>
        {copy.failed ? <p className="lead-drawer__lang">{t("card.copyFailed")}</p> : null}
      </div>
    </>
  );
}

/** «Что интересует»: ЖК ссылкой на сайт, объект и данные заявки — как в Telegram-чате. */
export function LeadInterest({ card }: { card: LeadCard }) {
  const t = useTranslations("admin.leads.card");
  const { slug } = card.subject;
  return (
    <section className="lead-drawer__section">
      <h3 className="lead-drawer__section-title">{t("interest")}</h3>
      {slug ? (
        <a className="lead-drawer__link" href={`/${card.siteLang}${complexRoute(slug)}`} target="_blank" rel="noopener">
          {card.texts.subject ?? t("openComplex")}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      ) : (
        <p className="lead-drawer__text">{card.texts.subject ?? t("interestEmpty")}</p>
      )}
      {card.texts.details.length > 0 ? <p className="lead-drawer__details">{card.texts.details.join("\n")}</p> : null}
      {card.pageUrl ? (
        <p className="lead-drawer__page">
          {t("page")}: <span>{card.pageUrl}</span>
        </p>
      ) : null}
    </section>
  );
}

type StaffSectionProps = { card: LeadCard; viewerId: string | null; actions: LeadDrawerActions; pending: boolean };

/** Статус и ответственный менеджер — чипами (мокап .opts .chip--sm); нажатие сохраняет сразу. */
export function LeadStaffSection({ card, viewerId, actions, pending }: StaffSectionProps) {
  const t = useTranslations("admin.leads");
  const staff = card.staff.map((person) => ({
    key: person.id,
    label: person.id === viewerId ? t("card.me", { name: person.name }) : person.name,
  }));
  return (
    <>
      <section className="lead-drawer__section" aria-busy={pending}>
        <h3 className="lead-drawer__section-title">{t("card.status")}</h3>
        <FilterPills
          label={t("card.status")}
          rows
          pills={LEAD_STATUSES.map((status) => ({ key: status, label: t(`statuses.${status}`) }))}
          value={card.status}
          onChange={(status) => status !== card.status && actions.setStatus(status)}
        />
      </section>
      <section className="lead-drawer__section" aria-busy={pending}>
        <h3 className="lead-drawer__section-title">{t("card.manager")}</h3>
        <FilterPills
          label={t("card.manager")}
          rows
          pills={[...staff, { key: "none", label: t("card.unassigned") }]}
          value={card.assigned?.id ?? "none"}
          onChange={(key) => key !== (card.assigned?.id ?? "none") && actions.assign(key === "none" ? null : key)}
        />
      </section>
    </>
  );
}

type DeliveryProps = { card: LeadCard; onRetry: (channel: LeadChannel) => void; pending: boolean };

/** «Куда ушла заявка»: Telegram-чат, Google Таблица, застройщику — никогда (правило 1.2). */
export function LeadDeliverySection({ card, onRetry, pending }: DeliveryProps) {
  const t = useTranslations("admin.leads");
  return (
    <section className="lead-drawer__section">
      <h3 className="lead-drawer__section-title">{t("card.where")}</h3>
      <ul className="lead-drawer__channels">
        {LEAD_CHANNELS.map((channel) => (
          <DeliveryLine key={channel} channel={channel} delivery={card.deliveries.find((item) => item.channel === channel)} onRetry={onRetry} pending={pending} />
        ))}
        <li className="lead-drawer__channel">
          <span className="lead-drawer__channel-mark lead-drawer__channel-mark--off">
            <Lock size={12} aria-hidden="true" />
          </span>
          <span className="lead-drawer__channel-text">
            <b>{t("delivery.developer")}</b>
            <span>{t("delivery.developerHint")}</span>
          </span>
        </li>
      </ul>
    </section>
  );
}

type DeliveryLineProps = { channel: LeadChannel; delivery: LeadCardDelivery | undefined; onRetry: (channel: LeadChannel) => void; pending: boolean };

function DeliveryLine({ channel, delivery, onRetry, pending }: DeliveryLineProps) {
  const t = useTranslations("admin.leads");
  const state = delivery?.state ?? "off";
  const Icon = state === "sent" ? Check : state === "failed" ? TriangleAlert : RefreshCw;
  const text = !delivery
    ? t("delivery.off")
    : delivery.state === "sent"
      ? t("delivery.sent", { time: delivery.sentAt ? formatDayTime(new Date(delivery.sentAt)) : "" })
      : delivery.state === "failed"
        ? t("delivery.failed", { attempts: delivery.attempts })
        : delivery.attempts > 0
          ? t("delivery.queued", { attempts: delivery.attempts })
          : t("delivery.sending");
  const canRetry = delivery && (delivery.state === "failed" || delivery.attempts > 0) && delivery.state !== "sent";
  return (
    <li className="lead-drawer__channel">
      <span className={`lead-drawer__channel-mark lead-drawer__channel-mark--${state}`}>
        <Icon size={12} aria-hidden="true" />
        {t(`channels.${channel}`)}
      </span>
      <span className="lead-drawer__channel-text">
        <b>{t(`channelNames.${channel}`)}</b>
        <span>{text}</span>
        {delivery?.lastError && delivery.state !== "sent" ? <span className="lead-drawer__error">{delivery.lastError}</span> : null}
      </span>
      {canRetry ? (
        <Button variant="outline" size="sm" pending={pending} onClick={() => onRetry(channel)}>
          <RefreshCw size={14} aria-hidden="true" />
          {t("delivery.retry")}
        </Button>
      ) : null}
    </li>
  );
}

/** «Источник перехода» (ТЗ 10.3): метки первого захода — по ним видно, какой креатив привёл заявку. */
export function LeadSourceSection({ card }: { card: LeadCard }) {
  const t = useTranslations("admin.leads");
  return (
    <section className="lead-drawer__section">
      <h3 className="lead-drawer__section-title">{t("card.source")}</h3>
      <p className="lead-drawer__source">{sourceText(card.source) ?? t("sourceDirect")}</p>
    </section>
  );
}
