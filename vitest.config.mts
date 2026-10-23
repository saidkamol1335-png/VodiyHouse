import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Ставит scripts/test-db-remote.mjs до загрузки конфига.
const REMOTE_DB = process.env.DB_TEST_TARGET === "remote";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    exclude: ["node_modules", "tests/e2e/**", "docs/**"],
    projects: [
      {
        // server-only в jsdom бросает исключение — серверные адаптеры тестируются с заглушкой.
        resolve: {
          alias: { "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)) },
        },
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}"],
        },
      },
      {
        // База: миграции и RLS в PGlite (Postgres в Node, без Docker) — решение фазы 1.
        // В облаке (npm run test:db:remote) каждый вызов от роли — около 12 запросов по сети до
        // Франкфурта, тяжёлые тесты идут минуты; тест, оборванный по таймауту, продолжал бы слать
        // запросы в то же соединение и ронял бы следующие.
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          testTimeout: REMOTE_DB ? 300_000 : 30_000,
          hookTimeout: REMOTE_DB ? 300_000 : 60_000,
        },
      },
    ],
  },
});
