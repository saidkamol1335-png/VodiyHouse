import { test } from "@playwright/test";

// Скриншоты для сверки с мокапом (docs/mockup/screens/): test-results/screens/<проект>/.
// Сверка глазами по чек-листу фазы; визуальная регрессия — когда разделы утверждены.
const PAGES = [
  ["home-uz", "/uz"],
  ["home-ru", "/ru"],
  ["admin", "/admin"],
  ["dev-preview", "/dev/preview"],
] as const;

for (const [name, path] of PAGES) {
  for (const theme of ["light", "dark"] as const) {
    test(`скриншот ${name} · ${theme}`, async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `test-results/screens/${testInfo.project.name}/${name}-${theme}.png`,
        fullPage: true,
      });
    });
  }
}
