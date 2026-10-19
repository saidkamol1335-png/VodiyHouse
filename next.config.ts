import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Статичная оболочка страницы + потоковые динамические части (PLAN 3а: страницы ЖК статичные).
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Значок Next.js в углу закрывает контент на скриншотах для сверки с мокапом; ошибки dev-оверлей покажет и без него.
  devIndicators: false,
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
