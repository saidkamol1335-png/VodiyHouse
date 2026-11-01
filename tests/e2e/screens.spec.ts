import { expect, test, type Page, type TestInfo } from "./fixtures";
import { cabinetState } from "./cloud";
import { collectPageErrors } from "./helpers";

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

// caret: "initial" — по умолчанию Playwright прячет курсор полей стилем caret-color на каждом
// input; снимок до гидратации (холодный Turbopack) давал «hydration mismatch» на страницах с
// полями (/admin/vhod, /dev/parol). Ожидание networkidle его не спасало (PROGRESS, 22.10.2026).
async function shoot(page: Page, testInfo: TestInfo, name: string, path: string) {
  const errors = collectPageErrors(page);
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}/${name}.png`,
    fullPage: true,
    caret: "initial",
  });
  expect(errors).toEqual([]);
}

for (const [name, path] of PAGES) {
  test(`скриншот ${name}`, ({ page }, testInfo) =>
    shoot(page, testInfo, name, path));
}

test.describe("кабинет", () => {
  test.use({ storageState: cabinetState("head") });
  for (const [name, path] of CABINET_PAGES) {
    test(`скриншот ${name}`, ({ page }, testInfo) =>
      shoot(page, testInfo, name, path));
  }
});
