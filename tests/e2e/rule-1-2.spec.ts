import { expect, test } from "@playwright/test";
import { hasCloud } from "./cloud";
import { PUBLIC_PAGES } from "./helpers";

// Правило ТЗ 1.2: в публичной части нет ни одного контакта застройщика.
// Разрешены только контакты Vodiy House — их пока нет (TODO-заказчик), список пуст.
const ALLOWED_VODIY_HOUSE_CONTACTS: readonly string[] = [];

const CONTACT_LINK = /href="(tel:|mailto:|https?:\/\/(t\.me|wa\.me|api\.whatsapp\.com|instagram\.com|www\.instagram\.com)\/)[^"]*"/gi;
const UZ_PHONE = /\+?998[\s\-()]*\d{2}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/g;

// Каталог и страницы ЖК (шаги 3.4, 3.5) — на DEMO из облака: застройщик там названием, без связи.
const CLOUD_PAGES = ["/ru/novostroyki", "/ru/novostroyki/demo-shodlik", "/uz/novostroyki/demo-namuna"];

test.describe("правило ТЗ 1.2", () => {
  for (const path of [...PUBLIC_PAGES, ...(hasCloud ? CLOUD_PAGES : [])]) {
    test(`${path}: нет чужих ссылок на телефон, Telegram, WhatsApp, email`, async ({ page }) => {
      await page.goto(path);
      const htmlText = await page.content();
      const links = (htmlText.match(CONTACT_LINK) ?? []).filter(
        (link) => !ALLOWED_VODIY_HOUSE_CONTACTS.some((allowed) => link.includes(allowed)),
      );
      expect(links).toEqual([]);
    });

    test(`${path}: нет номеров телефонов +998 в тексте`, async ({ page }) => {
      await page.goto(path);
      const text = await page.locator("body").innerText();
      const phones = (text.match(UZ_PHONE) ?? []).filter(
        (phone) => !ALLOWED_VODIY_HOUSE_CONTACTS.some((allowed) => phone.includes(allowed)),
      );
      expect(phones).toEqual([]);
    });
  }
});
