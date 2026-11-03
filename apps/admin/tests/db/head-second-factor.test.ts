import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, isRemoteTarget, service, type Actor, type TestDb } from "./harness";

// Фаза D (20261103110000, PLAN §10 пп. 8, 28): права руководителя — только со вторым фактором не
// старше 30 дней; менеджеру и мобилографу фактор не нужен. Хранилище фактора — только сервер.

describe.skipIf(isRemoteTarget)("второй фактор руководителя", () => {
  let db: TestDb;
  let head: string;
  let manager: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  const roleOf = async (actor: Actor) =>
    (await db.as(actor, (tx) => tx.query<{ role: string | null }>("select private.staff_role() as role"))).rows[0]!.role;
  const call = <T>(sql: string, params: unknown[] = []) =>
    db.as(service, async (tx) => (await tx.query<{ v: T }>(sql, params)).rows[0]!.v);
  const daysAgo = (days: number) => Math.floor(Date.now() / 1000) - days * 86_400;

  it("руководитель — только aal2 с TOTP не старше 30 дней; менеджер — и без фактора", async () => {
    expect(await roleOf({ kind: "user", id: head })).toBe("head");
    expect(await roleOf({ kind: "user", id: head, aal: "aal1" })).toBeNull();
    expect(await roleOf({ kind: "user", id: head, totpAt: daysAgo(29) })).toBe("head");
    expect(await roleOf({ kind: "user", id: head, totpAt: daysAgo(31) })).toBeNull();
    expect(await roleOf({ kind: "user", id: manager, aal: "aal1" })).toBe("manager");
  });

  it("свой TOTP-фактор в обход кабинета прав не даёт: сессия должна быть подтверждена фактором сервера", async () => {
    const foreign = crypto.randomUUID();
    await db.admin.query("insert into auth.sessions (id, user_id, factor_id, aal) values ($1, $2, gen_random_uuid(), 'aal2')", [foreign, head]);
    expect(await roleOf({ kind: "user", id: head, sessionId: foreign })).toBeNull();
    expect(await roleOf({ kind: "user", id: head, sessionId: crypto.randomUUID() })).toBeNull();
    const ok = await db.as({ kind: "user", id: head }, (tx) => tx.query<{ v: boolean }>("select own_head_factor() as v"));
    expect(ok.rows[0]!.v).toBe(true);
    const bad = await db.as({ kind: "user", id: head, sessionId: foreign }, (tx) => tx.query<{ v: boolean }>("select own_head_factor() as v"));
    expect(bad.rows[0]!.v).toBe(false);
  });

  it("руководитель без фактора не правит, как посетитель", async () => {
    const insert = `insert into finishings (slug, name) values ('aal1-try', '{"ru": "Т", "uz": "T"}')`;
    await expectDenied(db.as({ kind: "user", id: head, aal: "aal1" }, (tx) => tx.query(insert)));
  });

  it("привязка Telegram: ссылка 15 минут, одна; повторная привязка — только сбросом", async () => {
    expect(await call<boolean>("select create_staff_telegram_link($1, 'h1') as v", [head])).toBe(true);
    expect(await call<string | null>("select complete_staff_telegram_link('nope', 42) as v")).toBeNull();
    expect(await call<string>("select complete_staff_telegram_link('h1', 42) as v")).toBe(head);
    expect(await call<string | null>("select complete_staff_telegram_link('h1', 43) as v")).toBeNull();
    expect(Number(await call<string>("select staff_telegram_chat($1) as v", [head]))).toBe(42);
    expect(await call<boolean>("select create_staff_telegram_link($1, 'h2') as v", [head])).toBe(false);
    expect(await call<{ telegram: boolean }>("select head_factor_state($1) as v", [head])).toMatchObject({ telegram: true, backup_left: 0 });
  });

  it("код входа: раз в минуту, 5 попыток, верный сгорает", async () => {
    expect(await call<boolean>("select issue_head_code($1, 'c1') as v", [head])).toBe(true);
    expect(await call<boolean>("select issue_head_code($1, 'c2') as v", [head])).toBe(false);
    for (let i = 0; i < 5; i += 1) expect(await call<boolean>("select check_head_code($1, 'bad') as v", [head])).toBe(false);
    expect(await call<boolean>("select check_head_code($1, 'c1') as v", [head])).toBe(false);
    await db.admin.query("update private.head_codes set sent_at = now() - interval '2 minutes'");
    expect(await call<boolean>("select issue_head_code($1, 'c3') as v", [head])).toBe(true);
    expect(await call<boolean>("select check_head_code($1, 'c3') as v", [head])).toBe(true);
    expect(await call<boolean>("select check_head_code($1, 'c3') as v", [head])).toBe(false);
  });

  it("неверные коды: после 10 за сутки не проходит и верный", async () => {
    await db.admin.query("update private.head_codes set sent_at = now() - interval '2 minutes'");
    await db.admin.query("delete from private.head_factor_failures");
    expect(await call<boolean>("select issue_head_code($1, 'lim') as v", [head])).toBe(true);
    for (let i = 0; i < 10; i += 1) await call("select use_head_backup_code($1, 'nope') as v", [head]);
    expect(await call<boolean>("select check_head_code($1, 'lim') as v", [head])).toBe(false);
    await db.admin.query("update private.head_factor_failures set window_start = now() - interval '2 days'");
    expect(await call<boolean>("select check_head_code($1, 'lim') as v", [head])).toBe(true);
  });

  it("запасные коды — одноразовые, новый набор заменяет старый; сброс убирает всё", async () => {
    await call("select save_head_backup_codes($1, array['b1','b2']) as v", [head]);
    expect(await call<boolean>("select use_head_backup_code($1, 'b1') as v", [head])).toBe(true);
    expect(await call<boolean>("select use_head_backup_code($1, 'b1') as v", [head])).toBe(false);
    await call("select save_head_backup_codes($1, array['b3']) as v", [head]);
    expect(await call<boolean>("select use_head_backup_code($1, 'b2') as v", [head])).toBe(false);
    await call("select save_head_totp($1, gen_random_uuid(), 'JBSWY3DPEHPK3PXP') as v", [head]);
    await call("select reset_head_second_factor($1) as v", [head]);
    expect(await call<object>("select head_factor_state($1) as v", [head])).toMatchObject({ telegram: false, factor_id: null, backup_left: 0 });
    // Выданные до сброса токены больше не действуют, сессии закрыты.
    expect(await roleOf({ kind: "user", id: head, iat: Math.floor(Date.now() / 1000) - 60 })).toBeNull();
    expect((await db.admin.query("select 1 from auth.sessions where user_id = $1", [head])).rows).toHaveLength(0);
  });

  it("хранилище и функции фактора — только сервер", async () => {
    for (const actor of [anon, { kind: "user", id: head } as Actor, { kind: "user", id: manager } as Actor]) {
      await expectDenied(db.as(actor, (tx) => tx.query("select head_totp_secret($1)", [head])));
      await expectDenied(db.as(actor, (tx) => tx.query("select issue_head_code($1, 'x')", [head])));
      await expectDenied(db.as(actor, (tx) => tx.query("select * from private.head_totp")));
    }
  });
});
