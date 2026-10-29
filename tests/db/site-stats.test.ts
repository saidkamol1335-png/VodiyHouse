import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  isRemoteTarget,
  user,
  type TestDb,
} from "./harness";

// Фаза 6 (6A.2): site_stats — приёмка PLAN «цифры совпадают с SQL на тестовых данных». События и
// заявки — вручную, по дням Ташкента относительно сегодня (D); ожидаемые числа посчитаны в тесте.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Totals = Record<
  "visitors" | "visits" | "views" | "contacts" | "complex_visitors" | "layout_visitors" | "leads",
  number
>;
type Point = {
  day: string;
  hour: number;
  cur: Record<string, number> | null;
  prev: Record<string, number>;
};
type Stats = {
  hourly: boolean;
  totals: Totals;
  prev: Totals;
  prev_has_data: boolean;
  series: Point[];
  sources: { source: string | null; visitors: number }[];
  devices: { device: string; visitors: number }[];
  langs: { lang: string; visitors: number }[];
  creatives: {
    content: string;
    source: string | null;
    medium: string | null;
    visitors: number;
    leads: number;
  }[];
  lead_types: { type: string; leads: number }[];
  complexes: { id: string; slug: string; views: number; leads: number }[];
  developers: { id: string; views: number; leads: number }[];
};

type EventRow = {
  visitor: string;
  session: string;
  type: string;
  day: number;
  time: string;
  source?: string | null;
  medium?: string | null;
  content?: string | null;
  device?: string;
  lang?: string;
  complex?: string;
};

