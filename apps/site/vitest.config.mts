import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Тесты сайта — модули и компоненты. Тесты базы (миграции, RLS, функции site_*) — в apps/admin:
// схемой и данными владеет админка (PLAN §10).
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // server-only в jsdom бросает исключение — серверные адаптеры тестируются с заглушкой.
    alias: { "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)) },
  },
  test: {
    name: "unit",
    environment: "jsdom",
    include: ["lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "tests/unit/**/*.test.ts"],
    exclude: ["node_modules", "tests/e2e/**", "docs/**"],
  },
});
