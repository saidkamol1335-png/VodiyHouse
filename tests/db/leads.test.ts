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
  service,
  user,
  type TestDb,
} from "./harness";

// Шаг 3.7: заявки (миграции 20261026090000–090300) на DEMO-сиде. Создаёт заявку только сервер
// (секретный ключ), посетитель и сотрудник — нет; снимок названий, повтор за 24 ч, лимит частоты,
// снимок расчёта; очередь доставки и тревога «10 минут»; кабинет — руководитель и менеджер.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Submitted = { id: string; number: number; repeat_of: number | null };

let phoneSeq = 0;
/** Свой номер на каждый тест: лимит частоты и повторы не задевают соседей. */
const nextPhone = () => `+99890${String(10_000_000 + ++phoneSeq).slice(1)}`;

async function seededDb() {
  const db = await createTestDb();
  await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  return db;
}

const submit = (db: TestDb, lead: Record<string, unknown>, channels = "{telegram,sheet}", key: string | null = null) =>
  db.as(service, async (tx) => {
    const { rows } = await tx.query<{ data: Submitted }>(
      "select submit_lead($1::jsonb, $2::lead_channel[], $3) as data",
      [JSON.stringify({ type: "callback", name: "Азиз", site_lang: "ru", ...lead }), channels, key],
    );
    return rows[0]!.data;
  });

const scalar = async <T>(db: TestDb, sql: string, params: unknown[] = []) =>
  (await db.admin.query<{ v: T }>(sql, params)).rows[0]!.v;