describe.skipIf(isRemoteTarget)("статистика сайта: site_stats", () => {
  let db: TestDb;
  let head: string;
  let complex: { id: string; slug: string; developer_id: string };
  const A = crypto.randomUUID();
  const B = crypto.randomUUID();
  const C = crypto.randomUUID();
  const PREV = crypto.randomUUID();
  const TODAY = crypto.randomUUID();

  const at = (day: number, time: string) =>
    `(((now() at time zone 'Asia/Tashkent')::date + ${day})::timestamp + '${time}'::interval) at time zone 'Asia/Tashkent'`;

  const addEvent = (row: EventRow) =>
    db.admin.query(
      `insert into events (visitor_id, session_id, type, source, medium, content, device, lang, entity_type, entity_id, at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${at(row.day, row.time)})`,
      [
        row.visitor,
        row.session,
        row.type,
        row.source ?? null,
        row.medium ?? null,
        row.content ?? null,
        row.device ?? "mobile",
        row.lang ?? "uz",
        row.complex ? "complex" : null,
        row.complex ?? null,
      ],
    );

  const addLead = (
    type: string,
    day: number,
    time: string,
    complexId: string | null,
    source: object,
  ) =>
    db.admin.query(
      `insert into leads (type, name, phone, site_lang, complex_id, source, created_at)
       values ($1, 'Тест', '+998901234567', 'ru', $2, $3::jsonb, ${at(day, time)})`,
      [type, complexId, JSON.stringify(source)],
    );

  const day = async (offset: number) =>
    (
      await db.admin.query<{ d: string }>(
        `select ((now() at time zone 'Asia/Tashkent')::date + ${offset})::text as d`,
      )
    ).rows[0]!.d;

  // Даты — до транзакции руководителя: у PGlite одно соединение, запрос admin внутри неё ждал бы её конца.
  const stats = async (from: number, to: number) => {
    const range = [await day(from), await day(to)];
    return db.as(
      user(head),
      async (tx) =>
        (await tx.query<{ v: Stats }>("select site_stats($1::date, $2::date) as v", range)).rows[0]!
          .v,
    );
  };

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
    complex = (
      await db.admin.query<{ id: string; slug: string; developer_id: string }>(
        "select id, slug, developer_id from complexes where status = 'published' order by slug limit 1",
      )
    ).rows[0]!;
    head = await createStaff(db.admin, "head");
    const s1 = crypto.randomUUID();
    const s2 = crypto.randomUUID();
    const reels = { source: "instagram", medium: "reels", content: "shodlik_reels_03" };
    // A — вчера (D-1): визит 1 (страница, ЖК, планировки, ещё страница через 20 мин), визит 2 через час — телефон.
    await addEvent({
      visitor: A,
      session: s1,
      type: "page_view",
      day: -1,
      time: "10:00",
      ...reels,
    });
    await addEvent({
      visitor: A,
      session: s1,
      type: "complex_view",
      day: -1,
      time: "10:01",
      complex: complex.id,
      ...reels,
    });
    await addEvent({
      visitor: A,
      session: s1,
      type: "layout_view",
      day: -1,
      time: "10:02",
      complex: complex.id,
      ...reels,
    });
    await addEvent({
      visitor: A,
      session: s1,
      type: "page_view",
      day: -1,
      time: "10:20",
      ...reels,
    });
    await addEvent({
      visitor: A,
      session: s2,
      type: "page_view",
      day: -1,
      time: "11:00",
      ...reels,
    });
    await addEvent({
      visitor: A,
      session: s2,
      type: "phone_click",
      day: -1,
      time: "11:01",
      complex: complex.id,
      ...reels,
    });
    // B — прямой заход с компьютера на русском в 23:59 по Ташкенту: ещё вчера, не сегодня.
    await addEvent({
      visitor: B,
      session: crypto.randomUUID(),
      type: "page_view",
      day: -1,
      time: "23:59",
      device: "desktop",
      lang: "ru",
    });
    // C — позавчера (D-2): с t.me, только Telegram без просмотра страницы.
    await addEvent({
      visitor: C,
      session: crypto.randomUUID(),
      type: "telegram_click",
      day: -2,
      time: "09:00",
      source: "t.me",
    });
    // Прошлый период [D-4, D-3] — один посетитель; сегодня в 00:01 — ещё один.
    await addEvent({
      visitor: PREV,
      session: crypto.randomUUID(),
      type: "page_view",
      day: -3,
      time: "15:00",
    });
    await addEvent({
      visitor: TODAY,
      session: crypto.randomUUID(),
      type: "page_view",
      day: 0,
      time: "00:01",
    });
    await addLead("complex", -1, "12:00", complex.id, {
      utm_source: "instagram",
      utm_medium: "reels",
      utm_content: "shodlik_reels_03",
    });
    await addLead("tg", -2, "18:00", null, {});
    await addLead("callback", -5, "12:00", null, {});
    // Ревью 6A: D-6 — форма «Застройщикам» (не в счёт), метка с пробелами и кириллицей.
    await addLead("partner", -6, "10:00", null, { utm_content: "tg_post_0928" });
    await addLead("callback", -6, "11:00", null, {
      utm_source: "t.me",
      utm_content: " tg  post 0928 ",
    });
    await addLead("callback", -6, "12:00", null, { utm_content: "Реклама 1" });
    // Посетитель 260 дней назад — в прошлом периоде длинных периодов.
    await addEvent({
      visitor: crypto.randomUUID(),
      session: crypto.randomUUID(),
      type: "page_view",
      day: -260,
      time: "12:00",
    });
  });
  afterAll(() => db.close());

  it("итоги периода: посетители, визиты, просмотры, контакты, шаги пути, заявки; прошлый период той же длины", async () => {
    const result = await stats(-2, -1);
    expect(result.hourly).toBe(false);
    expect(result.totals).toEqual({
      visitors: 3,
      visits: 4,
      views: 4,
      contacts: 2,
      complex_visitors: 1,
      layout_visitors: 1,
      leads: 2,
    });
    expect(result.prev).toMatchObject({ visitors: 1, visits: 1, views: 1, leads: 0 });
    expect(result.prev_has_data).toBe(true);
  });

  it("график по дням: сумма точек = заявки и просмотры периода; точка — день Ташкента", async () => {
    const result = await stats(-2, -1);
    expect(result.series.map((point) => point.day)).toEqual([await day(-2), await day(-1)]);
    expect(result.series.map((point) => point.cur)).toEqual([
      { visitors: 1, visits: 1, views: 0, leads: 1 },
      { visitors: 2, visits: 3, views: 4, leads: 1 },
    ]);
    expect(result.series.map((point) => point.prev.visitors)).toEqual([0, 1]);
  });

  it("панели: источник, устройство, язык — по посетителю; креатив — посетители и заявки по utm_content; типы заявок", async () => {
    const result = await stats(-2, -1);
    const bySource = Object.fromEntries(
      result.sources.map((row) => [row.source ?? "", row.visitors]),
    );
    expect(bySource).toEqual({ instagram: 1, "t.me": 1, "": 1 });
    expect(Object.fromEntries(result.devices.map((row) => [row.device, row.visitors]))).toEqual({
      mobile: 2,
      desktop: 1,
    });
    expect(Object.fromEntries(result.langs.map((row) => [row.lang, row.visitors]))).toEqual({
      uz: 2,
      ru: 1,
    });
    expect(result.creatives).toEqual([
      { content: "shodlik_reels_03", source: "instagram", medium: "reels", visitors: 1, leads: 1 },
    ]);
    expect(Object.fromEntries(result.lead_types.map((row) => [row.type, row.leads]))).toEqual({
      complex: 1,
      tg: 1,
    });
  });

  it("популярные ЖК и застройщики: просмотры страницы ЖК и заявки по нему", async () => {
    const result = await stats(-2, -1);
    expect(result.complexes).toEqual([
      expect.objectContaining({ id: complex.id, slug: complex.slug, views: 1, leads: 1 }),
    ]);
    expect(result.developers).toEqual([
      expect.objectContaining({ id: complex.developer_id, views: 1, leads: 1 }),
    ]);
  });

  it("сегодня — по часам: 00:01 сегодня в первой точке, 23:59 вчера — в прошлой линии", async () => {
    const result = await stats(0, 0);
    expect(result.hourly).toBe(true);
    expect(result.series).toHaveLength(24);
    expect(result.series[0]!.cur?.visitors).toBe(1);
    expect(result.series[23]!.prev.visitors).toBe(1);
    expect(result.series[10]!.prev).toMatchObject({ visitors: 1, visits: 1, views: 2 });
    expect(result.totals.visitors).toBe(1);
  });

  it("заявки: «Застройщикам» не в счёт; метка креатива — пробелы → «_», кириллица отбрасывается", async () => {
    const result = await stats(-6, -6);
    expect(result.totals.leads).toBe(2);
    expect(result.lead_types).toEqual([{ type: "callback", leads: 2 }]);
    expect(result.creatives).toEqual([
      { content: "tg_post_0928", source: "t.me", medium: null, visitors: 0, leads: 1 },
    ]);
  });

  it("прошлый период за сроком хранения (400 дней) — «нет данных», даже если события в нём есть", async () => {
    expect((await stats(-200, -1)).prev_has_data).toBe(true);
    expect((await stats(-250, -1)).prev_has_data).toBe(false);
  });

  it("без событий в прошлом периоде — prev_has_data false (экран пишет «нет данных»)", async () => {
    const result = await stats(-8, -7);
    expect(result.prev_has_data).toBe(false);
    expect(result.totals.visitors).toBe(0);
  });

  it("только руководитель; период — не в будущем, не длиннее хранения событий (400 дней)", async () => {
    for (const role of ["manager", "videographer"] as const) {
      const staff = await createStaff(db.admin, role);
      await expectHint(
        db.as(user(staff), (tx) =>
          tx.query("select site_stats(current_date - 1, current_date - 1)"),
        ),
        "vh:forbidden",
      );
    }
    await expectDenied(
      db.as(anon, (tx) => tx.query("select site_stats(current_date - 1, current_date - 1)")),
    );
    const call = (from: string, to: string) =>
      db.as(user(head), (tx) => tx.query(`select site_stats(${from}, ${to})`));
    const today = "(now() at time zone 'Asia/Tashkent')::date";
    await expectHint(call(`${today}`, `${today} - 1`), "vh:invalid");
    await expectHint(call(`${today}`, `${today} + 1`), "vh:invalid");
    await expectHint(call(`${today} - 401`, `${today}`), "vh:invalid");
    await expect(call(`${today} - 400`, `${today}`)).resolves.toBeTruthy();
  });
});

