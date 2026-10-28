import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { hasAuthCookie } from "@/lib/admin/gate";
import { visitorKey } from "@/lib/leads/server/submit";
import { EVENT_BATCH_MAX, EVENT_TYPES, type EventBatch, type SiteEvent } from "../types";
import { deviceOf, isBot } from "../visitor";

// Приёмник событий сайта (шаг 3.12): посетитель без входа — секретным ключом, проверяет база
// (track_events открыт только серверу). Посетитель — случайный id в cookie на год, сессия — 30 минут
// без действий; IP не храним — лимит с адреса считает база по его солёному хэшу (как у заявок): без
// cookie — id вкладки из пачки (пока открыта вкладка — один посетитель и одна сессия). Боты и сотрудники (с cookie сессии кабинета) не записываются.

export const VISITOR_COOKIE = "vh-vid";
export const SESSION_COOKIE = "vh-sid";
export const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
export const SESSION_MAX_AGE = 60 * 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOr = (value: string | undefined) => (value && UUID.test(value) ? value : crypto.randomUUID());

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Пачка из браузера → только известные типы и короткие строки; остальное база отсеет ещё раз. */
export function batchFrom(raw: unknown): EventBatch | null {
  if (!isRecord(raw) || !Array.isArray(raw.events)) return null;
  const events = raw.events
    .filter(isRecord)
    .filter((event) => (EVENT_TYPES as readonly unknown[]).includes(event.type))
    .slice(0, EVENT_BATCH_MAX)
    .map((event) => event as SiteEvent);
  const lang = raw.lang === "ru" ? "ru" : "uz";
  const source = typeof raw.source === "string" ? raw.source.slice(0, 60) : null;
  const tab = typeof raw.tab === "string" && UUID.test(raw.tab) ? raw.tab : undefined;
  return events.length > 0 ? { events, lang, source, ...(tab ? { tab } : {}) } : null;
}

export type TrackRequest = { userAgent: string | null; cookies: Map<string, string>; body: unknown };
export type TrackResult = { visitor: string; session: string } | null;

/** null — не записываем (бот, сотрудник, нет ключа или пустая пачка); иначе — id для cookie. */
export async function trackEvents({ userAgent, cookies, body }: TrackRequest): Promise<TrackResult> {
  if (!hasSupabaseAdminEnv() || isBot(userAgent) || hasAuthCookie([...cookies.keys()])) return null;
  const batch = batchFrom(body);
  if (!batch) return null;
  // Без cookie посетителя (запрещены) — id вкладки из пачки: иначе каждая пачка — новый посетитель.
  const fallback = cookies.has(VISITOR_COOKIE) ? undefined : batch.tab;
  const visitor = idOr(cookies.get(VISITOR_COOKIE) ?? fallback);
  const session = idOr(cookies.get(SESSION_COOKIE) ?? fallback);
  const { error } = await createSupabaseAdminClient().rpc("track_events", {
    p_visitor: visitor,
    p_session: session,
    p_client_key: await visitorKey(),
    p_device: deviceOf(userAgent),
    p_lang: batch.lang,
    p_source: batch.source,
    p_events: batch.events,
  });
  if (error) console.error("[events] пачка не записана", error.message);
  return { visitor, session };
}
