import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Те же ключи, что у dev-сервера: с ними e2e кабинета идут против облака (tests/e2e/cloud.ts),
// без них — кабинет открыт без входа, облачные проверки пропускаются.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** E2E_PORT — прогон против другого сервера кабинета (например, прод-сборки). */
const PORT = Number(process.env.E2E_PORT) || 3001;
const BASE_URL = `http://localhost:${PORT}`;
// Сайт рядом (PLAN §10): спеки «кабинет поменял — сайт показал» открывают его по E2E_SITE_URL.
// Порт 3000 на ноутбуке занят системой — сайт на 3002.
const SITE_PORT = Number(process.env.E2E_SITE_PORT) || 3002;
const SITE_URL = `http://localhost:${SITE_PORT}`;
process.env.E2E_SITE_URL = SITE_URL;

// Живой статус (фаза 4, picker.spec): бронь в кабинете на ~25 с меняет счётчики DEMO, которые
// проверяют соседние спеки, — тест идёт, только когда picker.spec запущен отдельно.
if (process.argv.some((arg) => arg.includes("picker.spec")) && !process.argv.some((arg) => /.spec.ts$/.test(arg) && !arg.includes("picker.spec"))) {
  process.env.E2E_LIVE = "1";
}

// Размеры приёмки — CLAUDE.md: 390×844 (телефон) и 1440×900 (десктоп).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Узкое место — один dev-сервер, а не браузеры: 16 воркеров (половина ядер) при фоновой нагрузке
  // на машину растягивали переходы дольше 5 с, 8 — так же быстро и без сбоев (22.10.2026).
  workers: 8,
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
    // Вход руководителем, менеджером и мобилографом — сессии для тестов кабинета (auth.setup.ts).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "mobile-390",
      dependencies: ["setup"],
      // Спеки без телефонной раскладки и скриншотов: на 390 они повторяли бы 1440 (CLAUDE.md, 25.10.2026).
      // Спеке с веткой для телефона или скриншотом — место не здесь.
      testIgnore: [
        /auth\.spec\.ts/,
        /staff\.spec\.ts/,
        /client-calc\.spec\.ts/,
        /complexes-kit\.spec\.ts/,
        /complexes-content\.spec\.ts/,
        /complexes-facade\.spec\.ts/,
        /complex-preview\.spec\.ts/,
        /programs\.spec\.ts/,
        /seo-meta\.spec\.ts/,
        /showcase\.spec\.ts/,
        /site-calc\.spec\.ts/,
        /smoke\.spec\.ts/,
      ],
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
  webServer: [
    { command: `npm run dev -- --port ${PORT}`, url: `${BASE_URL}/vhod`, reuseExistingServer: true, timeout: 180_000 },
    {
      command: `npm run dev -w @vh/site -- --port ${SITE_PORT}`,
      url: `${SITE_URL}/uz`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
