import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import { anon, createAuthUser, createStaff, createTestDb, expectHint, service, user, type Actor, type TestDb } from "./harness";

// Аудит безопасности 29.10: матрица доступа PLAN §5 проверяется по факту — запросами от имени
// посетителя и каждой роли к настоящим строкам, а не по тексту политик. «Не читает» = отказ в праве
// или ноль строк при том, что строки в таблице есть (это проверяется владельцем).

const DENIED = /permission denied|row-level security|руководитель|Только|доступ/i;

/** Функции, которые посетитель вправе вызывать: публичные данные сайта (SECURITY DEFINER, только чтение). */
const ANON_FUNCTIONS = [
  "block_availability",
  "block_units",
  "layout_availability",
  "room_availability",
  "site_calc_screen",
  "site_calculator_available",
  "site_catalog",
  "site_complex",
  "site_complex_picker",
  "site_complex_progress",
  "site_developer",
  "site_developer_slug_state",
  "site_developers",
  "site_layout_calc",
  "site_payment_programs",
  "site_showcase",
  "site_slug_state",
  "site_unit_video",
];

describe("матрица доступа по ролям (PLAN §5)", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let videographer: string;
  let archivedComplex: string;
  let archivedDeveloper: string;

  /** Сколько строк видит роль; отказ в праве — 0 строк. */
  const visible = async (actor: Actor, sql: string, params: unknown[] = []) => {
    try {
      return (await db.as(actor, (tx) => tx.query(sql, params))).rows.length;
    } catch (error) {
      if (DENIED.test(String(error))) return 0;
      throw error;
    }
  };
  const total = async (table: string) =>
    (await db.admin.query<{ n: number }>(`select count(*)::int as n from public.${table}`)).rows[0]!.n;
  /** Запись: отказ или ноль затронутых строк. */
  const writes = async (actor: Actor, sql: string, params: unknown[] = []) => {
    try {
      return (await db.as(actor, (tx) => tx.query(sql, params))).affectedRows ?? 0;
    } catch (error) {
      if (DENIED.test(String(error))) return 0;
      throw error;
    }
  };
  const statusOf = async (table: "complexes" | "developers", id: string) =>
    (await db.admin.query<{ status: string }>(`select status::text from public.${table} where id = $1`, [id])).rows[0]!.status;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");

    const insertId = async (sql: string, params: unknown[]) =>
      (await db.admin.query<{ id: string }>(`${sql} returning id`, params)).rows[0]!.id;
    archivedDeveloper = await insertId("insert into developers (slug, name, status) values ('archived-dev', 'archived-dev', 'archived')", []);
    archivedComplex = await insertId(
      `insert into complexes (developer_id, slug, name, status)
       values ($1, 'archived-zhk', '{"ru": "Архив", "uz": "Arxiv"}', 'archived')`,
      [ids.publicDeveloper],
    );
    await db.admin.query(
      `insert into leads (type, name, phone, site_lang) values ('callback', 'Клиент', '+998901234567', 'ru')`,
    );
    for (const [channel, author] of [["site", null], ["cabinet", manager]] as const) {
      await db.admin.query(
        `insert into calculations (channel, created_by, input, result, program_snapshot) values ($1, $2, '{}', '{}', '{}')`,
        [channel, author],
      );
    }
  });
  afterAll(() => db.close());

  describe("посетитель", () => {
    it("не читает заявки, developer_private, расчёты, журнал, профили и служебные таблицы", async () => {
      for (const table of ["leads", "developer_private", "calculations", "audit_log", "profiles"]) {
        expect(await total(table), `в ${table} есть строки`).toBeGreaterThan(0);
      }
      for (const table of [
        "leads", "lead_deliveries", "developer_private", "calculations", "audit_log", "profiles",
        "events", "event_rates", "tg_starts", "tg_updates", "login_failures", "archive_notices", "showcase_notices",
        "progress_reports", "progress_photos", "progress_notices",
      ]) {
        expect(await visible(anon, `select * from public.${table}`), table).toBe(0);
      }
    });

    it("не видит черновики, скрытые и архив ЖК и застройщиков — ни в таблицах, ни через функции сайта", async () => {
      const hidden = [ids.draftComplex, ids.hiddenComplex, ids.orphanComplex, archivedComplex];
      expect(await visible(anon, "select id from public.complexes where id = any($1)", [hidden])).toBe(0);
      const developers = [ids.draftDeveloper, archivedDeveloper];
      expect(await visible(anon, "select id from public.developers where id = any($1)", [developers])).toBe(0);
      expect(await visible(anon, "select id from public.blocks where id = $1", [ids.draftBlock])).toBe(0);
      for (const slug of ["draft-zhk", "hidden-zhk", "orphan-zhk", "archived-zhk"]) {
        const { rows } = await db.as(anon, (tx) => tx.query<{ v: unknown }>("select public.site_complex($1) as v", [slug]));
        expect(rows[0]?.v, slug).toBeNull();
      }
      for (const slug of ["draft-dev", "archived-dev"]) {
        const { rows } = await db.as(anon, (tx) => tx.query<{ v: unknown }>("select public.site_developer($1) as v", [slug]));
        expect(rows[0]?.v, slug).toBeNull();
      }
    });

    it("не имеет прав INSERT / UPDATE / DELETE / TRUNCATE ни на одну таблицу: заявки, события и расчёты сайта — только через сервер", async () => {
      const { rows } = await db.admin.query<{ grant: string }>(
        `select c.relname || ':' || p.priv as grant
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p(priv)
         where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
           and has_table_privilege('anon', c.oid, p.priv)
         order by 1`,
      );
      expect(rows.map((row) => row.grant)).toEqual([]);
    });

    it("в public вызывает только функции чтения сайта (белый список)", async () => {
      const { rows } = await db.admin.query<{ name: string }>(
        `select distinct p.proname as name
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prokind = 'f'
           -- Функции триггеров напрямую не вызвать; event_trigger — rls_auto_enable самого Supabase в облаке.
           and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
           and has_function_privilege('anon', p.oid, 'EXECUTE')
         order by 1`,
      );
      expect(rows.map((row) => row.name)).toEqual(ANON_FUNCTIONS);
    });

    // У части функций private EXECUTE остался у PUBLIC по умолчанию (аудит 29.10, Low): барьер — Data API
    // не отдаёт схему private. Проверяем сам барьер: в config.toml и, в облаке, в настройке PostgREST.
    it("схема private не открыта в Data API — её функции посетителю не вызвать", async () => {
      const config = readFileSync("supabase/config.toml", "utf8");
      const schemas = /^\[api\][\s\S]*?^schemas = \[([^\]]*)\]/m.exec(config)?.[1] ?? "";
      expect(schemas).toContain('"public"');
      expect(schemas).not.toContain("private");
      const { rows } = await db.admin.query<{ setting: string | null }>(
        `select (select s from unnest(r.rolconfig) as s where s like 'pgrst.db_schemas=%') as setting
         from pg_roles r where r.rolname = 'authenticator'`,
      );
      expect(rows[0]?.setting ?? "").not.toMatch(/\bprivate\b/);
    });
  });

  // Пункты 3–10 аудита 29.10 (20261029070000_audit_access.sql).
  describe("сверх PLAN §5 — ничего лишнего", () => {
    it("посетитель напрямую читает только опубликованный контент; витрина, планировки и медиа — через функции", async () => {
      const { rows } = await db.admin.query<{ name: string }>(
        `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'SELECT')
         order by 1`,
      );
      expect(rows.map((row) => row.name)).toEqual([
        "banks", "blocks", "complex_details", "complex_documents", "complex_videos", "complexes", "deadline_changes",
        "detail_topics", "developer_past_projects", "developers", "document_types", "finishings", "floor_plans",
        "hints", "locations", "settings",
      ]);
    });

    it("вошедший без роли (отключённый, без профиля) не видит витрину, планировки и медиа — как посетитель", async () => {
      const outsider = user(await createAuthUser(db.admin));
      const disabled = await createStaff(db.admin, "manager", { isActive: false });
      for (const actor of [outsider, user(disabled)]) {
        for (const table of ["specials", "collections", "ads", "layouts", "media_assets"]) {
          expect(await visible(actor, `select id from public.${table}`), table).toBe(0);
        }
      }
      expect(await visible(user(videographer), "select id from public.media_assets")).toBe(await total("media_assets"));
    });

    it("коллеги видят имя, роль и активность; флаг пароля и закрытие сессий — только свои через own_profile", async () => {
      for (const actor of [user(manager), user(videographer), user(head)]) {
        expect(await visible(actor, "select must_change_password from public.profiles")).toBe(0);
        expect(await visible(actor, "select sessions_revoked_at from public.profiles")).toBe(0);
        expect(await visible(actor, "select id, full_name, role, is_active from public.profiles")).toBe(await total("profiles"));
      }
      const own = await db.as(user(manager), (tx) => tx.query<{ id: string; must_change_password: boolean }>("select * from public.own_profile()"));
      expect(own.rows).toEqual([expect.objectContaining({ id: manager, must_change_password: false })]);
      expect(await visible(anon, "select * from public.own_profile()")).toBe(0);
    });

    it("хэш адреса в заявке стирается через час: новая заявка чистит старые", async () => {
      await db.admin.query(
        `insert into leads (type, name, phone, site_lang, client_key, created_at)
         values ('callback', 'Старая', '+998901110000', 'ru', repeat('a', 64), now() - interval '2 hours'),
                ('callback', 'Свежая', '+998901110001', 'ru', repeat('b', 64), now() - interval '5 minutes')`,
      );
      await db.as(service, (tx) =>
        tx.query("select public.submit_lead($1::jsonb, '{}'::public.lead_channel[], $2)", [
          JSON.stringify({ type: "callback", name: "Новая", phone: "+998901110002", site_lang: "ru" }),
          "c".repeat(64),
        ]),
      );
      const { rows } = await db.admin.query<{ name: string; client_key: string | null }>(
        "select name, client_key from leads where name in ('Старая', 'Свежая') order by name",
      );
      expect(rows).toEqual([{ name: "Свежая", client_key: "b".repeat(64) }, { name: "Старая", client_key: null }]);
    });

    it("выключенные банки видят руководитель и менеджер, видеограф — как посетитель", async () => {
      await db.admin.query(`insert into banks (slug, name, is_active) values ('audit-hidden', '{"ru": "Скрытый банк", "uz": "Yashirin bank"}', false)`);
      const hiddenBank = "select id from public.banks where not is_active";
      expect(await visible(user(head), hiddenBank)).toBeGreaterThan(0);
      expect(await visible(user(manager), hiddenBank)).toBeGreaterThan(0);
      expect(await visible(user(videographer), hiddenBank)).toBe(0);
      expect(await visible(anon, hiddenBank)).toBe(0);
    });

    it("лимит событий снова под замком ключа адреса", async () => {
      const { rows } = await db.admin.query<{ body: string }>(
        "select pg_get_functiondef('public.track_events(uuid, uuid, text, text, text, text, jsonb)'::regprocedure) as body",
      );
      expect(rows[0]?.body).toMatch(/private\.lock_event_key\(p_client_key\)[\s\S]*event_rates/);
    });

    it("посетитель в private вызывает только проверки видимости; служебные функции заявок — нет", async () => {
      const { rows } = await db.admin.query<{ name: string }>(
        `select distinct p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'private' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
           and has_function_privilege('anon', p.oid, 'EXECUTE')
         order by 1`,
      );
      expect(rows.map((row) => row.name)).toEqual([
        "can_see_complex", "exchange_rate", "has_role", "is_contour", "is_public_complex", "is_public_developer",
        "is_staff", "is_unit_contours", "mentions_discount", "showcase_public_complexes", "showcase_visible",
        "staff_role", "tashkent_today", "uuid_or_null",
      ]);
    });

    it("новая функция без явного права закрыта для посетителя и сотрудника", async () => {
      await db.admin.query("create function public.zz_audit_probe() returns int language sql as 'select 1'");
      await db.admin.query("create function private.zz_audit_probe() returns int language sql as 'select 1'");
      try {
        for (const fn of ["public.zz_audit_probe()", "private.zz_audit_probe()"]) {
          for (const role of ["anon", "authenticated"]) {
            const { rows } = await db.admin.query<{ v: boolean }>("select has_function_privilege($1, $2, 'EXECUTE') as v", [role, fn]);
            expect(rows[0]?.v, `${role} ${fn}`).toBe(false);
          }
        }
      } finally {
        await db.admin.query("drop function public.zz_audit_probe()");
        await db.admin.query("drop function private.zz_audit_probe()");
      }
    });
  });

  describe("менеджер", () => {
    it("не создаёт ЖК и застройщика — ни функцией, ни вставкой", async () => {
      const name = JSON.stringify({ ru: "Новый", uz: "Yangi" });
      await expect(db.as(user(manager), (tx) => tx.query("select public.create_complex($1, $2, 'novyy')", [ids.publicDeveloper, name]))).rejects.toThrow(DENIED);
      await expect(db.as(user(manager), (tx) => tx.query("select public.create_developer('Yangi', 'yangi')"))).rejects.toThrow(DENIED);
      expect(
        await writes(user(manager), `insert into public.complexes (developer_id, slug, name) values ($1, 'mgr-zhk', $2)`, [ids.publicDeveloper, name]),
      ).toBe(0);
      expect(await writes(user(manager), "insert into public.developers (slug, name) values ('mgr-dev', 'mgr-dev')")).toBe(0);
    });

    it("не публикует, не скрывает и не архивирует ЖК и застройщика", async () => {
      const cases: [string, "complexes" | "developers", string][] = [
        ["published", "complexes", ids.draftComplex],
        ["hidden", "complexes", ids.publicComplex],
        ["archived", "complexes", ids.publicComplex],
        ["published", "developers", ids.draftDeveloper],
        ["hidden", "developers", ids.publicDeveloper],
        ["archived", "developers", ids.publicDeveloper],
      ];
      for (const [status, table, id] of cases) {
        const before = await statusOf(table, id);
        expect(await writes(user(manager), `update public.${table} set status = $2 where id = $1`, [id, status]), `${table} → ${status}`).toBe(0);
        expect(await statusOf(table, id)).toBe(before);
      }
      expect(await writes(user(manager), "delete from public.complexes where id = $1", [ids.draftComplex])).toBe(0);
      expect(await writes(user(manager), "delete from public.developers where id = $1", [ids.draftDeveloper])).toBe(0);
    });
  });

  describe("видеограф", () => {
    it("не читает заявки и расчёты — ни таблицы, ни экраны заявок", async () => {
      expect(await visible(user(videographer), "select * from public.leads")).toBe(0);
      expect(await visible(user(videographer), "select * from public.lead_deliveries")).toBe(0);
      expect(await visible(user(videographer), "select * from public.calculations")).toBe(0);
      expect(await visible(user(videographer), "select * from public.developer_private")).toBe(0);
      await expect(db.as(user(videographer), (tx) => tx.query("select public.leads_screen(null, null, null)"))).rejects.toThrow();
      await expect(db.as(user(videographer), (tx) => tx.query("select public.lead_card(1001)"))).rejects.toThrow();
    });

    it("не читает служебное и не меняет квартиры: статус и цена — руководителю и менеджеру", async () => {
      for (const table of ["audit_log", "payment_programs", "events", "tg_starts", "login_failures", "archive_notices", "showcase_notices", "progress_notices"]) {
        expect(await visible(user(videographer), `select * from public.${table}`), table).toBe(0);
      }
      const unit = ids.units[0];
      const before = (await db.admin.query("select status::text, price from public.units where id = $1", [unit])).rows[0];
      expect(await writes(user(videographer), "update public.units set status = 'sold', price = 1 where id = $1", [unit])).toBe(0);
      await expect(
        db.as(user(videographer), (tx) => tx.query("select public.set_units_status($1, $2::uuid[], 'sold')", [ids.publicBlock, [unit]])),
      ).rejects.toThrow();
      expect((await db.admin.query("select status::text, price from public.units where id = $1", [unit])).rows[0]).toEqual(before);
    });

    it("отчёты хода строительства: отправляет, видит только свои, не публикует (фаза 5)", async () => {
      const month = (await db.admin.query<{ m: string }>("select to_char(date_trunc('month', private.tashkent_today()), 'YYYY-MM-DD') as m")).rows[0]!.m;
      const body = (unit: string) =>
        JSON.stringify({
          block_id: ids.publicBlock,
          unit_id: unit,
          month,
          comment: { ru: "Двор", uz: "Hovli" },
          photos: [1, 2, 3].map(() => ({ path: `complexes/${ids.publicComplex}/${crypto.randomUUID()}.jpg`, width: 10, height: 10 })),
        });
      const submit = (actor: string, unit: string) =>
        db.as(user(actor), (tx) => tx.query<{ r: { id: string } }>("select public.submit_progress_report($1) as r", [body(unit)])).then((r) => r.rows[0]!.r.id);
      const own = await submit(videographer, ids.units[0]!);
      const others = await submit(head, ids.units[1]!);
      expect(await visible(user(videographer), "select id from public.progress_reports where id = any($1)", [[own, others]])).toBe(1);
      expect(await visible(user(manager), "select id from public.progress_reports where id = any($1)", [[own, others]])).toBe(2);
      await expectHint(db.as(user(videographer), (tx) => tx.query("select public.publish_progress_report($1, true)", [own])), "vh:forbidden");
      expect(await writes(user(videographer), "update public.progress_reports set status = 'published', published_at = now() where id = $1", [own])).toBe(0);
    });
  });

  describe("руководитель", () => {
    it("видит всё: заявки, все расчёты, developer_private, журнал, всех сотрудников, черновики и архив", async () => {
      expect(await visible(user(head), "select * from public.leads")).toBe(await total("leads"));
      expect(await visible(user(head), "select * from public.calculations")).toBe(await total("calculations"));
      expect(await visible(user(head), "select * from public.developer_private")).toBe(await total("developer_private"));
      expect(await visible(user(head), "select * from public.audit_log")).toBe(await total("audit_log"));
      expect(await visible(user(head), "select id, full_name, role, is_active from public.profiles")).toBe(await total("profiles"));
      const all = [ids.draftComplex, ids.hiddenComplex, ids.orphanComplex, archivedComplex, ids.publicComplex];
      expect(await visible(user(head), "select id from public.complexes where id = any($1)", [all])).toBe(all.length);
      expect(await visible(user(head), "select id from public.developers where id = any($1)", [[ids.draftDeveloper, archivedDeveloper]])).toBe(2);
    });

    it("создаёт ЖК и застройщика, скрывает и архивирует ЖК, правит developer_private", async () => {
      const name = JSON.stringify({ ru: "Новый", uz: "Yangi" });
      const created = await db.as(user(head), (tx) =>
        tx.query<{ id: string }>("select public.create_complex($1, $2, 'head-zhk') as id", [ids.publicDeveloper, name]),
      );
      expect(created.rows[0]?.id).toBeTruthy();
      const developer = await db.as(user(head), (tx) => tx.query<{ id: string }>("select public.create_developer('Head Dev', 'head-dev') as id"));
      expect(developer.rows[0]?.id).toBeTruthy();
      expect(await writes(user(head), "update public.complexes set status = 'hidden' where id = $1", [ids.publicComplex])).toBe(1);
      expect(await writes(user(head), "update public.complexes set status = 'archived' where id = $1", [ids.hiddenComplex])).toBe(1);
      expect(await writes(user(head), "update public.developer_private set notes = 'Заметка' where developer_id = $1", [ids.publicDeveloper])).toBe(1);
    });
  });
});
