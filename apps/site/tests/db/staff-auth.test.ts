import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  createAuthUser,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  service,
  user,
  type TestDb,
} from "./harness";

// Шаг 8: профиль добавляет руководитель своей сессией, «Новый пароль», флаг смены пароля,
// отключение и список «Сотрудники» (миграция 20261020120000_staff_auth.sql).
describe("вход сотрудников и «Сотрудники»", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let videographer: string;
  let inactiveHead: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head", { fullName: "Бахтиёр Каримов", mustChangePassword: false });
    manager = await createStaff(db.admin, "manager", { fullName: "Дилноза Юсупова" });
    videographer = await createStaff(db.admin, "videographer", { fullName: "Сардор Алиев" });
    inactiveHead = await createStaff(db.admin, "head", { fullName: "Нигора Саидова", isActive: false });
  });
  afterAll(() => db.close());

  const profileOf = async (id: string) =>
    (
      await db.admin.query<{ role: string; is_active: boolean; must_change_password: boolean }>(
        "select role, is_active, must_change_password from profiles where id = $1",
        [id],
      )
    ).rows[0];

  const lastAudit = async (id: string) =>
    (
      await db.admin.query<{ actor_id: string | null; action: string; changes: Record<string, unknown> }>(
        "select actor_id, action, changes from audit_log where entity = 'profiles' and entity_id = $1 order by id desc limit 1",
        [id],
      )
    ).rows[0];

  const sessionsOf = async (id: string) =>
    (await db.admin.query("select id from auth.sessions where user_id = $1", [id])).rows.length;
  const openSession = (id: string) =>
    db.admin.query("insert into auth.sessions (id, user_id) values (gen_random_uuid(), $1)", [id]);

  const insertProfile = "insert into profiles (id, full_name, role) values ($1, 'Азиз Рахимов', 'manager') returning id";

  it("руководитель добавляет профиль своей сессией: активен, ждёт смены пароля, автор в журнале — он", async () => {
    const id = await createAuthUser(db.admin);
    const { rows } = await db.as(user(head), (tx) => tx.query(insertProfile, [id]));
    expect(rows).toHaveLength(1);
    expect(await profileOf(id)).toEqual({ role: "manager", is_active: true, must_change_password: true });
    const audit = await lastAudit(id);
    expect(audit).toMatchObject({ actor_id: head, action: "insert" });
    expect(audit?.changes.must_change_password).toBe(true);
  });

  it("при добавлении нельзя задать is_active или must_change_password", async () => {
    const id = await createAuthUser(db.admin);
    await expectDenied(
      db.as(user(head), (tx) =>
        tx.query("insert into profiles (id, full_name, role, is_active) values ($1, 'А', 'manager', false)", [id]),
      ),
    );
    await expectDenied(
      db.as(user(head), (tx) =>
        tx.query(
          "insert into profiles (id, full_name, role, must_change_password) values ($1, 'А', 'manager', false)",
          [id],
        ),
      ),
    );
    const privilege = (column: string) =>
      db.admin
        .query<{ ok: boolean }>("select has_column_privilege('authenticated', 'public.profiles', $1, 'INSERT') as ok", [
          column,
        ])
        .then((result) => result.rows[0]?.ok);
    expect(await privilege("must_change_password")).toBe(false);
    expect(await privilege("is_active")).toBe(false);
    expect(await privilege("full_name")).toBe(true);
  });

  it("менеджер, видеограф, отключённый руководитель и посетитель профиль не добавляют", async () => {
    for (const actor of [user(manager), user(videographer), user(inactiveHead), anon]) {
      const id = await createAuthUser(db.admin);
      await expectDenied(db.as(actor, (tx) => tx.query(insertProfile, [id])));
    }
  });

  it("сервер добавляет профиль — путь первого руководителя, автора в журнале нет", async () => {
    const id = await createAuthUser(db.admin);
    await db.as(service, (tx) =>
      tx.query("insert into profiles (id, full_name, role) values ($1, 'Первый', 'head')", [id]),
    );
    expect((await profileOf(id))?.role).toBe("head");
    expect((await lastAudit(id))?.actor_id).toBeNull();
  });

  it("профиль никто через API не удаляет", async () => {
    await expectDenied(db.as(user(head), (tx) => tx.query("delete from profiles where id = $1", [manager])));
  });

  it("«Новый пароль»: руководитель — другому; флаг true, журнал [false, true], автор — руководитель", async () => {
    const staff = await createStaff(db.admin, "manager", { mustChangePassword: false });
    await db.as(user(head), (tx) => tx.query("select public.require_password_change($1)", [staff]));
    expect((await profileOf(staff))?.must_change_password).toBe(true);
    expect(await lastAudit(staff)).toMatchObject({
      actor_id: head,
      action: "update",
      changes: { must_change_password: [false, true] },
    });
  });

  it("«Новый пароль»: себе — vh:self; менеджеру и отключённому — vh:forbidden; неизвестный — vh:not_found", async () => {
    const call = "select public.require_password_change($1)";
    await expectHint(db.as(user(head), (tx) => tx.query(call, [head])), "vh:self");
    await expectHint(db.as(user(manager), (tx) => tx.query(call, [videographer])), "vh:forbidden");
    await expectHint(db.as(user(inactiveHead), (tx) => tx.query(call, [manager])), "vh:forbidden");
    await expectHint(db.as(user(head), (tx) => tx.query(call, [crypto.randomUUID()])), "vh:not_found");
    await expectDenied(db.as(anon, (tx) => tx.query(call, [manager])));
  });

  it("флаг смены пароля снимает только сервер: автора в журнале нет, запись — о сотруднике", async () => {
    const staff = await createStaff(db.admin, "manager", { mustChangePassword: true });
    const clear = "update profiles set must_change_password = false where id = $1";
    await expectDenied(db.as(user(staff), (tx) => tx.query(clear, [staff])));
    await db.as(service, (tx) => tx.query(clear, [staff]));
    expect((await profileOf(staff))?.must_change_password).toBe(false);
    expect(await lastAudit(staff)).toMatchObject({ actor_id: null, changes: { must_change_password: [true, false] } });
  });

  const setStatus = "select (public.set_units_status(null, array[]::uuid[], 'free') ->> 'changed')::int as changed";
  /** iat токена, выданного после закрытия сессий сотрудника (новый вход). */
  const freshIat = async (id: string) =>
    (
      await db.admin.query<{ iat: number }>(
        "select floor(extract(epoch from sessions_revoked_at))::int + 1 as iat from profiles where id = $1",
        [id],
      )
    ).rows[0]!.iat;

  it("отключение действует со следующего запроса; после включения — только новый вход", async () => {
    const staff = await createStaff(db.admin, "manager");
    expect((await db.as(user(staff), (tx) => tx.query(setStatus))).rows[0]).toEqual({ changed: 0 });

    await db.as(user(head), (tx) => tx.query("update profiles set is_active = false where id = $1", [staff]));
    await expect(db.as(user(staff), (tx) => tx.query(setStatus))).rejects.toThrow(/руководитель и менеджер/);
    const seen = await db.as(user(staff), (tx) => tx.query<{ id: string }>("select id from profiles"));
    expect(seen.rows.map((row) => row.id)).toEqual([staff]);

    await db.as(user(head), (tx) => tx.query("update profiles set is_active = true where id = $1", [staff]));
    await expect(db.as(user(staff), (tx) => tx.query(setStatus))).rejects.toThrow(/руководитель и менеджер/);
    const fresh = user(staff, await freshIat(staff));
    expect((await db.as(fresh, (tx) => tx.query(setStatus))).rows[0]).toEqual({ changed: 0 });
  });

  // Проверка безопасности 29.10 (20261029050000): украденная сессия после «Новый пароль» не работает
  // через Data API, а «Новый пароль» и «Отключить» закрывают открытые сессии.
  it("с флагом смены пароля прав роли нет: только свой профиль; после смены — права возвращаются", async () => {
    const staff = await createStaff(db.admin, "manager", { mustChangePassword: true });
    await expect(db.as(user(staff), (tx) => tx.query(setStatus))).rejects.toThrow(/руководитель и менеджер/);
    const seen = await db.as(user(staff), (tx) => tx.query<{ id: string }>("select id from profiles"));
    expect(seen.rows.map((row) => row.id)).toEqual([staff]);

    await db.as(service, (tx) => tx.query("update profiles set must_change_password = false where id = $1", [staff]));
    expect((await db.as(user(staff), (tx) => tx.query(setStatus))).rows[0]).toEqual({ changed: 0 });
  });

  it("после «Новый пароль» старый токен прав не получает и когда флаг снят; новый — получает", async () => {
    const staff = await createStaff(db.admin, "manager");
    await db.as(user(head), (tx) => tx.query("select public.require_password_change($1)", [staff]));
    await db.as(service, (tx) => tx.query("update profiles set must_change_password = false where id = $1", [staff]));
    await expect(db.as(user(staff), (tx) => tx.query(setStatus))).rejects.toThrow(/руководитель и менеджер/);
    const revokedAt = (await freshIat(staff)) - 1;
    await expect(db.as(user(staff, revokedAt), (tx) => tx.query(setStatus))).rejects.toThrow(/руководитель и менеджер/);
    expect((await db.as(user(staff, revokedAt + 1), (tx) => tx.query(setStatus))).rows[0]).toEqual({ changed: 0 });
  });

  it("флаг смены пароля сервером или скриптом (false → true) тоже закрывает сессии", async () => {
    const staff = await createStaff(db.admin, "manager");
    await openSession(staff);
    await db.as(service, (tx) => tx.query("update profiles set must_change_password = true where id = $1", [staff]));
    expect(await sessionsOf(staff)).toBe(0);
  });

  it("«Новый пароль» при уже стоящем флаге всё равно закрывает сессии", async () => {
    const staff = await createStaff(db.admin, "manager", { mustChangePassword: true });
    await openSession(staff);
    await db.as(user(head), (tx) => tx.query("select public.require_password_change($1)", [staff]));
    expect(await sessionsOf(staff)).toBe(0);
  });

  it("«Новый пароль» закрывает все сессии сотрудника, чужие — нет", async () => {
    const staff = await createStaff(db.admin, "manager");
    await openSession(staff);
    await openSession(staff);
    await openSession(head);
    await db.as(user(head), (tx) => tx.query("select public.require_password_change($1)", [staff]));
    expect(await sessionsOf(staff)).toBe(0);
    expect(await sessionsOf(head)).toBeGreaterThan(0);
  });

  it("«Отключить» закрывает сессии; правка имени и «Включить» — нет", async () => {
    const staff = await createStaff(db.admin, "manager");
    await openSession(staff);
    await db.as(user(head), (tx) => tx.query("update profiles set full_name = 'Новое имя' where id = $1", [staff]));
    expect(await sessionsOf(staff)).toBe(1);
    await db.as(user(head), (tx) => tx.query("update profiles set is_active = false where id = $1", [staff]));
    expect(await sessionsOf(staff)).toBe(0);
    await openSession(staff);
    await db.as(user(head), (tx) => tx.query("update profiles set is_active = true where id = $1", [staff]));
    expect(await sessionsOf(staff)).toBe(1);
  });

  it("повышение до руководителя действует без нового входа", async () => {
    const staff = await createStaff(db.admin, "manager");
    const addHint = `insert into hints (slug, term, text)
      values ('t-${crypto.randomUUID().slice(0, 8)}', '{"ru":"Т","uz":"T"}', '{"ru":"Т","uz":"T"}')`;
    await expectDenied(db.as(user(staff), (tx) => tx.query(addHint)));
    await db.as(user(head), (tx) => tx.query("update profiles set role = 'head' where id = $1", [staff]));
    await db.as(user(staff), (tx) => tx.query(addHint));
  });

  it("staff_directory: руководителю — все с email, последним входом и баном, отключённые в конце", async () => {
    const banned = await createStaff(db.admin, "manager", { fullName: "Жасур Тошматов", email: "jasur@test.local" });
    await db.admin.query(
      "update auth.users set banned_until = now() + interval '1 day', last_sign_in_at = '2026-10-19 09:30+05' where id = $1",
      [banned],
    );
    await db.admin.query("update auth.users set banned_until = now() - interval '1 day' where id = $1", [manager]);

    type Row = { id: string; email: string; banned: boolean; is_active: boolean; last_sign_in_at: Date | null };
    const { rows } = await db.as(user(head), (tx) => tx.query<Row>("select * from public.staff_directory()"));
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(banned)).toMatchObject({ email: "jasur@test.local", banned: true });
    expect(byId.get(banned)?.last_sign_in_at).not.toBeNull();
    expect(byId.get(manager)?.banned).toBe(false);
    const firstInactive = rows.findIndex((row) => !row.is_active);
    const lastActive = rows.map((row) => row.is_active).lastIndexOf(true);
    expect(firstInactive).toBeGreaterThan(lastActive);
  });

  it("staff_directory: менеджеру и отключённому руководителю — пусто; посетителю — нет права", async () => {
    const directory = "select * from public.staff_directory()";
    expect((await db.as(user(manager), (tx) => tx.query(directory))).rows).toHaveLength(0);
    expect((await db.as(user(inactiveHead), (tx) => tx.query(directory))).rows).toHaveLength(0);
    await expectDenied(db.as(anon, (tx) => tx.query(directory)));
  });

  it("права: сервер пишет profiles явно; посетитель не вызывает функции сотрудников", async () => {
    const check = async (sql: string) => (await db.admin.query<{ ok: boolean }>(`select ${sql} as ok`)).rows[0]?.ok;
    // Каждое право отдельно: список через запятую даёт true, если есть хотя бы одно.
    expect(await check("has_table_privilege('service_role', 'public.profiles', 'INSERT')")).toBe(true);
    expect(await check("has_table_privilege('service_role', 'public.profiles', 'UPDATE')")).toBe(true);
    expect(await check("has_function_privilege('anon', 'public.staff_directory()', 'EXECUTE')")).toBe(false);
    expect(await check("has_function_privilege('anon', 'public.require_password_change(uuid)', 'EXECUTE')")).toBe(
      false,
    );
    expect(await check("has_function_privilege('authenticated', 'private.keep_active_head()', 'EXECUTE')")).toBe(
      false,
    );
    expect(await check("has_function_privilege('authenticated', 'private.end_staff_sessions(uuid)', 'EXECUTE')")).toBe(
      false,
    );
  });
});
