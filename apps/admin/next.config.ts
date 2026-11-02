import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./lib/securityHeaders";

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
  // Кабинет admin.vodiyhouse.uz (PLAN §10): noindex, запрет фреймов и CSP на каждом ответе.
  async headers() {
    const headers = securityHeaders({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      isDev: process.env.NODE_ENV === "development",
    });
    return [{ source: "/:path*", headers }];
  },
  experimental: {
    // Несколько корневых layout (кабинет, /dev) — общий 404 собирается отдельно.
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
