import { STAFF_COOKIE, STAFF_COOKIE_VALUE } from "@vh/shared/staffCookie";

// Метка браузера сотрудника (фаза F, п. 40) для сайта: ставят вход и proxy (уже вошедшим), снимает
// выход. STAFF_COOKIE_DOMAIN — общий домен (.vodiyhouse.uz); пусто — метка только этого хоста:
// на *.netlify.app (общий суффикс) до сайта она не дойдёт — там сотрудники считаются (п. 18), а на
// localhost кабинет и сайт делят cookie и так. Не httpOnly: сайт читает её и в браузере (пиксели).

type Env = Record<string, string | undefined>;

const MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export type StaffCookie = {
  name: string;
  value: string;
  path: "/";
  sameSite: "lax";
  httpOnly: false;
  secure: boolean;
  maxAge: number;
  domain?: string;
};

/** Общий домен — только если кабинет на нём: чужой домен браузер молча отбросит вместе с меткой. */
export function staffCookieDomain(hostname: string, env: Env = process.env): string | undefined {
  // || , а не ??: пустая переменная окружения — как не заданная.
  const bare = (env.STAFF_COOKIE_DOMAIN || "").trim().replace(/^\./, "").toLowerCase();
  if (!bare) return undefined;
  const host = hostname.toLowerCase();
  return host === bare || host.endsWith(`.${bare}`) ? `.${bare}` : undefined;
}

/** Поставить метку; secure — по протоколу запроса (на http://localhost WebKit Secure не примет). */
export function staffCookie(hostname: string, https: boolean, env: Env = process.env): StaffCookie {
  const domain = staffCookieDomain(hostname, env);
  return {
    name: STAFF_COOKIE,
    value: STAFF_COOKIE_VALUE,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: https,
    maxAge: MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  };
}

/** Снять метку: тот же домен и путь, срок 0 — иначе браузер оставит прежнюю. */
export function staffCookieRemoval(hostname: string, https: boolean, env: Env = process.env): StaffCookie {
  return { ...staffCookie(hostname, https, env), value: "", maxAge: 0 };
}

/** Хост и протокол действия сервера: proxy Next и Netlify передают x-forwarded-*; без них — host. */
export function requestOrigin(headers: Headers): { hostname: string; https: boolean } {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return { hostname: host.split(",")[0]!.trim().replace(/:\d+$/, ""), https: proto === "https" };
}
