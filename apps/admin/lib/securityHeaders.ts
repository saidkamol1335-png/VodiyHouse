// Заголовки безопасности кабинета (PLAN §10): закрыт от поиска и фреймов, адрес не уходит наружу.
// CSP со своим nonce на каждый запрос (фаза F, п. 45; docs Next.js «Content Security Policy»): её
// ставит proxy.ts — и в запрос (Next берёт оттуда nonce для своих скриптов), и в ответ. Здесь, в
// next.config, — остальные заголовки: вторая CSP сузила бы первую и спрятала бы настоящую политику.

type Header = { key: string; value: string };

/** Источник Supabase для картинок, API и Realtime; без адреса облака — только свой хост. */
function supabaseOrigins(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return [];
  const url = new URL(supabaseUrl);
  const ws = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
  return [url.origin, ws];
}

/**
 * script-src: только скрипты с nonce и те, что они подгрузили сами ('strict-dynamic' — Turnstile на
 * входе, чанки Next); адрес Cloudflare — запас для браузеров без CSP3. style-src остаётся
 * 'unsafe-inline': с nonce браузер отбросил бы style="…" из серверной разметки (графики, превью).
 */
export function contentSecurityPolicy(options: { supabaseUrl?: string; isDev: boolean; nonce: string }): string {
  const supabase = supabaseOrigins(options.supabaseUrl);
  const httpSupabase = supabase.slice(0, 1);
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' blob: data:", ...httpSupabase].join(" "),
    "font-src 'self'",
    ["connect-src 'self'", ...supabase].join(" "),
    ["media-src 'self' blob:", ...httpSupabase].join(" "),
    // Turnstile на входе — во фрейме Cloudflare.
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

/** Заголовок запроса с nonce для layout (скрипт в <head>); читают его — страница динамическая. */
export const NONCE_HEADER = "x-nonce";

/** Новый nonce на запрос: 128 бит случайности в base64. */
export const createNonce = () => btoa(crypto.randomUUID());

export function securityHeaders(): Header[] {
  return [
    // Кабинет не индексируется никогда — не только на тестовом деплое.
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "X-Frame-Options", value: "DENY" },
  ];
}
