import type { LeadPayloadRecord, LeadSubject } from "@/lib/leads/message";
import type { DeliveryState, LeadChannel, LeadSource, LeadStatus, LeadType, SiteLang } from "@/lib/leads/types";
import type { StaffRole } from "../access";
import type { ContentErrorCode } from "../developers/errors";

// Карточка заявки (мокап CabLeads, шторка «Заявка #1045»): ответ lead_card() → модель шторки.

/** Ответ действий ведения заявки (lib/admin/actions/leads.ts): свежая карточка или код отказа. */
export type LeadActionResult = { status: "ok"; card: LeadCard } | { status: "error"; error: ContentErrorCode };

export type LeadCardDelivery = {
  channel: LeadChannel;
  state: DeliveryState;
  attempts: number;
  sentAt: string | null;
  lastError: string | null;
};

export type LeadCard = {
  id: string;
  number: number;
  createdAt: string;
  type: LeadType;
  name: string;
  phone: string;
  contactLang: SiteLang | null;
  siteLang: SiteLang;
  subject: LeadSubject;
  pageUrl: string | null;
  source: LeadSource;
  payload: LeadPayloadRecord;
  status: LeadStatus;
  assigned: { id: string; name: string } | null;
  repeatOf: { number: number; createdAt: string; assigned: string | null } | null;
  deliveries: LeadCardDelivery[];
  calculation: { result: Record<string, unknown>; program: Record<string, unknown> } | null;
  staff: { id: string; name: string; role: StaffRole }[];
  /** Тексты для менеджера — сервер (lib/admin/server/leads.ts): как в Telegram-чате. */
  texts: LeadTexts;
};

export type LeadTexts = {
  /** «ЖК Shodlik · Блок A · 2-комн. 67,1 м²». */
  subject: string | null;
  /** «Посмотреть: этот ЖК, завтра, вечером», строки расчёта, фильтры подбора. */
  details: string[];
  /** Сообщение бота в чате менеджеров (мокап «Сообщение бота в Telegram-чате»). */
  botMessage: string;
};

type DeliveryRecord = {
  channel: LeadChannel;
  state: DeliveryState;
  attempts: number;
  sent_at: string | null;
  last_error: string | null;
};

export type LeadCardRecord = {
  id: string;
  number: number;
  created_at: string;
  type: LeadType;
  name: string;
  phone: string;
  contact_lang: SiteLang | null;
  site_lang: SiteLang;
  subject: LeadSubject;
  page_url: string | null;
  source: LeadSource;
  payload: LeadPayloadRecord;
  status: LeadStatus;
  assigned: { id: string; name: string } | null;
  repeat_of: { number: number; created_at: string; assigned: string | null } | null;
  deliveries: DeliveryRecord[] | null;
  calculation: LeadCard["calculation"];
  staff: LeadCard["staff"] | null;
};

export function leadCardFrom(record: LeadCardRecord, texts: LeadTexts): LeadCard {
  return {
    texts,
    id: record.id,
    number: record.number,
    createdAt: record.created_at,
    type: record.type,
    name: record.name,
    phone: record.phone,
    contactLang: record.contact_lang,
    siteLang: record.site_lang,
    subject: record.subject ?? {},
    pageUrl: record.page_url,
    source: record.source ?? {},
    payload: record.payload ?? {},
    status: record.status,
    assigned: record.assigned,
    repeatOf: record.repeat_of
      ? { number: record.repeat_of.number, createdAt: record.repeat_of.created_at, assigned: record.repeat_of.assigned }
      : null,
    deliveries: (record.deliveries ?? []).map((delivery) => ({
      channel: delivery.channel,
      state: delivery.state,
      attempts: delivery.attempts,
      sentAt: delivery.sent_at,
      lastError: delivery.last_error,
    })),
    calculation: record.calculation,
    staff: record.staff ?? [],
  };
}
