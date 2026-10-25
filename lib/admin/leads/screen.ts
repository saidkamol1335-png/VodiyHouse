import type { LeadSubject } from "@/lib/leads/message";
import {
  LEAD_STATUSES,
  LEAD_TYPES,
  type DeliveryState,
  type LeadChannel,
  type LeadSource,
  type LeadStatus,
  type LeadType,
} from "@/lib/leads/types";

// Раздел «Заявки» (шаг 3.7, мокап CabLeads): ответы leads_screen(), lead_card(), leads_home() →
// модель экрана. Без импортов SDK — модуль подключают и клиентские компоненты кабинета.

export type LeadDelivery = { channel: LeadChannel; state: DeliveryState };

export type LeadRow = {
  id: string;
  number: number;
  createdAt: string;
  type: LeadType;
  name: string;
  phone: string;
  subject: LeadSubject;
  source: LeadSource;
  status: LeadStatus;
  assigned: { id: string; name: string } | null;
  repeat: boolean;
  deliveries: LeadDelivery[];
};

export type LeadRowRecord = Omit<LeadRow, "createdAt"> & { created_at: string };

export type LeadsScreen = {
  counts: Record<LeadStatus, number>;
  total: number;
  rows: LeadRow[];
};

export type LeadsFilter = { status: LeadStatus | null; type: LeadType | null; query: string };

export const NO_LEADS_FILTER: LeadsFilter = { status: null, type: null, query: "" };

/** Сколько строк читает экран; больше — «уточните поиск» (мокап без постраничности). */
export const LEADS_LIMIT = 200;

export function leadRowFrom(record: LeadRowRecord): LeadRow {
  const { created_at: createdAt, ...rest } = record;
  return { ...rest, createdAt, deliveries: record.deliveries ?? [] };
}

export function leadsScreenFrom(record: { counts: Record<string, number> | null; total: number; rows: LeadRowRecord[] }): LeadsScreen {
  const counts = Object.fromEntries(LEAD_STATUSES.map((status) => [status, record.counts?.[status] ?? 0]));
  return { counts: counts as Record<LeadStatus, number>, total: record.total, rows: record.rows.map(leadRowFrom) };
}

const isStatus = (value: unknown): value is LeadStatus =>
  typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
const isType = (value: unknown): value is LeadType =>
  typeof value === "string" && (LEAD_TYPES as readonly string[]).includes(value);

/** Фильтр из адреса (?status=&type=&q=): ссылку можно переслать коллеге. */
export function leadsFilterFrom(search: Record<string, string | string[] | undefined>): LeadsFilter {
  const one = (key: string) => (typeof search[key] === "string" ? (search[key] as string) : null);
  return {
    status: isStatus(one("status")) ? (one("status") as LeadStatus) : null,
    type: isType(one("type")) ? (one("type") as LeadType) : null,
    query: (one("q") ?? "").trim().slice(0, 60),
  };
}

export function searchFromLeadsFilter(filter: LeadsFilter, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.type) params.set("type", filter.type);
  if (filter.query) params.set("q", filter.query);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** «№ заявки» из адреса (?n=1045 и /admin/zayavki/1045) — только целое число. */
export function leadNumberFrom(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d{1,12}$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** Канал доставки в строке: доставлен, в очереди, не доставлен или не подключён вовсе. */
export function deliveryOf(row: Pick<LeadRow, "deliveries">, channel: LeadChannel): DeliveryState | "off" {
  return row.deliveries.find((delivery) => delivery.channel === channel)?.state ?? "off";
}

/** «instagram / cpc / shodlik_reels_03» (мокап, колонка «Источник (UTM)»); без меток — откуда пришли. */
export function sourceText(source: LeadSource): string | null {
  const marks = [source.utm_source, source.utm_medium, source.utm_campaign, source.utm_content, source.utm_term]
    .filter(Boolean)
    .join(" / ");
  if (marks) return marks;
  if (source.fbclid) return "facebook / fbclid";
  if (source.gclid) return "google / gclid";
  return source.referrer ?? null;
}
