import { expect, test } from "@playwright/test";
import pg from "pg";
import { dbClientConfig } from "../../lib/supabase/dbClient";
import { hasCloud, NO_CLOUD } from "./cloud";

// Шаг 3.13: адрес ЖК, удалённого после 30 дней в архиве, — 308 (постоянный) на каталог, а не 404; чужой адрес —
// 404. Удалённый адрес ставим прямо в базу (retired_slugs) владельцем — как это делает purge_archived.

const RETIRED = `e2e-udalen-${Date.now().toString(36)}`;

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client(dbClientConfig(process.env.SUPABASE_DB_URL!));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

test.describe("архив: старые адреса ЖК", () => {
  test.skip(!hasCloud || !process.env.SUPABASE_DB_URL, NO_CLOUD);
  test.beforeAll(() => withDb((client) => client.query("insert into retired_slugs (slug) values ($1)", [RETIRED])));
  test.afterAll(() => withDb((client) => client.query("delete from retired_slugs where slug = $1", [RETIRED])));

  test("удалённый ЖК — 308 (постоянный) на каталог; адреса не было — 404", async ({ request }) => {
    const moved = await request.get(`/ru/novostroyki/${RETIRED}`, { maxRedirects: 0 });
    expect(moved.status()).toBe(308);
    expect(moved.headers().location).toMatch(/\/ru\/novostroyki$/);
    const missing = await request.get("/ru/novostroyki/net-takogo-zhk", { maxRedirects: 0 });
    expect(missing.status()).toBe(404);
  });

  test("старая ссылка с рекламы: метки не теряются — адрес захода в cookie на минуту, заявка возьмёт их", async ({ request }) => {
    const moved = await request.get(`/ru/novostroyki/${RETIRED}?utm_source=instagram&utm_campaign=osen`, { maxRedirects: 0 });
    expect(moved.status()).toBe(308);
    const cookie = moved.headers()["set-cookie"] ?? "";
    expect(decodeURIComponent(cookie)).toContain(`vh-landing=/ru/novostroyki/${RETIRED}?utm_source=instagram&utm_campaign=osen`);
    expect(cookie).toMatch(/Max-Age=60/i);
  });
});
