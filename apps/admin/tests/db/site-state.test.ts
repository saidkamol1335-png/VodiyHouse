import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, isRemoteTarget, type TestDb } from "./harness";

// Проект-2, фаза B (PLAN §10, п. 11): состояние ЖК и полнота планировки хранятся
// (20261102120000_stored_site_state.sql) — здесь сверка «хранимое = посчитанное» после любых правок.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../../../supabase/demo");

describe.skipIf(isRemoteTarget)("хранимое состояние ЖК (PLAN §10, п. 11)", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  });
  afterAll(() => db.close());

  /** ЖК, у которых хранимое расходится с посчитанным сейчас. Пусто — всё сходится. */
  const drift = async () =>
    (
      await db.admin.query<{ slug: string }>(
        `select c.slug from public.complexes c cross join lateral private.complex_state_now(c.id) s
         where (c.missing_count, c.site_state) is distinct from (s.missing_count, s.site_state)
         union all
         select 'layout ' || l.id from public.layouts l join private.layout_completeness lc on lc.layout_id = l.id
         where l.is_complete is distinct from lc.is_complete`,
      )
    ).rows.map((row) => row.slug);

  // DEMO-сид пишет в обход стражей и без фото (фото кладёт demo.mjs) — минимум у него не выполнен;
  // здесь важно только, что хранимое не разошлось с посчитанным.
  it("после DEMO хранимое совпадает с посчитанным", async () => {
    expect(await drift()).toEqual([]);
    const { rows } = await db.admin.query<{ n: number }>("select count(*)::int as n from complexes where missing_count = 6");
    expect(rows[0]!.n).toBeLessThan((await db.admin.query<{ n: number }>("select count(*)::int as n from complexes")).rows[0]!.n);
  });

  it("правки цен, чертежей, фото, курса и застройщика пересчитывают состояние сами", async () => {
    await db.admin.exec(`
      update public.units set price = null, price_per_m2 = null
        where block_id in (select b.id from public.blocks b join public.complexes c on c.id = b.complex_id where c.status = 'draft');
      update public.layouts set drawing_id = null
        where block_id in (select b.id from public.blocks b join public.complexes c on c.id = b.complex_id where c.status = 'draft');
      delete from public.media_assets
        where kind = 'photo' and complex_id in (select id from public.complexes where status = 'draft');
      update public.settings set value = value where key = 'exchange.usd_uzs';
      update public.developers set status = 'hidden'
        where status = 'published' and not exists (
          select 1 from public.complexes c where c.developer_id = developers.id and c.status = 'published');
    `);
    expect(await drift()).toEqual([]);
  });

  it("пересчёт не трогает «обновлено»: updated_at ЖК и планировок прежний", async () => {
    const stamp = "select max(updated_at)::text as v from (select updated_at from complexes union all select updated_at from layouts) t";
    const before = (await db.admin.query<{ v: string }>(stamp)).rows[0]!.v;
    await db.admin.query("update public.settings set value = value where key = 'exchange.usd_uzs'");
    expect((await db.admin.query<{ v: string }>(stamp)).rows[0]!.v).toBe(before);
  });

  // В облаке Data API работает с safeupdate: DELETE / UPDATE без WHERE отклоняются (в PGlite — нет).
  // Страж по телам всех функций: такой оператор упал бы только после выкладки (случай 02.11).
  // Переименование роли (20261102100000) переписало тела функций по тексту; копии старых тел в новых
  // миграциях не должны вернуть «videographer».
  it("роль videographer нигде не осталась: ни в типе, ни в телах функций", async () => {
    const roles = await db.admin.query<{ v: string[] }>("select enum_range(null::public.staff_role)::text[] as v");
    expect(roles.rows[0]!.v).toEqual(["head", "manager", "mobilographer"]);
    const { rows } = await db.admin.query<{ name: string }>(
      `select n.nspname || '.' || p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private') and p.prokind = 'f' and p.prolang <> 13
         and pg_get_functiondef(p.oid) ~ '''videographer'''`,
    );
    expect(rows.map((row) => row.name)).toEqual([]);
  });

  it("нет DELETE / UPDATE без WHERE ни в одной функции public и private", async () => {
    const { rows } = await db.admin.query<{ name: string; body: string }>(
      `select n.nspname || '.' || p.proname as name, pg_get_functiondef(p.oid) as body
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private') and p.prokind = 'f' and p.prolang <> 13`,
    );
    // «delete from x …;» и «update x [alias] set …;» — до точки с запятой должен быть where.
    // «on conflict do update set» сюда не попадает: после update нет имени таблицы перед set.
    const statement = /\b(?:delete\s+from\s+[\w."]+|update\s+[\w."]+\s+(?:\w+\s+)?set\b)[^;]*;/gi;
    const unsafe = rows.flatMap(({ name, body }) =>
      [...body.replace(/--[^\n]*/g, "").matchAll(statement)]
        .filter((match) => !/\bwhere\b/i.test(match[0]))
        .map((match) => `${name}: ${match[0].slice(0, 60)}`),
    );
    expect(unsafe).toEqual([]);
  });

  it("пересчёт не пишет журнал: в audit_log нет полей состояния", async () => {
    const { rows } = await db.admin.query<{ n: number }>(
      `select count(*)::int as n from public.audit_log
       where changes ?| array['site_state', 'missing_count', 'is_complete']`,
    );
    expect(rows[0]!.n).toBe(0);
  });
});
