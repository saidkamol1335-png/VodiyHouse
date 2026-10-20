import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    exclude: ["node_modules", "tests/e2e/**", "docs/**"],
    projects: [
      {
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
