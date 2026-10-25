import { createTranslator } from "next-intl";
import { formatPhone } from "@/lib/contacts";
import { formatArea, formatDateTime } from "@/lib/format";
import ru from "@/messages/ru.json";
import { sourceText } from "@/lib/admin/leads/screen";
import type { LeadSource, LeadType, ViewChoice } from "./types";

// Сообщение в Telegram-чат менеджеров и строка Google Таблицы (ТЗ 10.3–10.4). Менеджеры читают
// по-русски — тексты из messages/ru.json (admin.leads.message) при любом языке сайта. Чистые
// функции: адрес сайта и кабинета передаёт вызывающий.

/** Заявка для доставки — public.lead_message() базы. */
export type LeadRecord = {
  id: string;
  number: number;
  created_at: string;
  type: LeadType;
  name: string;
  phone: string;
  contact_lang: "ru" | "uz" | null;
  site_lang: "ru" | "uz";
  subject: LeadSubject;
  page_url: string | null;
  source: LeadSource;
  payload: LeadPayloadRecord;
  repeat_number: number | null;
  channels: string[];
};

export type LeadSubject = {
  slug?: string;
  complex?: { ru: string; uz: string };
  developer?: string;
  block?: string;
  layout?: { rooms: number; area: number };
  unit?: string;
};

export type LeadPayloadRecord = {
  view?: ViewChoice;
  filters?: { text: string; link: string | null };
  partner?: { company: string; city: string; format: string; projects: string; comment: string };
  rows?: { label: string; value: string }[];
  telegram?: string;
};

const t = createTranslator({ locale: "ru", messages: ru, namespace: "admin.leads" });

/** «ЖК Shodlik · Блок A · 2-комн. 67,1 м² · кв. 45»; без ЖК — застройщик или ничего. */
export function subjectLine(subject: LeadSubject): string | null {
  const parts: string[] = [];
  if (subject.complex) parts.push(t("subject.complex", { name: subject.complex.ru }));
  if (subject.block) parts.push(t("subject.block", { name: subject.block }));
  if (subject.layout) {
    parts.push(
      `${t("subject.rooms", { count: subject.layout.rooms })} ${formatArea(subject.layout.area)}`,
    );
  }
  if (subject.unit) parts.push(t("subject.unit", { number: subject.unit }));
  if (parts.length === 0 && subject.developer) parts.push(t("subject.developer", { name: subject.developer }));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** «instagram / cpc / shodlik_reels_03»; без меток — откуда пришли или «прямой заход». */
export function sourceLine(source: LeadSource): string {
  return sourceText(source) ?? t("source.direct");
}

/** Строки «что ещё» по типу: просмотр, фильтры, застройщик, расчёт, ник в Telegram. */
export function payloadLines(payload: LeadPayloadRecord): string[] {
  const lines: string[] = [];
  if (payload.view) {
    const { target, day, time } = payload.view;
    const when = [t(`view.day.${day}`), time ? t(`view.time.${time}`) : null].filter(Boolean).join(", ");
    lines.push(t("message.view", { target: t(`view.target.${target}`), when }));
  }
  if (payload.filters?.text) lines.push(t("message.filters", { text: payload.filters.text }));
  if (payload.partner) {
    const { company, city, format, projects, comment } = payload.partner;
    lines.push(t("message.company", { company }));
    for (const [key, value] of [["city", city], ["format", format], ["projects", projects], ["comment", comment]] as const) {
      if (value) lines.push(t(`message.${key}`, { value }));
    }
  }
  for (const row of payload.rows ?? []) lines.push(`${row.label}: ${row.value}`);
  if (payload.telegram) lines.push(t("message.telegram", { nick: payload.telegram }));
  return lines;
}

export type MessageLinks = { site: string; cabinet: string };

/** Текст сообщения бота в чат менеджеров (ТЗ 10.4, мокап CabLeads «Сообщение бота»). */
export function telegramText(lead: LeadRecord, links: MessageLinks): string {
  const subject = subjectLine(lead.subject);
  const lines = [
    t("message.title", { number: lead.number, type: t(`types.${lead.type}`) }),
    lead.repeat_number ? t("message.repeat", { number: lead.repeat_number }) : null,
    subject,
    ...payloadLines(lead.payload),
    t("message.name", { name: lead.name }),
    t("message.phone", { phone: formatPhone(lead.phone) }),
    lead.contact_lang ? t("message.lang", { lang: t(`langs.${lead.contact_lang}`) }) : null,
    t("message.source", { source: sourceLine(lead.source) }),
    lead.page_url ? t("message.page", { url: `${links.site}${lead.page_url}` }) : null,
    formatDateTime(new Date(lead.created_at)),
    t("message.open", { url: `${links.cabinet}/${lead.number}` }),
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

/** Строка Google Таблицы: столбцы — поля ТЗ 10.3 (в таблице их подписывает приёмник Apps Script). */
export function sheetRow(lead: LeadRecord, links: MessageLinks): Record<string, string | number> {
  const { source } = lead;
  return {
    number: lead.number,
    created_at: formatDateTime(new Date(lead.created_at)),
    type: t(`types.${lead.type}`),
    name: lead.name,
    phone: lead.phone,
    contact_lang: lead.contact_lang ? t(`langs.${lead.contact_lang}`) : "",
    site_lang: t(`langs.${lead.site_lang}`),
    subject: subjectLine(lead.subject) ?? "",
    developer: lead.subject.developer ?? "",
    details: payloadLines(lead.payload).join("\n"),
    page: lead.page_url ? `${links.site}${lead.page_url}` : "",
    utm_source: source.utm_source ?? "",
    utm_medium: source.utm_medium ?? "",
    utm_campaign: source.utm_campaign ?? "",
    utm_content: source.utm_content ?? "",
    utm_term: source.utm_term ?? "",
    fbclid: source.fbclid ?? "",
    gclid: source.gclid ?? "",
    referrer: source.referrer ?? "",
    repeat_of: lead.repeat_number ?? "",
    cabinet: `${links.cabinet}/${lead.number}`,
  };
}

/** Тревога руководителю (ТЗ 10.4): заявки, которые за 10 минут не дошли ни в один канал. */
export function alertText(leads: { number: number; type: LeadType }[], cabinet: string): string {
  return [
    t("alert.title", { count: leads.length }),
    ...leads.map((lead) => t("alert.line", { number: lead.number, type: t(`types.${lead.type}`), url: `${cabinet}/${lead.number}` })),
    t("alert.hint"),
  ].join("\n");
}
