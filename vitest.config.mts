import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

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
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
