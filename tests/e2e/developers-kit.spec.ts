import { expect, test, type Page } from "@playwright/test";
import { collectPageErrors, imageFile } from "./helpers";

// Шаг 10.2 фазы 1: «Застройщики» на служебном стенде (/dev/zastroyshchiki, DEMO мокапа) —
// список Д1, создание, статус и архив, вкладки Д2–Д5. Те же компоненты, что у /admin/zastroyshchiki;
// действия стенда — настоящие проверки форм без базы (как /dev/staff).

const LIST = "/dev/zastroyshchiki";
const SIFAT = `${LIST}/00000000-0000-4000-8000-0000000000d1`;
const NAVROZ = `${LIST}/00000000-0000-4000-8000-0000000000d4`;

// Ошибка под зоной загрузки. Просто getByRole("alert") нельзя: в разработке Next.js держит
// на странице свой alert — объявление переходов.
const issueOf = (page: Page, inputId: string) =>
  page
    .locator(".media-drop")
    .filter({ has: page.locator(`#${inputId}`) })
    .getByRole("alert");

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Плашка ответа формы (role=status / role=alert) внутри формы, а не объявление Next.js. */
const formStatus = (page: Page, text: string | RegExp) =>
  page.locator(".form-status").filter({ hasText: text });

test.describe("кабинет · застройщики", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = collectPageErrors(page);
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("список: пилюли со счётчиками, «Все» без архива, поиск без апострофа", async ({ page }) => {
    await page.goto(LIST);
    const rows = page.locator(".developer-list__row");
    const filters = page.getByRole("group", { name: "Статус" });
    await expect(rows).toHaveCount(5);
    await expect(filters.getByRole("button", { name: /Все/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(filters.getByRole("button", { name: /Опубликованы/ })).toContainText("3");

    await page.getByLabel("Поиск застройщика").fill("fargona");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Farg‘ona Sifat Qurilish");
    await expect(rows.first()).toContainText("1 ЖК · сдано 2 140 кв. · проверено 14.09.2026");

    await page.getByLabel("Поиск застройщика").fill("");
    await filters.getByRole("button", { name: /Архив/ }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Yangi Makon");
    await expect(rows.first()).toContainText("удалится 11.11.2026");
    await expect(rows.first()).toContainText("В архиве");
  });

  test("строка ведёт на страницу застройщика", async ({ page }) => {
    await page.goto(LIST);
    await page.getByRole("link", { name: "Открыть Marg‘ilon Invest" }).click();
    await expect(page).toHaveURL(`${LIST}/00000000-0000-4000-8000-0000000000d2`);
    await expect(page.getByRole("heading", { name: "Marg‘ilon Invest" })).toBeVisible();
  });

  test("«+ Добавить застройщика»: проверка названия → страница черновика", async ({ page }) => {
    await page.goto(LIST);
    await page.getByRole("button", { name: "Добавить застройщика" }).click();
    const name = page.getByLabel("Название");
    await page.getByRole("button", { name: "Создать черновик" }).click();
    await expect(page.getByText("Заполните поле")).toBeVisible();
    await name.fill("F");
    await page.getByRole("button", { name: "Создать черновик" }).click();
    await expect(page.getByText("Не короче 2 символов")).toBeVisible();
    await name.fill("Yangi Qurilish");
    await page.getByRole("button", { name: "Создать черновик" }).click();
    await expect(page).toHaveURL(NAVROZ);
  });

  test("вкладки — отдельные адреса, «назад» работает", async ({ page }) => {
    await page.goto(SIFAT);
    const tabs = page.getByRole("navigation", { name: "Разделы застройщика" });
    await expect(tabs.getByRole("link", { name: "Основное" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const [name, path] of [
      ["Сданные объекты", "obyekty"],
      ["Внутреннее", "vnutrennee"],
      ["Журнал", "zhurnal"],
    ]) {
      await tabs.getByRole("link", { name }).click();
      await expect(page).toHaveURL(`${SIFAT}/${path}`);
      await expect(tabs.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    }
    await page.goBack();
    await expect(page).toHaveURL(`${SIFAT}/vnutrennee`);
  });

  test("статус: скрыть; архив — только с верным названием", async ({ page }) => {
    await page.goto(SIFAT);
    const status = page.getByRole("form", { name: "Статус на сайте" });
    await expect(status.getByText("Опубликован", { exact: true })).toBeVisible();
    await status.getByRole("button", { name: "Скрыть с сайта" }).click();
    await expect(formStatus(page, "Скрыт с сайта")).toBeVisible();

    await status.getByRole("button", { name: "В архив" }).click();
    await expect(page.getByText("Отправить в архив?")).toBeVisible();
    await page.getByLabel("Чтобы подтвердить, введите название").fill("Farg‘ona");
    await page.getByRole("button", { name: "Да, в архив" }).click();
    await expect(formStatus(page, "Название введено не так")).toBeVisible();
    await page.getByLabel("Чтобы подтвердить, введите название").fill("farg'ona sifat qurilish");
    await page.getByRole("button", { name: "Да, в архив" }).click();
    await expect(formStatus(page, "Отправлен в архив")).toBeVisible();
  });

  test("публикация черновика: логотип и фон по правилу 1.2, потом — чего не хватает", async ({
    page,
  }) => {
    await page.goto(NAVROZ);
    await page.getByRole("button", { name: "Опубликовать" }).click();
    const panel = page.locator(".publish-check");
    await expect(panel).toContainText("Опубликовать застройщика?");
    const submit = panel.getByRole("button", { name: "Опубликовать на сайте" });
    await expect(submit).toBeDisabled();
    await panel.getByRole("checkbox").check();
    await submit.click();
    await expect(
      formStatus(page, "Чтобы опубликовать, добавьте: текст «О компании» на двух языках · логотип"),
    ).toBeVisible();
  });

  test("«Основное»: RU и UZ рядом на десктопе, друг под другом на телефоне", async ({
    page,
  }, testInfo) => {
    await page.goto(SIFAT);
    const ru = (await page.getByLabel("О компании · RU").boundingBox())!;
    const uz = (await page.getByLabel("Kompaniya haqida · UZ").boundingBox())!;
    if (testInfo.project.name === "desktop-1440") {
      expect(Math.abs(ru.y - uz.y)).toBeLessThan(2);
      expect(uz.x).toBeGreaterThan(ru.x + ru.width);
    } else {
      expect(uz.y).toBeGreaterThan(ru.y + ru.height);
    }
    await expect(page.getByText("Адрес на сайте: /zastroyshchiki/demo-sifat")).toBeVisible();
  });

  test("«Основное»: ошибки по полям, перевод подсвечивается, потом «Сохранено»", async ({
    page,
  }) => {
    await page.goto(SIFAT);
    // Ввод до гидратации React не увидит (холодный кэш Turbopack: 22.10.2026, дважды) — ждём загрузку.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Основатели · RU").fill("Инженеры-строители");
    await expect(page.getByText("Нужен текст на узбекском")).toBeVisible();
    await page.getByLabel("Год основания").fill("1890");
    // Правило 1.2: контакт в «О компании» — ошибка под парой полей, с причиной.
    await page.getByLabel("О компании · RU").fill("Звоните +998 90 123 45 67");
    await page.getByLabel("Kompaniya haqida · UZ").fill("2012 yildan beri quradi.");
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(page.getByText("Проверьте число")).toBeVisible();
    await expect(formStatus(page, "Проверьте поля и сохраните ещё раз")).toBeVisible();
    await expect(page.locator("#developer-about-error")).toContainText("В тексте контакты");
    // Пустой перевод «Основателей» — тоже под своей парой, а не только общим итогом.
    await expect(page.locator("#developer-founders-error")).toHaveText("Нужен текст на узбекском");
    await expect(page.getByLabel("О компании · RU")).toHaveAttribute("aria-invalid", "true");
    // Введённое не потерялось после отказа сервера.
    await expect(page.getByLabel("Основатели · RU")).toHaveValue("Инженеры-строители");

    await page.getByLabel("О компании · RU").fill("Строит с 2012 года.");
    await page.getByLabel("Год основания").fill("2012");
    await page.getByLabel("Asoschilar · UZ").fill("Quruvchi muhandislar");
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(formStatus(page, "Сохранено")).toBeVisible();
  });

  test("логотип: плитка «+», превью, удаление; маленький — понятная ошибка", async ({ page }) => {
    await page.goto(SIFAT);
    const logo = page.locator("#developer-logo");
    // Застройщик опубликован: файл сразу на сайте — сначала отметка правила 1.2 (И8).
    await expect(logo).toBeDisabled();
    await page.getByRole("checkbox", { name: /Правило 1.2/ }).check();
    await logo.setInputFiles(await imageFile(page, { width: 300, height: 300, type: "image/png" }));
    await expect(issueOf(page, "developer-logo")).toHaveText(/300 px .*от 400 px/);
    await logo.setInputFiles(await imageFile(page, { width: 800, height: 800, type: "image/png" }));
    await expect(issueOf(page, "developer-logo")).toHaveCount(0);
    await expect(page.locator(".media-drop__tile-image")).toBeVisible();
    // Отметка — на одну загрузку (И8): следующий файл — с новой отметкой, «Удалить» доступно и так.
    await expect(page.getByRole("checkbox", { name: /Правило 1.2/ })).not.toBeChecked();
    await expect(logo).toBeDisabled();
    await page.getByRole("button", { name: "Удалить" }).click();
    await expect(page.getByTestId("developer-logo-pick")).toBeVisible();
  });

  test("фон: точка фокуса и три кадра", async ({ page }) => {
    await page.goto(SIFAT);
    const cover = page.locator("#developer-cover");
    await page.getByRole("checkbox", { name: /Правило 1.2/ }).check();
    await cover.setInputFiles(
      await imageFile(page, { width: 1200, height: 800, type: "image/jpeg" }),
    );
    await expect(issueOf(page, "developer-cover")).toHaveText(/1200 px .*от 2400 px/);
    await cover.setInputFiles(
      await imageFile(page, { width: 3000, height: 2000, type: "image/jpeg" }),
    );
    for (const frame of ["cover", "card", "phone"])
      await expect(page.getByTestId(`frame-${frame}`)).toBeVisible();
    const stage = page.getByTestId("focus-stage");
    const box = (await stage.boundingBox())!;
    await stage.click({ position: { x: box.width - 2, y: box.height / 2 } });
    await expect(page.getByTestId("frame-phone")).toHaveCSS("object-position", "100% 50%");
  });

  test("сданные объекты: плашки, порядок стрелками, пустая строка не сохраняется", async ({
    page,
  }) => {
    await page.goto(`${SIFAT}/obyekty`);
    const rows = page.getByTestId("project-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByTestId("project-status")).toHaveText("Сдан в срок");
    await expect(rows.nth(1).getByTestId("project-status")).toHaveText("Перенос на 3 мес.");

    await rows
      .nth(0)
      .getByRole("button", { name: /Перетащите, чтобы поменять порядок/ })
      .press("ArrowDown");
    await expect(rows.nth(0)).toContainText("Перенос на 3 мес.");
    await expect(rows.nth(1).getByRole("button", { name: /Мустакиллик, 14/ })).toBeFocused();

    await page.getByRole("button", { name: "Добавить объект" }).click();
    await expect(rows).toHaveCount(3);
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(rows.nth(2).getByText("Заполните поле")).toBeVisible();
    await rows.nth(2).getByRole("button", { name: "Удалить объект" }).click();
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(formStatus(page, "Сохранено")).toBeVisible();
  });

  test("внутреннее: контакты и заметки сохраняются вкладкой", async ({ page }) => {
    await page.goto(`${SIFAT}/vnutrennee`);
    await expect(page.getByText("на сайт не попадает никогда")).toBeVisible();
    await page.getByLabel("Контакты застройщика").fill("Отдел продаж\nTelegram DEMO");
    await page.getByRole("button", { name: "Сохранить вкладку" }).click();
    await expect(formStatus(page, "Сохранено")).toBeVisible();
  });

  test("журнал: кто, когда, что было и что стало", async ({ page }) => {
    await page.goto(`${SIFAT}/zhurnal`);
    const entries = page.locator(".journal-list__entry");
    await expect(entries).toHaveCount(6);
    await expect(entries.first()).toContainText("Изменено");
    await expect(entries.first()).toContainText("«Есть сданные объекты»");
    await expect(entries.first()).toContainText("02.06.2026 → 14.09.2026");
    await expect(entries.first()).toContainText("Бахтиёр Каримов");
    await expect(entries.nth(3)).toContainText("Черновик → Опубликован");
    await expect(entries.last()).toContainText("Система");
  });

  test("страницы не шире экрана", async ({ page }) => {
    for (const path of [
      LIST,
      SIFAT,
      `${SIFAT}/obyekty`,
      `${SIFAT}/vnutrennee`,
      `${SIFAT}/zhurnal`,
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await noHorizontalScroll(page), path).toBe(0);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`скриншоты · ${theme}`, async ({ page }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("vh-theme", value), theme);
      const folder = `test-results/screens/${testInfo.project.name}`;
      for (const [name, path] of [
        ["list", LIST],
        ["main", SIFAT],
        ["projects", `${SIFAT}/obyekty`],
        ["journal", `${SIFAT}/zhurnal`],
      ] as const) {
        await page.goto(path);
        // Снимок до гидратации прячет курсор в полях раньше React, и тот видит чужую разметку.
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          caret: "initial",
          path: `${folder}/s10-developers-${name}-${theme}.png`,
          fullPage: true,
        });
      }
    });
  }
});
