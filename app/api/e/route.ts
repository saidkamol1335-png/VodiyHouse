import { cookies, headers } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  trackEvents,
  VISITOR_COOKIE,
  VISITOR_MAX_AGE,
} from "@/lib/events/server/track";

// События сайта (шаг 3.12): браузер шлёт пачку sendBeacon'ом раз в несколько секунд и при уходе со
// страницы. Ответ всегда 204 — посетителю не важно, записалось ли; cookie посетителя и сессии
// продлеваются, только если событие записано (боты и сотрудники cookie не получают).

const MAX_BODY = 16_000;

export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  const body = text.length > 0 && text.length <= MAX_BODY ? safeJson(text) : null;
  const [store, list] = await Promise.all([cookies(), headers()]);
  const jar = new Map(store.getAll().map(({ name, value }) => [name, value]));
  const tracked = await trackEvents({ userAgent: list.get("user-agent"), cookies: jar, body });
  if (tracked) {
    const options = { httpOnly: true, sameSite: "lax" as const, secure: new URL(request.url).protocol === "https:", path: "/" };
    store.set(VISITOR_COOKIE, tracked.visitor, { ...options, maxAge: VISITOR_MAX_AGE });
    store.set(SESSION_COOKIE, tracked.session, { ...options, maxAge: SESSION_MAX_AGE });
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
