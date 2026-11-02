import type { NextConfig } from "next";
import { securityHeaders } from "./lib/securityHeaders";

// Кабинет admin.vodiyhouse.uz (PLAN §10): отдельное приложение, свой деплой и свои env.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Server Actions кабинета принимают пароли — их аргументы не пишутся в терминал.
  logging: { serverFunctions: false },
  async headers() {
    const headers = securityHeaders({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      isDev: process.env.NODE_ENV === "development",
    });
    return [{ source: "/:path*", headers }];
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

export default nextConfig;
