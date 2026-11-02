import { hasSupabaseAdminEnv, supabasePublicEnv, supabaseSecretKey } from "./env";

// Лимиты Supabase Auth считаются по IP (docs: guides/auth/rate-limits). Кабинет ходит в Auth
// с сервера, и без пересылки все сотрудники делили бы один лимит на IP сервера: поддельные cookie
// или 30 неверных паролей снаружи выкидывали бы и не пускали своих. Заголовок Sb-Forwarded-For
// Auth принимает только с секретным ключом sb_secret_… и только при включённом в проекте
// Authentication → Rate Limits → IP Address Forwarding; иначе считает по IP сервера, как раньше.
// Без server-only: модуль нужен и proxy (тесты proxySession подменяют только @supabase/ssr).

/** IP посетителя на Netlify. x-forwarded-for посетитель подделывает — его не берём. */
export const CLIENT_IP_HEADER = "x-nf-client-connection-ip";
const FORWARDED_FOR_HEADER = "sb-forwarded-for";
const SECRET_KEY_PREFIX = "sb_secret_";
// Только запросы сотрудника: вход, обновление сессии, свой пользователь, выход. Admin API
// (/auth/v1/admin/…) не трогаем: публичный клиент не должен получить права секретного ключа.
const FORWARDED_AUTH_PATHS = ["/auth/v1/token", "/auth/v1/user", "/auth/v1/logout"];

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-f:.]{2,45}$/i;

/** Первый адрес из заголовка или null: мусор в Auth не отправляем. */
export function parseClientIp(value: string | null | undefined): string | null {
  const ip = value?.split(",")[0]?.trim() ?? "";
  const v4 = IPV4.exec(ip);
  if (v4) return v4.slice(1).every((part) => Number(part) <= 255) ? ip : null;
  return ip.includes(":") && IPV6.test(ip) ? ip : null;
}

export function clientIpFrom(headers: Pick<Headers, "get">): string | null {
  return parseClientIp(headers.get(CLIENT_IP_HEADER));
}

export type AuthForwardingOptions = {
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  clientIp: string;
  fetch?: typeof fetch;
};

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

/** fetch клиента Supabase: запросы сотрудника к Auth — с секретным ключом и IP посетителя, остальное — без изменений. */
export function authForwardingFetch(options: AuthForwardingOptions): typeof fetch {
  const base = options.fetch ?? fetch;
  const prefixes = FORWARDED_AUTH_PATHS.map((path) => new URL(path, options.supabaseUrl).href);
  return (input, init) => {
    const url = requestUrl(input);
    if (!prefixes.some((prefix) => url === prefix || url.startsWith(`${prefix}?`)))
      return base(input, init);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("apikey", options.secretKey);
    // Без токена сотрудника auth-js шлёт ключ клиента как Bearer — меняем, как у клиента
    // с секретным ключом из примера docs. Токен сотрудника (/user, /logout) не трогаем.
    if (headers.get("authorization") === `Bearer ${options.publishableKey}`) {
      headers.set("authorization", `Bearer ${options.secretKey}`);
    }
    headers.set(FORWARDED_FOR_HEADER, options.clientIp);
    return base(input, { ...init, headers });
  };
}

/** Опция global.fetch для серверного клиента; без IP или без ключа sb_secret_ — пусто (как раньше). */
export function authForwardingOption(clientIp: string | null): {
  global?: { fetch: typeof fetch };
} {
  if (!clientIp || !hasSupabaseAdminEnv()) return {};
  const secretKey = supabaseSecretKey();
  // Старый ключ service_role Auth для пересылки не принимает (docs) — не тратим его зря.
  if (!secretKey.startsWith(SECRET_KEY_PREFIX)) return {};
  const { url, publishableKey } = supabasePublicEnv();
  return {
    global: {
      fetch: authForwardingFetch({ supabaseUrl: url, publishableKey, secretKey, clientIp }),
    },
  };
}
