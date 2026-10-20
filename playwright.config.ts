import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Те же ключи, что у dev-сервера: с ними e2e кабинета идут против облака (tests/e2e/cloud.ts),
// без них — кабинет открыт без входа, облачные проверки пропускаются.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Размеры приёмки — CLAUDE.md: 390×844 (телефон) и 1440×900 (десктоп).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  // Тестовые сотрудники в облаке: создать до прогона, удалить после (без ключей — ничего).
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "ru-RU",
    timezoneId: "Asia/Tashkent",
  },
  projects: [
    // Вход руководителем, менеджером и видеографом — сессии для тестов кабинета (auth.setup.ts).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "mobile-390",
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "desktop-1440",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3000",
    url: `${BASE_URL}/uz`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