describe.skipIf(isRemoteTarget)("заявки: создание", () => {
  let db: TestDb;
  let complex: { slug: string; id: string };
  let foreignLayout: string;
  let layout: { id: string; block: string };

  beforeAll(async () => {
    db = await seededDb();
    const { rows } = await db.admin.query<{ slug: string; id: string }>(
      "select slug, id from complexes where status = 'published' order by slug limit 2",
    );
    complex = rows[0]!;
    const own = await db.admin.query<{ id: string; block: string }>(
      `select l.id, b.name as block from layouts l join blocks b on b.id = l.block_id
        where b.complex_id = $1 order by l.sort limit 1`,
      [complex.id],
    );
    layout = own.rows[0]!;
    foreignLayout = await scalar<string>(
      db,
      "select l.id as v from layouts l join blocks b on b.id = l.block_id where b.complex_id = $1 limit 1",
      [rows[1]!.id],
    );
  });
  afterAll(() => db.close());

  it("посетитель и сотрудник не создают и не читают заявки", async () => {
    const manager = await createStaff(db.admin, "manager");
    const call = "select submit_lead('{}'::jsonb, '{}'::lead_channel[], null)";
    await expectDenied(db.as(anon, (tx) => tx.query(call)));
    await expectDenied(db.as(user(manager), (tx) => tx.query(call)));
    await expectDenied(db.as(anon, (tx) => tx.query("select * from leads")));
    await expectDenied(db.as(service, (tx) => tx.query("select * from leads")));
  });

  it("снимок объекта по адресу ЖК; чужая планировка не попадает; очередь — по каналам сервера", async () => {
    const phone = nextPhone();
    const own = await submit(db, { type: "layout", phone, complex: complex.slug, layout: layout.id });
    expect(own.number).toBeGreaterThanOrEqual(1001);
    const row = (
      await db.admin.query<{ complex_id: string; layout_id: string; subject: Record<string, unknown> }>(
        "select complex_id, layout_id, subject from leads where id = $1",
        [own.id],
      )
    ).rows[0]!;
    expect(row).toMatchObject({ complex_id: complex.id, layout_id: layout.id });
    expect(row.subject).toMatchObject({ slug: complex.slug, block: layout.block });
    expect(row.subject).not.toHaveProperty("complex_id");
    const deliveries = await scalar<string[]>(
      db,
      "select array_agg(channel::text order by channel) as v from lead_deliveries where lead_id = $1",
      [own.id],
    );
    expect(deliveries).toEqual(["telegram", "sheet"]);

    const foreign = await submit(db, { type: "layout", phone: nextPhone(), complex: complex.slug, layout: foreignLayout }, "{}");
    expect(await scalar(db, "select layout_id as v from leads where id = $1", [foreign.id])).toBeNull();
    expect(await scalar(db, "select count(*)::int as v from lead_deliveries where lead_id = $1", [foreign.id])).toBe(0);
  });

  it("тот же номер по тому же ЖК за 24 часа — повторное обращение; по другому ЖК — нет", async () => {
    const phone = nextPhone();
    const first = await submit(db, { phone, complex: complex.slug });
    expect(first.repeat_of).toBeNull();
    const again = await submit(db, { phone, complex: complex.slug, type: "view" });
    expect(again.repeat_of).toBe(first.number);
    const general = await submit(db, { phone });
    expect(general.repeat_of).toBeNull();
    await db.admin.query("update leads set created_at = now() - interval '25 hours' where id = any($1)", [
      [first.id, again.id],
    ]);
    expect((await submit(db, { phone, complex: complex.slug })).repeat_of).toBeNull();
  });

  it("без ЖК повтор — только та же форма: подбор и расчёт по застройщику — разные запросы", async () => {
    const phone = nextPhone();
    const pick = await submit(db, { phone, type: "pick" }, "{}");
    expect((await submit(db, { phone, type: "calc" }, "{}")).repeat_of).toBeNull();
    expect((await submit(db, { phone, type: "pick" }, "{}")).repeat_of).toBe(pick.number);
    const developers = (await db.admin.query<{ slug: string }>("select slug from developers where status = 'published' order by slug limit 2")).rows;
    const other = nextPhone();
    await submit(db, { phone: other, type: "calc", developer: developers[0]!.slug }, "{}");
    expect((await submit(db, { phone: other, type: "calc", developer: developers[1]!.slug }, "{}")).repeat_of).toBeNull();
  });

  it("расчёт «по планировке» без адреса ЖК: ЖК — по планировке того же застройщика", async () => {
    const developer = await scalar<string>(
      db,
      "select d.slug as v from developers d join complexes c on c.developer_id = d.id where c.id = $1",
      [complex.id],
    );
    const lead = await submit(db, { type: "calc", phone: nextPhone(), developer, layout: layout.id }, "{}");
    const row = (await db.admin.query("select complex_id, layout_id from leads where id = $1", [lead.id])).rows[0];
    expect(row).toEqual({ complex_id: complex.id, layout_id: layout.id });
    const stranger = await submit(db, { type: "calc", phone: nextPhone(), developer: "no-such-developer", layout: layout.id }, "{}");
    expect(await scalar(db, "select complex_id as v from leads where id = $1", [stranger.id])).toBeNull();
  });

  it("лимит частоты: 3 с номера и 5 с адреса за 10 минут", async () => {
    const phone = nextPhone();
    for (let i = 0; i < 3; i++) await submit(db, { phone });
    await expectHint(submit(db, { phone }), "vh:rate_limited");
    const key = `key-${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) await submit(db, { phone: nextPhone() }, "{}", key);
    await expectHint(submit(db, { phone: nextPhone() }, "{}", key), "vh:rate_limited");
  });

  it("неверная заявка — vh:invalid, без строки", async () => {
    const before = await scalar<number>(db, "select count(*)::int as v from leads");
    await expectHint(submit(db, { phone: "+99890123" }), "vh:invalid");
    await expectHint(submit(db, { phone: nextPhone(), name: "  " }), "vh:invalid");
    await expectHint(submit(db, { phone: nextPhone(), type: "complaint" }), "vh:invalid");
    expect(await scalar(db, "select count(*)::int as v from leads")).toBe(before);
  });

  it("снимок расчёта — программа застройщика этого ЖК; чужая программа не сохраняется", async () => {
    const program = await scalar<string>(
      db,
      `select p.id as v from payment_programs p join complexes c on c.developer_id = p.developer_id
        where c.id = $1 and p.is_active limit 1`,
      [complex.id],
    );
    const foreign = await scalar<string>(
      db,
      `select p.id as v from payment_programs p join complexes c on c.id = $1
        where p.developer_id <> c.developer_id and p.is_active limit 1`,
      [complex.id],
    );
    const calc = (programId: string) => ({ program: programId, input: { price: 1 }, result: { monthly: 1 } });
    const own = await submit(db, { type: "calc", phone: nextPhone(), complex: complex.slug, calc: calc(program) }, "{}");
    const snapshot = (
      await db.admin.query<{ channel: string; program_id: string; snapshot: { name: unknown } }>(
        "select channel, program_id, program_snapshot as snapshot from calculations where lead_id = $1",
        [own.id],
      )
    ).rows;
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toMatchObject({ channel: "site", program_id: program });
    const other = await submit(db, { type: "calc", phone: nextPhone(), complex: complex.slug, calc: calc(foreign) }, "{}");
    expect(await scalar(db, "select count(*)::int as v from calculations where lead_id = $1", [other.id])).toBe(0);
  });

  it("заявка переживает удаление ЖК: ссылка — null, снимок названий остаётся", async () => {
    const draft = await db.admin.query<{ id: string; slug: string }>(
      `insert into complexes (developer_id, slug, name, status)
       select developer_id, 'test-lead-complex', '{"ru":"Тест","uz":"Test"}', 'published' from complexes where id = $1
       returning id, slug`,
      [complex.id],
    );
    const lead = await submit(db, { phone: nextPhone(), complex: draft.rows[0]!.slug }, "{}");
    await db.admin.query("delete from complexes where id = $1", [draft.rows[0]!.id]);
    const row = (
      await db.admin.query<{ complex_id: string | null; subject: { slug: string } }>(
        "select complex_id, subject from leads where id = $1",
        [lead.id],
      )
    ).rows[0]!;
    expect(row.complex_id).toBeNull();
    expect(row.subject.slug).toBe("test-lead-complex");
  });
});

describe.skipIf(isRemoteTarget)("заявки: доставка и тревога", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await seededDb();
  });
  afterAll(() => db.close());

  const record = (lead: string, channel: string, ok: boolean) =>
    db.as(service, (tx) =>
      tx.query("select record_lead_delivery($1, $2::lead_channel, $3, $4)", [lead, channel, ok, ok ? null : "timeout"]),
    );
  const due = () =>
    db.as(service, async (tx) => (await tx.query<{ v: { id: string; channels: string[] }[] }>("select lead_deliveries_due(50) as v")).rows[0]!.v);

  const forDelivery = (id: string) =>
    db.as(service, async (tx) => (await tx.query<{ v: { channels: string[] } | null }>("select lead_for_delivery($1) as v", [id])).rows[0]!.v);

  it("ждущие каналы — в очереди; отправленный уходит; неудача — повтор позже; 10-я — «не доставлено»", async () => {
    const lead = await submit(db, { phone: nextPhone() });
    expect((await due()).find((item) => item.id === lead.id)?.channels).toEqual(["telegram", "sheet"]);
    await record(lead.id, "telegram", true);
    await record(lead.id, "sheet", false);
    expect((await due()).some((item) => item.id === lead.id)).toBe(false);
    const sheet = (
      await db.admin.query<{ state: string; attempts: number; later: boolean }>(
        "select state, attempts, next_at > now() as later from lead_deliveries where lead_id = $1 and channel = 'sheet'",
        [lead.id],
      )
    ).rows[0]!;
    expect(sheet).toEqual({ state: "pending", attempts: 1, later: true });
    for (let i = 0; i < 9; i++) await record(lead.id, "sheet", false);
    expect(await scalar(db, "select state::text as v from lead_deliveries where lead_id = $1 and channel = 'sheet'", [lead.id])).toBe(
      "failed",
    );
  });

  it("очередь забирает каналы: сервер отправил сразу — cron и второй вызов ту же заявку не шлют", async () => {
    const lead = await submit(db, { phone: nextPhone() });
    expect((await forDelivery(lead.id))?.channels).toEqual(["telegram", "sheet"]);
    expect(await forDelivery(lead.id)).toBeNull();
    expect((await due()).some((item) => item.id === lead.id)).toBe(false);
    // Итог не записался (сервер упал) — после аренды заявку подхватит cron.
    await db.admin.query("update lead_deliveries set claimed_until = now() - interval '1 second' where lead_id = $1", [lead.id]);
    expect((await due()).find((item) => item.id === lead.id)?.channels).toEqual(["telegram", "sheet"]);
  });

  it("«Повторить» во время отправки не снимает аренду: заявка не уходит второй раз", async () => {
    const lead = await submit(db, { phone: nextPhone() });
    for (let i = 0; i < 3; i++) await record(lead.id, "telegram", false);
    await db.admin.query("update lead_deliveries set next_at = now() - interval '1 second' where lead_id = $1", [lead.id]);
    expect((await due()).find((item) => item.id === lead.id)?.channels).toEqual(["telegram", "sheet"]);
    const manager = await createStaff(db.admin, "manager");
    await db.as(user(manager), (tx) => tx.query("select retry_lead_delivery($1, 'telegram')", [lead.id]));
    expect(await forDelivery(lead.id)).toBeNull();
    await record(lead.id, "telegram", true);
    expect(await scalar(db, "select claimed_until as v from lead_deliveries where lead_id = $1 and channel = 'telegram'", [lead.id])).toBeNull();
  });

  it("«Повторить» по каналу шлёт только его: у другого канала пауза повтора не нарушается", async () => {
    const lead = await submit(db, { phone: nextPhone() });
    await forDelivery(lead.id);
    await record(lead.id, "telegram", false);
    for (let i = 0; i < 10; i++) await record(lead.id, "sheet", false);
    const manager = await createStaff(db.admin, "manager");
    await db.as(user(manager), (tx) => tx.query("select retry_lead_delivery($1, 'sheet')", [lead.id]));
    expect((await forDelivery(lead.id))?.channels).toEqual(["sheet"]);
  });

  it("не дошла ни в один канал за 10 минут — тревога один раз; без каналов тревоги нет", async () => {
    const stuck = await submit(db, { phone: nextPhone() });
    const quiet = await submit(db, { phone: nextPhone() }, "{}");
    const sent = await submit(db, { phone: nextPhone() });
    await record(sent.id, "telegram", true);
    await db.admin.query("update leads set created_at = now() - interval '11 minutes' where id = any($1)", [
      [stuck.id, quiet.id, sent.id],
    ]);
    const take = () =>
      db.as(service, async (tx) => (await tx.query<{ v: { number: number }[] }>("select take_undelivered_leads(10) as v")).rows[0]!.v);
    expect((await take()).map((lead) => lead.number)).toEqual([stuck.number]);
    expect(await take()).toEqual([]);
  });

  it("сотрудник очередь не читает; «Повторить» — руководитель и менеджер, канал снова с нуля", async () => {
    const lead = await submit(db, { phone: nextPhone() });
    for (let i = 0; i < 10; i++) await record(lead.id, "sheet", false);
    const manager = await createStaff(db.admin, "manager");
    const videographer = await createStaff(db.admin, "videographer");
    await expectDenied(db.as(user(manager), (tx) => tx.query("select lead_deliveries_due(5)")));
    const retry = (actor: string) =>
      db.as(user(actor), (tx) => tx.query("select retry_lead_delivery($1, 'sheet')", [lead.id]));
    await expectHint(retry(videographer), "vh:forbidden");
    await retry(manager);
    expect(
      (await db.admin.query("select state, attempts from lead_deliveries where lead_id = $1 and channel = 'sheet'", [lead.id])).rows[0],
    ).toEqual({ state: "pending", attempts: 0 });
    await record(lead.id, "telegram", true);
    await expectHint(
      db.as(user(manager), (tx) => tx.query("select retry_lead_delivery($1, 'telegram')", [lead.id])),
      "vh:not_found",
    );
  });
});

describe.skipIf(isRemoteTarget)("заявки: кабинет", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let videographer: string;

  beforeAll(async () => {
    db = await seededDb();
    head = await createStaff(db.admin, "head", { fullName: "Нигора Руководитель" });
    manager = await createStaff(db.admin, "manager", { fullName: "Азиз Менеджер" });
    videographer = await createStaff(db.admin, "videographer");
  });
  afterAll(() => db.close());

  const screen = (actor: string, status: string | null = null, query: string | null = null) =>
    db.as(user(actor), async (tx) =>
      (await tx.query<{ v: { counts: Record<string, number>; total: number; rows: { number: number; assigned: { name: string } | null }[] } }>(
        "select leads_screen($1, null, $2) as v",
        [status, query],
      )).rows[0]!.v,
    );

  it("видеограф заявок не видит; руководитель и менеджер — список, счётчики, поиск", async () => {
    const slug = await scalar<string>(db, "select slug as v from complexes where status = 'published' limit 1");
    const a = await submit(db, { phone: "+998901112233", name: "Тимур", complex: slug }, "{}");
    await submit(db, { phone: "+998935556677", name: "Феруза" }, "{}");
    await expectHint(screen(videographer), "vh:forbidden");
    const visible = await db.as(user(videographer), (tx) =>
      tx.query<{ n: number }>("select count(*)::int as n from leads"),
    );
    expect(visible.rows[0]!.n).toBe(0);
    const all = await screen(manager);
    const total = await scalar<number>(db, "select count(*)::int as v from leads");
    expect(all.total).toBe(total);
    expect(all.counts.new).toBe(await scalar<number>(db, "select count(*)::int as v from leads where status = 'new'"));
    expect((await screen(head, null, "тим")).rows.map((row) => row.number)).toEqual([a.number]);
    expect((await screen(head, null, "1122")).rows.map((row) => row.number)).toEqual([a.number]);
    expect((await screen(head, null, `#${a.number}`)).rows.map((row) => row.number)).toEqual([a.number]);
  });

  it("ответственный: новая → «В работе»; видеографу заявку не поручить; статус меняется", async () => {
    const lead = await submit(db, { phone: nextPhone() }, "{}");
    const run = (actor: string, sql: string, params: unknown[]) => db.as(user(actor), (tx) => tx.query(sql, params));
    await expectHint(run(manager, "select assign_lead($1, $2)", [lead.id, videographer]), "vh:invalid");
    await run(manager, "select assign_lead($1, $2)", [lead.id, manager]);
    expect(
      (await db.admin.query("select status::text, assigned_to, updated_by from leads where id = $1", [lead.id])).rows[0],
    ).toEqual({ status: "work", assigned_to: manager, updated_by: manager });
    await run(head, "select set_lead_status($1, 'meeting')", [lead.id]);
    await expectHint(run(videographer, "select set_lead_status($1, 'deal')", [lead.id]), "vh:forbidden");
    expect(await scalar(db, "select status::text as v from leads where id = $1", [lead.id])).toBe("meeting");
  });

  it("карточка: повтор, ответственный первой заявки, снимок расчёта, кому поручить", async () => {
    const { slug, developer_id } = (
      await db.admin.query<{ slug: string; developer_id: string }>(
        "select slug, developer_id from complexes where status = 'published' limit 1",
      )
    ).rows[0]!;
    const program = await scalar<string>(db, "select id as v from payment_programs where developer_id = $1 and is_active limit 1", [
      developer_id,
    ]);
    const phone = nextPhone();
    const first = await submit(db, { phone, complex: slug }, "{}");
    await db.as(user(head), (tx) => tx.query("select assign_lead($1, $2)", [first.id, manager]));
    const second = await submit(
      db,
      { phone, complex: slug, type: "calc", calc: { program, input: { price: 1 }, result: { monthly: 2 } } },
      "{telegram}",
    );
    const card = await db.as(user(manager), async (tx) =>
      (await tx.query<{ v: Record<string, unknown> }>("select lead_card($1) as v", [second.number])).rows[0]!.v,
    );
    expect(card).not.toHaveProperty("client_key");
    expect(card.repeat_of).toMatchObject({ number: first.number, assigned: "Азиз Менеджер" });
    expect(card.calculation).toMatchObject({ result: { monthly: 2 } });
    expect(card.deliveries).toEqual([expect.objectContaining({ channel: "telegram", state: "pending" })]);
    expect((card.staff as { role: string }[]).map((person) => person.role).sort()).toEqual(["head", "manager"]);
    await expectHint(
      db.as(user(manager), (tx) => tx.query("select lead_card(1)")),
      "vh:not_found",
    );
  });

  it("главная: новые, за сегодня, в работе, встречи и шесть последних", async () => {
    const home = await db.as(user(manager), async (tx) =>
      (await tx.query<{ v: { new: number; today: number; work: number; meetings: number; latest: unknown[] } }>(
        "select leads_home() as v",
      )).rows[0]!.v,
    );
    const total = await scalar<number>(db, "select count(*)::int as v from leads");
    expect(home.today).toBe(total);
    expect(home.latest).toHaveLength(Math.min(total, 6));
    // Сверка с самой таблицей: тест не зависит от того, какие заявки создали соседи по describe.
    const count = (status: string) => scalar<number>(db, "select count(*)::int as v from leads where status = $1", [status]);
    expect(home.new).toBe(await count("new"));
    expect(home.work).toBe(await count("work"));
    expect(home.meetings).toBe(await count("meeting"));
    await expectHint(db.as(user(videographer), (tx) => tx.query("select leads_home()")), "vh:forbidden");
  });
});
