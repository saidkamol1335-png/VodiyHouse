import { expect, test } from "./fixtures";
import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { hasCloud, NO_CLOUD } from "./cloud";
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

// Приёмка 3а (PLAN, 3.14): правило 1.2, «нет скидок» и внутренние поля — по HTML всех публичных
// страниц, вместе с данными для React (RSC): страницы — из sitemap.xml, плюс избранное и подборка.
// Внутренние контакты и заметки застройщиков (developer_private) ставим меткой прямо в базу.
const PRIVATE_MARK = "e2e-private-7f3a";
const DISCOUNT = /скидк|chegirma|discount/i;

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

test.describe("приёмка 3а: HTML публичных страниц", () => {
  test.skip(!hasCloud || !process.env.SUPABASE_DB_URL, NO_CLOUD);
  let saved: { developer_id: string; contacts: string; notes: string }[] = [];

  test.beforeAll(() =>
    withDb(async (client) => {
      saved = (await client.query("select developer_id, contacts, notes from developer_private")).rows;
      await client.query(
        `insert into developer_private (developer_id, contacts, notes)
         select id, $1, $1 from developers
         on conflict (developer_id) do update set contacts = excluded.contacts, notes = excluded.notes`,
        [`+998 90 111 22 33 · t.me/${PRIVATE_MARK} · ${PRIVATE_MARK}`],
      );
    }),
  );
  test.afterAll(() =>
    withDb(async (client) => {
      await client.query("delete from developer_private where developer_id <> all($1::uuid[])", [saved.map((row) => row.developer_id)]);
      for (const row of saved) {
        await client.query("update developer_private set contacts = $2, notes = $3 where developer_id = $1", [row.developer_id, row.contacts, row.notes]);
      }
    }),
  );

  test("каждая страница карты сайта, избранное и подборка: без контактов застройщика, скидок и внутренних полей", async ({ request }) => {
    test.setTimeout(180_000);
    const xml = await (await request.get("/sitemap.xml")).text();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]!).pathname);
    expect(paths.length).toBeGreaterThan(14);
    const all = [...paths, "/ru/izbrannoe", "/uz/izbrannoe", "/ru/podborka?zhk=demo-shodlik,demo-namuna"];
    const problems: string[] = [];
    for (const path of all) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      const contacts = (html.match(CONTACT_LINK) ?? []).filter(
        (link) => !ALLOWED_VODIY_HOUSE_CONTACTS.some((allowed) => link.includes(allowed)),
      );
      if (contacts.length > 0) problems.push(`${path}: ${contacts.join(", ")}`);
      if (DISCOUNT.test(html)) problems.push(`${path}: ${html.match(DISCOUNT)![0]}`);
      if (html.includes(PRIVATE_MARK) || html.includes("developer_private")) problems.push(`${path}: внутренние поля застройщика`);
    }
    expect(problems).toEqual([]);
  });
});