// DEMO для экрана (supabase/demo/stats.sql): суммы панелей сходятся с итогами, путь посетителя —
// по убыванию, доли — около мокапа; remove.sql убирает посещения и заявки DEMO.
describe.skipIf(isRemoteTarget)("статистика сайта: DEMO-посещения", () => {
  let db: TestDb;
  let head: string;

  beforeAll(async () => {
    db = await createTestDb();
    for (const file of ["seed.sql", "stats.sql"])
      await db.admin.exec(await readFile(path.join(DEMO_DIR, file), "utf8"));
    head = await createStaff(db.admin, "head");
  });
  afterAll(() => db.close());

  const demoCounts = async () =>
    (
      await db.admin.query<{ events: number; leads: number }>(
        `select (select count(*) from events where visitor_id::text like '00000000-de30-%')::int as events,
              (select count(*) from leads where name like 'DEMO · %')::int as leads`,
      )
    ).rows[0]!;

  it("30 дней: суммы панелей = посетители, путь по убыванию, доли около мокапа", async () => {
    const result = await db.as(
      user(head),
      async (tx) =>
        (
          await tx.query<{ v: Stats }>(
            "select site_stats((now() at time zone 'Asia/Tashkent')::date - 29, (now() at time zone 'Asia/Tashkent')::date) as v",
          )
        ).rows[0]!.v,
    );
    const { totals } = result;
    const sum = (rows: { visitors: number }[]) =>
      rows.reduce((total, row) => total + row.visitors, 0);
    expect(totals.visitors).toBeGreaterThan(2500);
    expect(sum(result.sources)).toBe(totals.visitors);
    expect(sum(result.devices)).toBe(totals.visitors);
    expect(sum(result.langs)).toBe(totals.visitors);
    expect(totals.visits).toBeGreaterThan(totals.visitors);
    expect(totals.views).toBeGreaterThan(totals.visits);
    expect(totals.complex_visitors).toBeLessThan(totals.visitors);
    expect(totals.layout_visitors).toBeLessThan(totals.complex_visitors);
    expect(totals.contacts).toBeLessThan(totals.layout_visitors);
    expect(totals.leads).toBeGreaterThan(20);
    expect(result.lead_types.reduce((total, row) => total + row.leads, 0)).toBe(totals.leads);
    expect(result.prev_has_data).toBe(true);
    const instagram =
      result.sources.find((row) => row.source === "instagram")!.visitors / totals.visitors;
    expect(instagram).toBeGreaterThan(0.4);
    expect(instagram).toBeLessThan(0.58);
    expect(result.creatives[0]).toMatchObject({
      content: "shodlik_reels_03",
      source: "instagram",
      medium: "reels",
    });
    expect(result.complexes.length).toBeGreaterThanOrEqual(4);
    expect(result.complexes[0]!.slug).toMatch(/^demo-/);
  });

  it("remove.sql убирает DEMO-посещения и DEMO-заявки", async () => {
    expect(await demoCounts()).toMatchObject({
      events: expect.any(Number),
      leads: expect.any(Number),
    });
    expect((await demoCounts()).events).toBeGreaterThan(10_000);
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "remove.sql"), "utf8"));
    expect(await demoCounts()).toEqual({ events: 0, leads: 0 });
  });
});
