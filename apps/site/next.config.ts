import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { isIndexingClosed, NOINDEX_HEADER } from "./lib/site/indexing";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

// Фото ЖК и застройщиков — публичный бакет media проекта Supabase (lib/media/path.ts). Без ключей
// облака адреса нет — и фото с сайта тоже нет. Локальный Supabase (`npx supabase start`) — http на
// 127.0.0.1: только для разработки, облако всегда https.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function supabaseHost(): URL | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Netlify без адреса облака в окружении сборки собрал бы сайт, где каждое фото — 400: лучше не собрать.
  if (!url && process.env.NETLIFY === "true") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL нет в окружении сборки Netlify — фото сайта не загрузятся");
  }
  return url ? new URL(url) : null;
}

function supabaseMediaPattern(): { protocol: "https" | "http"; hostname: string; port?: string; pathname: string }[] {
  const url = supabaseHost();
  if (!url) return [];
  const local = LOCAL_HOSTS.has(url.hostname);
  return [{
    protocol: local ? "http" : "https",
    hostname: url.hostname,
    ...(local ? { port: url.port } : {}),
    pathname: "/storage/v1/object/public/media/**",
  }];
}

const isLocalSupabase = LOCAL_HOSTS.has(supabaseHost()?.hostname ?? "");

// Проверка безопасности 29.10: заголовки на всех ответах, не только в кабинете. Страницы с формой заявки
// не открываются во фрейме чужого сайта; HSTS — без includeSubDomains (поддомены домена заказчика
// нам неизвестны), браузер учитывает его только по https. Полная CSP (script-src с nonce) — после запуска.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  // Статичная оболочка страницы + потоковые динамические части (PLAN 3а: страницы ЖК статичные).
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Значок Next.js в углу закрывает контент на скриншотах для сверки с мокапом; ошибки dev-оверлей покажет и без него.
  devIndicators: false,
  // В разработке Next.js пишет в терминал аргументы Server Actions — а это пароли входа и сотрудников.
  logging: { serverFunctions: false },
  // next/image: WebP / AVIF под размер экрана (на Netlify — Image CDN), фото — только из своего бакета.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseMediaPattern(),
    // Next 16 не оптимизирует картинки с локальных адресов; разрешено только для локального Supabase.
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  async headers() {
    return [
      // Тестовый деплой (Ф2) — noindex на каждом ответе, и страницах, и картинках.
      ...(isIndexingClosed() ? [{ source: "/:path*", headers: [NOINDEX_HEADER] }] : []),
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // Кабинет строже: ни в каком фрейме, адрес не уходит наружу. Правило ниже общего — с тем же
        // заголовком побеждает последнее (docs Next.js, headers).
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  experimental: {
    // Несколько корневых layout (/[locale], /admin, /dev) — общий 404 собирается отдельно.
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
