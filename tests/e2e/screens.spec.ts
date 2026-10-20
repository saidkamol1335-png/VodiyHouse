import { test, type Page, type TestInfo } from "@playwright/test";
import { cabinetState } from "./cloud";

// Скриншоты для сверки с мокапом (docs/mockup/screens/): test-results/screens/<проект>/.
// Сверка глазами по чек-листу фазы; визуальная регрессия — когда разделы утверждены.
const PAGES = [
  ["home-uz", "/uz"],
  ["home-ru", "/ru"],
  ["admin-login", "/admin/vhod"],
  ["dev-preview", "/dev/preview"],
  ["dev-staff", "/dev/staff"],
  ["dev-parol", "/dev/parol"],
] as const;

// Разделы кабинета: без ключей открыты без входа, с ключами — сессия руководителя.
const CABINET_PAGES = [
  ["admin", "/admin"],
  ["admin-settings", "/admin/nastroyki"],
] as const;

async function shoot(page: Page, testInfo: TestInfo, name: string, path: string, theme: "light" | "dark") {
  await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `test-results/screens/${testInfo.project.name}/${name}-${theme}.png`, fullPage: true });
}

for (const [name, path] of PAGES) {
  for (const theme of ["light", "dark"] as const) {
    test(`скриншот ${name} · ${theme}`, ({ page }, testInfo) => shoot(page, testInfo, name, path, theme));
  }
}

test.describe("кабинет", () => {
  test.use({ storageState: cabinetState("head") });
  for (const [name, path] of CABINET_PAGES) {
    for (const theme of ["light", "dark"] as const) {
      test(`скриншот ${name} · ${theme}`, ({ page }, testInfo) => shoot(page, testInfo, name, path, theme));
    }
  }
});
