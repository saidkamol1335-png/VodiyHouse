import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { isIndexingClosed, NOINDEX_HEADER } from "./lib/site/indexing";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Статичная оболочка страницы + потоковые динамические части (PLAN 3а: страницы ЖК статичные).
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Значок Next.js в углу закрывает контент на скриншотах для сверки с мокапом; ошибки dev-оверлей покажет и без него.
  devIndicators: false,
  // В разработке Next.js пишет в терминал аргументы Server Actions — а это пароли входа и сотрудников.
  logging: { serverFunctions: false },
  async headers() {
    return [
      // Тестовый деплой (Ф2) — noindex на каждом ответе, и страницах, и картинках.
      ...(isIndexingClosed() ? [{ source: "/:path*", headers: [NOINDEX_HEADER] }] : []),
      {
        // Кабинет не открывается во фрейме чужого сайта (кликджекинг) и не отдаёт адрес наружу.
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
