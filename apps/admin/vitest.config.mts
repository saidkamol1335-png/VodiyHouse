import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: "admin",
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
