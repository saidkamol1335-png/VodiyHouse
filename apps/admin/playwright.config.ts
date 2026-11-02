import { defineConfig, devices } from "@playwright/test";

// Кабинет на своём dev-сервере (порт 3001), рядом с сайтом на 3000. Размеры — как у сайта
// (CLAUDE.md «Фаза принята»): 390×844 и 1440×900.
const BASE_URL = process.env.ADMIN_E2E_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile-390",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 },
    },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${BASE_URL}/vhod`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
