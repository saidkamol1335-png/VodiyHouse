import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Те же ключи, что у dev-сервера: с ними e2e кабинета идут против облака (tests/e2e/cloud.ts),
// без них — кабинет открыт без входа, облачные проверки пропускаются.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** E2E_PORT — прогон против другого сервера (например, прод-сборки на 3010). */
const PORT = Number(process.env.E2E_PORT) || 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Приёмка 3а (PLAN, 3.14): публичный сайт ещё на 360 и 768 и в WebKit — по запросу, не в каждом
// прогоне (`npm run e2e:extra`; WebKit — `npx playwright test --project=webkit-390` после
// `npx playwright install webkit`).
const SITE_SPECS = /(home|blueprint-hero|quiz|picker|catalog|complex-page|pages|header|footer|leads|events|seo-meta|rule-1-2|site-calc-view)\.spec\.ts/;
const EXTRA_PROJECTS = [
  { name: "mobile-360", dependencies: ["setup"], testMatch: SITE_SPECS, use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 } },
  { name: "tablet-768", dependencies: ["setup"], testMatch: SITE_SPECS, use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 } },
];
const WEBKIT_PROJECTS = [
  { name: "webkit-390", dependencies: ["setup"], testMatch: SITE_SPECS, use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
];
// Запуск с --project=mobile-360 / tablet-768 / webkit-390 включает их сам (и на Windows, без «VAR=1 …»);
// через окружение флаг доходит и до воркеров — они читают этот же файл.
for (const [flag, names] of [["E2E_EXTRA", EXTRA_PROJECTS], ["E2E_WEBKIT", WEBKIT_PROJECTS]] as const) {
  if (names.some(({ name }) => process.argv.some((arg) => arg.includes(name)))) process.env[flag] = "1";
}
const extraProjects = [
  ...(process.env.E2E_EXTRA === "1" ? EXTRA_PROJECTS : []),
  ...(process.env.E2E_WEBKIT === "1" ? WEBKIT_PROJECTS : []),
];

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
    // Вход руководителем, менеджером и видеографом — сессии для тестов кабинета (auth.setup.ts).
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
    ...extraProjects,
  ],
  webServer: {
    command: "npm run dev -- --port 3000",
    url: `${BASE_URL}/uz`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
