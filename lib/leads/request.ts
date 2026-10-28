import { formatPhone } from "@/lib/format";
import {
  LEAD_TYPES,
  SOURCE_KEYS,
  VIEW_DAYS,
  VIEW_TARGETS,
  VIEW_TIMES,
  type LeadFieldErrors,
  type LeadRequest,
  type LeadSource,
  type LeadType,
  type SiteLang,
  type ViewChoice,
} from "./types";

// Проверка заявки на сервере: данные пришли из браузера, им не верим. Форма показывает те же
// ошибки полей до отправки (fieldErrorsOf); всё остальное чистится молча — лишнее не сохраняется.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,80}$/;
const NAME_MAX = 80;
const TEXT_MAX = 300;
const COMMENT_MAX = 1000;
const SOURCE_MAX = 200;
const ROWS_MAX = 8;

/** Для submit_lead: тип, контакт, объект, страница, источник, данные по типу, снимок расчёта. */
export type LeadPayload = {
  type: LeadType;
  name: string;
  phone: string;
  contact_lang: SiteLang | null;
  site_lang: SiteLang;
  complex?: string;
  layout?: string;
  unit?: string;
  developer?: string;
  page_url: string | null;
  source: LeadSource;
  payload: Record<string, unknown>;
  calc?: { program: string; input: Record<string, unknown>; result: Record<string, unknown> };
};

export type ParsedLead = { ok: true; lead: LeadPayload; trap: boolean } | { ok: false; fields: LeadFieldErrors };

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Комментарий застройщика: строки сохраняются (их читают в Telegram и кабинете), пустых подряд — не больше одной. */
const multiline = (value: unknown, max: number): string =>
  typeof value === "string"
    ? value
        .replace(/\r\n?/g, "\n")
        .replace(/[^\S\n]+/g, " ")
        .replace(/ *\n */g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max)
    : "";

const oneOf = <T extends string>(value: unknown, options: readonly T[]): T | null =>
  typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : null;

const lang = (value: unknown): SiteLang | null => oneOf(value, ["ru", "uz"] as const);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Имя и телефон — те же правила у формы и сервера (ТЗ 10.2). */
export function fieldErrorsOf(input: { name: string; phone: string; company?: string }, needsCompany = false): LeadFieldErrors {
  const errors: LeadFieldErrors = {};
  if (!input.name.trim()) errors.name = "required";
  // Нетронутое «+998 » маски — поле пустое («Заполните»), а не номер с ошибкой формата.
  const digits = input.phone.replace(/\D/g, "");
  if (!digits || digits === "998") errors.phone = "required";
  else if (!formatPhone(input.phone)) errors.phone = "phone";
  if (needsCompany && !input.company?.trim()) errors.company = "required";
  return errors;
}

export function sourceFrom(raw: unknown): LeadSource {
  if (!isRecord(raw)) return {};
  const source: LeadSource = {};
  for (const key of SOURCE_KEYS) {
    const value = text(raw[key], SOURCE_MAX);
    if (value) source[key] = value;
  }
  return source;
}

/** Адрес страницы — только путь этого сайта: чужой домен в заявку и в Telegram не попадёт. */
export function pagePathFrom(raw: unknown): string | null {
  const value = text(raw, 500);
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function viewFrom(raw: unknown): ViewChoice | null {
  if (!isRecord(raw)) return null;
  const target = oneOf(raw.target, VIEW_TARGETS);
  const day = oneOf(raw.day, VIEW_DAYS);
  return target && day ? { target, day, time: oneOf(raw.time, VIEW_TIMES) } : null;
}

function rowsFrom(raw: unknown): { label: string; value: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, ROWS_MAX)
    .filter(isRecord)
    .map((row) => ({ label: text(row.label, 60), value: text(row.value, 120) }))
    .filter((row) => row.label && row.value);
}

/** Данные по типу (ТЗ 10.1): просмотр, фильтры подбора, застройщик, строки расчёта. */
function payloadFrom(type: LeadType, raw: Partial<LeadRequest>): Record<string, unknown> {
  if (type === "view") return { view: viewFrom(raw.view) ?? { target: "complex", day: "tomorrow", time: null } };
  if (type === "pick" && isRecord(raw.filters)) {
    return { filters: { text: text(raw.filters.text, TEXT_MAX), link: pagePathFrom(raw.filters.link) } };
  }
  if (type === "partner" && isRecord(raw.partner)) {
    const partner = raw.partner;
    return {
      partner: {
        company: text(partner.company, NAME_MAX),
        city: text(partner.city, NAME_MAX),
        format: text(partner.format, NAME_MAX),
        projects: text(partner.projects, NAME_MAX),
        comment: multiline(partner.comment, COMMENT_MAX),
      },
    };
  }
  if (type === "calc") return { rows: rowsFrom(raw.calcRows) };
  if (type === "promo" && isRecord(raw.promo)) {
    const title = text(raw.promo.title, TEXT_MAX);
    return title ? { promo: { title } } : {};
  }
  return {};
}

/** Объект заявки — только адрес ЖК (slug) и uuid: остальное база найдёт и проверит сама. */
export function objectFrom(raw: unknown): Pick<LeadPayload, "complex" | "layout" | "unit" | "developer"> {
  if (!isRecord(raw)) return {};
  const pick = (value: unknown, pattern: RegExp) =>
    typeof value === "string" && pattern.test(value) ? value : undefined;
  return {
    complex: pick(raw.complex, SLUG),
    layout: pick(raw.layout, UUID),
    unit: pick(raw.unit, UUID),
    developer: pick(raw.developer, SLUG),
  };
}

function calcFrom(raw: unknown): LeadPayload["calc"] {
  if (!isRecord(raw) || typeof raw.program !== "string" || !UUID.test(raw.program)) return undefined;
  if (!isRecord(raw.input) || !isRecord(raw.result)) return undefined;
  return { program: raw.program, input: raw.input, result: raw.result };
}

/** Заявка из браузера → данные для базы; ошибки полей — как у формы. */
export function parseLeadRequest(raw: unknown): ParsedLead {
  const request = (isRecord(raw) ? raw : {}) as Partial<LeadRequest>;
  const type = oneOf(request.type, LEAD_TYPES);
  const name = text(request.name, NAME_MAX);
  const phone = formatPhone(typeof request.phone === "string" ? request.phone : "");
  const company = type === "partner" && isRecord(request.partner) ? text(request.partner.company, NAME_MAX) : "";
  const fields = fieldErrorsOf({ name, phone: phone ?? text(request.phone, 40), company }, type === "partner");
  if (!type || Object.keys(fields).length > 0) return { ok: false, fields };
  const calc = type === "calc" ? calcFrom(request.calc) : undefined;
  const lead: LeadPayload = {
    type,
    name,
    phone: phone!,
    contact_lang: lang(request.contactLang),
    site_lang: lang(request.siteLang) ?? "uz",
    ...objectFrom(request.object),
    page_url: pagePathFrom(request.pageUrl),
    source: sourceFrom(request.source),
    payload: payloadFrom(type, request),
    ...(calc ? { calc } : {}),
  };
  return { ok: true, lead, trap: text(request.trap, 200) !== "" };
}
