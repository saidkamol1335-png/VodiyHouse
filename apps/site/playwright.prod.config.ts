import { defineConfig, devices } from "@playwright/test";

// Проверка прода «нет вымышленных данных» (docs/prod-check.md): только чтение. Без global-setup
// (не создаёт сотрудников), без dev-сервера, .env.local не читает; браузер не отправляет ни одного
// POST — заявки, события и Server Actions обрываются (tests/prod/no-fiction.spec.ts).
//   PROD_URL=https://<сайт>.netlify.app npx playwright test -c playwright.prod.config.ts
// PROD_ALLOWED_PHONES — номер Vodiy House из «Настройки → Контакты» (через запятую), если задан.
const PROD_URL = process.env.PROD_URL;
if (!PROD_URL)
  throw new Error("PROD_URL не задан: адрес прода, например https://vodiyhouse-prod.netlify.app");

export default defineConfig({
  testDir: "tests/prod",
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/prod",
  use: {
    baseURL: PROD_URL,
    trace: "off",
    locale: "ru-RU",
    timezoneId: "Asia/Tashkent",
    // Запросы Service Worker обошли бы page.route — запрещаем.
    serviceWorkers: "block",
  },
  projects: [
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
