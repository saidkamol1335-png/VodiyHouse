// Заголовки безопасности кабинета (PLAN §10): закрыт от поиска и фреймов, адрес не уходит наружу.
// CSP без nonce (docs Next.js, «Content Security Policy → Without Nonces»); script-src с nonce —
// в фазе D, вместе с proxy кабинета.

type Header = { key: string; value: string };

/** Источник Supabase для картинок, API и Realtime; без адреса облака — только свой хост. */
function supabaseOrigins(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return [];
  const url = new URL(supabaseUrl);
  const ws = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
  return [url.origin, ws];
}

export function contentSecurityPolicy(options: { supabaseUrl?: string; isDev: boolean }): string {
  const supabase = supabaseOrigins(options.supabaseUrl);
  const httpSupabase = supabase.slice(0, 1);
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
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

export function securityHeaders(options: { supabaseUrl?: string; isDev: boolean }): Header[] {
  return [
    // Кабинет не индексируется никогда — не только на тестовом деплое.
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
  ];
}
