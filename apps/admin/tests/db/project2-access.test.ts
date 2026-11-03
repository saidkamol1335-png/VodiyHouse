import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeComplexReady, seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  isRemoteTarget,
  service,
  user,
  type Actor,
  type TestDb,
} from "./harness";

// Проект-2, фаза B (PLAN §10, пп. 3–6, 10–13): чтение и записи сайта, каналы и тревога заявок,
// запросы руководителю, приватные загрузки мобилографа.
// Хранимое состояние ЖК — site-state.test.ts; права по ролям в целом — access-matrix.

const SECRET = "test-site-signing-secret-0123456789abcdef";

/** Подпись сервера сайта: hex(HMAC-SHA256(secret, scope \n signed_at \n payload)) — 20261102130000. */
function sign(scope: string, payload: string, signedAt = Math.floor(Date.now() / 1000), secret = SECRET) {
  const signature = createHmac("sha256", secret).update(`${scope}\n${signedAt}\n${payload}`).digest("hex");
  return { signedAt, signature };
}

describe.skipIf(isRemoteTarget)("чтение сайта ролью посетителя (PLAN §10, п. 3)", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(`
      insert into settings (key, value, is_public) values
        ('site.contacts', '{"phone": "+998780000000"}', true),
        ('leads.telegram_chat', '"секрет"', false)
      on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;
    `);
  });
  afterAll(() => db.close());

  // Те же запросы, что lib/site/contacts.ts и lib/site/hints.ts шлют публичным ключом.
  it("контакты Vodiy House и включённые подсказки читаются; закрытые настройки — нет", async () => {
    const contacts = await db.as(anon, (tx) => tx.query<{ value: unknown }>("select value from public_settings where key = 'site.contacts'"));
    expect(contacts.rows).toEqual([{ value: { phone: "+998780000000" } }]);
    const secret = await db.as(anon, (tx) => tx.query("select value from public_settings where key = 'leads.telegram_chat'"));
    expect(secret.rows).toEqual([]);
    const hints = await db.as(anon, (tx) => tx.query<{ slug: string }>("select slug, term, text from public_hints"));
    expect(hints.rows.length).toBeGreaterThan(0);
  });

  it("таблицы настроек и подсказок посетителю закрыты", async () => {
    await expectDenied(db.as(anon, (tx) => tx.query("select key from settings")));
    await expectDenied(db.as(anon, (tx) => tx.query("select slug from hints")));
  });
});

describe.skipIf(isRemoteTarget)("записи сайта с подписью сервера (PLAN §10, п. 5)", () => {
  let db: TestDb;
  let ids: ContentIds;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    await db.admin.query("insert into vault.decrypted_secrets (name, decrypted_secret) values ('site_signing_secret', $1)", [SECRET]);
  });
  afterAll(() => db.close());

  const call = (fn: string, payload: string, signed: { signedAt: number; signature: string }, actor: Actor = anon) =>
    db.as(actor, async (tx) => (await tx.query<{ v: unknown }>(`select public.${fn}($1, $2, $3) as v`, [payload, signed.signedAt, signed.signature])).rows[0]!.v);

  const submitLead = async (phone: string) => {
    const payload = JSON.stringify({ lead: { type: "callback", name: "Азиз", phone, site_lang: "ru" }, client_key: `k-${phone}` });
    return (await call("site_submit_lead", payload, sign("lead", payload))) as { id: string; number: number };
  };
  const channelsOf = async (lead: string) =>
    (await db.admin.query<{ channel: string }>("select channel::text from lead_deliveries where lead_id = $1 order by channel", [lead])).rows.map(
      (row) => row.channel,
    );

  it("заявка с верной подписью принята и уходит в Telegram и Таблицу (каналы по умолчанию — миграция)", async () => {
    const lead = await submitLead("+998901112233");
    expect(lead.number).toBeGreaterThan(0);
    expect(await channelsOf(lead.id)).toEqual(["sheet", "telegram"]);
  });

  it("каналы задаёт админка: настройка leads.channels меняет доставку следующих заявок", async () => {
    await db.admin.query(`update settings set value = '["telegram"]' where key = 'leads.channels'`);
    expect(await channelsOf((await submitLead("+998901112277")).id)).toEqual(["telegram"]);
    await db.admin.query(`update settings set value = '["telegram", "sheet"]' where key = 'leads.channels'`);
  });

  it("не дошла за 10 минут — тревога один раз; дошла хотя бы одним каналом — тревоги нет", async () => {
    const lost = await submitLead("+998901112288");
    const delivered = await submitLead("+998901112299");
    await db.as(service, (tx) => tx.query("select public.record_lead_delivery($1, 'telegram', true, null)", [delivered.id]));
    await db.admin.query("update leads set created_at = now() - interval '11 minutes' where id = any($1)", [[lost.id, delivered.id]]);
    const alarm = async () =>
      (await db.as(service, (tx) => tx.query<{ v: { id: string }[] }>("select public.take_undelivered_leads() as v"))).rows[0]!.v.map(
        (lead) => lead.id,
      );
    const first = await alarm();
    expect(first).toContain(lost.id);
    expect(first).not.toContain(delivered.id);
    expect(await alarm()).not.toContain(lost.id);
  });

  it("подпись одноразовая: повтор того же запроса — отказ", async () => {
    const payload = JSON.stringify({ lead: { type: "callback", name: "Азиз", phone: "+998901112266", site_lang: "ru" } });
    const signed = sign("lead", payload);
    await call("site_submit_lead", payload, signed);
    await expectHint(call("site_submit_lead", payload, signed), "vh:bad_signature");
  });

  it("чужая, старая подпись или изменённая заявка — отказ; прямой вызов без подписи — нет прав", async () => {
    const payload = JSON.stringify({ lead: { type: "callback", phone: "+998901112244", site_lang: "ru" } });
    await expectHint(call("site_submit_lead", payload, sign("lead", payload, undefined, "x".repeat(40))), "vh:bad_signature");
    await expectHint(call("site_submit_lead", payload, sign("lead", payload, Math.floor(Date.now() / 1000) - 600)), "vh:bad_signature");
    await expectHint(call("site_submit_lead", payload.replace("244", "245"), sign("lead", payload)), "vh:bad_signature");
    // Подпись одного действия не подходит другому.
    await expectHint(call("site_create_tg_start", payload, sign("lead", payload)), "vh:bad_signature");
    await expectDenied(db.as(anon, (tx) => tx.query("select submit_lead('{}'::jsonb, '{}'::lead_channel[], null)")));
  });

  it("«Написать в Telegram» и события — тоже только с подписью", async () => {
    const start = JSON.stringify({ start: { site_lang: "uz" }, client_key: "k2" });
    expect(await call("site_create_tg_start", start, sign("tg-start", start))).toMatch(/^[A-Za-z0-9_-]+$/);
    const events = JSON.stringify({
      visitor: crypto.randomUUID(),
      session: crypto.randomUUID(),
      client_key: "k3",
      device: "mobile",
      lang: "ru",
      source: null,
      events: [{ type: "complex_view", path: "/ru/novostroyki/x", entity_type: "complex", entity_id: ids.publicComplex }],
    });
    expect(await call("site_track_events", events, sign("events", events))).toBe(1);
    await expectHint(call("site_track_events", events, sign("lead", events)), "vh:bad_signature");
  });

  it("без секрета в Vault записи сайта закрыты целиком", async () => {
    await db.admin.query("delete from vault.decrypted_secrets where name = 'site_signing_secret'");
    const payload = JSON.stringify({ lead: { type: "callback", phone: "+998901112255", site_lang: "ru" } });
    await expectHint(call("site_submit_lead", payload, sign("lead", payload)), "vh:unavailable");
  });
});

describe.skipIf(isRemoteTarget)("запросы руководителю (PLAN §10, п. 6)", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let mobilographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    mobilographer = await createStaff(db.admin, "mobilographer");
  });
  afterAll(() => db.close());

  const request = (actor: string, complex: string, kind: string, note: string | null = null) =>
    db.as(user(actor), async (tx) =>
      (await tx.query<{ id: string }>("select public.request_publication($1, $2, $3) as id", [complex, kind, note])).rows[0]!.id,
    );
  const requestRow = async (id: string) =>
    (await db.admin.query<{ status: string; answer: string | null }>("select status::text, answer from publication_requests where id = $1", [id])).rows[0]!;

  it("менеджер просит один раз на ЖК; запрос видят руководитель и менеджер, мобилограф — нет", async () => {
    const first = await request(manager, ids.draftComplex, "publish", "Проверьте фото");
    expect(await request(manager, ids.draftComplex, "publish")).toBe(first);
    await expectHint(request(mobilographer, ids.draftComplex, "publish"), "vh:forbidden");
    await expectHint(request(manager, ids.draftComplex, "hide"), "vh:status_move");
    const seen = async (actor: string) =>
      (await db.as(user(actor), (tx) => tx.query("select id from publication_requests"))).rows.length;
    expect(await seen(head)).toBe(1);
    expect(await seen(manager)).toBe(1);
    expect(await seen(mobilographer)).toBe(0);
  });

  it("отказ — с причиной; публикация руководителем закрывает запрос сама", async () => {
    const id = await request(manager, ids.draftComplex, "publish");
    await expect(
      db.as(user(head), (tx) => tx.query("select public.resolve_publication_request($1, 'declined')", [id])),
    ).rejects.toThrow();
    await db.as(user(head), (tx) => tx.query("select public.resolve_publication_request($1, 'declined', 'Нет обложки')", [id]));
    expect(await requestRow(id)).toEqual({ status: "declined", answer: "Нет обложки" });

    const again = await request(manager, ids.draftComplex, "publish");
    await makeComplexReady(db.admin, ids.draftComplex);
    await db.as(user(head), (tx) =>
      tx.query("update complexes set status = 'published', files_checked_at = now() where id = $1", [ids.draftComplex]),
    );
    expect((await requestRow(again)).status).toBe("done");
  });

  it("менеджер отзывает свой запрос, но не отклоняет", async () => {
    const id = await request(manager, ids.publicComplex, "hide");
    await expectHint(
      db.as(user(manager), (tx) => tx.query("select public.resolve_publication_request($1, 'declined', 'x')", [id])),
      "vh:forbidden",
    );
    await db.as(user(manager), (tx) => tx.query("select public.resolve_publication_request($1, 'cancelled')", [id]));
    expect((await requestRow(id)).status).toBe("cancelled");
  });

  it("запрос другого вида заменяет открытый; смена статуса снимает и чужой запрос", async () => {
    const hide = await request(manager, ids.publicComplex, "hide");
    const archive = await request(manager, ids.publicComplex, "archive");
    expect((await requestRow(hide)).status).toBe("cancelled");
    await db.as(user(head), (tx) => tx.query("update complexes set status = 'hidden' where id = $1", [ids.publicComplex]));
    expect((await requestRow(archive)).status).toBe("cancelled");
    await makeComplexReady(db.admin, ids.publicComplex);
    await db.as(user(head), (tx) =>
      tx.query("update complexes set status = 'published', files_checked_at = now() where id = $1", [ids.publicComplex]),
    );
  });

  it("опубликованный ЖК не ухудшить и прямой записью: фото, тип рендеров — отказ; застройщика менеджер не меняет", async () => {
    await expectHint(
      db.as(user(manager), (tx) => tx.query("delete from media_assets where complex_id = $1 and kind = 'photo'", [ids.publicComplex])),
      "vh:not_ready",
    );
    await expectHint(
      db.as(user(manager), (tx) => tx.query("update media_assets set photo_category = 'real' where complex_id = $1 and kind = 'photo'", [ids.publicComplex])),
      "vh:not_ready",
    );
    await expectHint(
      db.as(user(manager), (tx) => tx.query("update complexes set developer_id = $2 where id = $1", [ids.publicComplex, ids.draftDeveloper])),
      "vh:head_only",
    );
  });

  it("менеджер правит ЖК, но не статус, отметку 1.2, архив и порядок", async () => {
    await db.as(user(manager), (tx) => tx.query("update complexes set lat = lat where id = $1", [ids.publicComplex]));
    for (const change of ["status = 'hidden'", "files_checked_at = now()", "archived_at = now()", "sort = sort + 1"]) {
      await expectHint(
        db.as(user(manager), (tx) => tx.query(`update complexes set ${change} where id = $1`, [ids.publicComplex])),
        "vh:head_only",
      );
    }
  });
});

describe.skipIf(isRemoteTarget)("бакет incoming — загрузки мобилографа до проверки (PLAN §10, п. 13)", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let mobilographer: string;
  let other: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    mobilographer = await createStaff(db.admin, "mobilographer");
    other = await createStaff(db.admin, "mobilographer");
  });
  afterAll(() => db.close());

  const file = (author: string, ext = "jpg") => `${author}/${ids.publicComplex}/${crypto.randomUUID()}.${ext}`;
  const upload = (actor: Actor, name: string) =>
    db.as(actor, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ('incoming', $1)", [name]));
  const visible = async (actor: string) =>
    (await db.as(user(actor), (tx) => tx.query<{ name: string }>("select name from storage.objects where bucket_id = 'incoming'"))).rows.map((row) => row.name);

  it("бакет приватный: только JPEG и MP4", async () => {
    const { rows } = await db.admin.query<{ public: boolean; allowed_mime_types: string[] }>(
      "select public, allowed_mime_types from storage.buckets where id = 'incoming'",
    );
    expect(rows[0]).toEqual({ public: false, allowed_mime_types: ["image/jpeg", "video/mp4"] });
  });

  it("мобилограф кладёт только в свою папку; менеджер и посетитель — нет", async () => {
    const own = file(mobilographer);
    await upload(user(mobilographer), own);
    await upload(user(mobilographer), file(mobilographer, "mp4"));
    await expectDenied(upload(user(mobilographer), file(other)));
    await expectDenied(upload(user(mobilographer), `${mobilographer}/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`));
    await expectDenied(upload(user(manager), file(manager)));
    await expectDenied(upload(anon, file(mobilographer)));
    await upload(user(other), file(other));
    await upload(user(head), file(head));

    expect(await visible(mobilographer)).toHaveLength(2);
    expect((await visible(mobilographer)).every((name) => name.startsWith(`${mobilographer}/`))).toBe(true);
    // Фаза E: и руководитель видит только свою папку — чужие файлы ему подписывает сервер.
    expect(await visible(head)).toEqual([expect.stringMatching(new RegExp(`^${head}/`))]);
    expect(await visible(manager)).toHaveLength(0);
  });

  it("файл отчёта на проверке не удалить и не загрузить заново; свой файл черновика — можно удалить", async () => {
    const remove = (actor: string, name: string) =>
      db.as(user(actor), async (tx) => {
        await tx.query("select set_config('storage.allow_delete_query', 'true', true)");
        return tx.query("delete from storage.objects where bucket_id = 'incoming' and name = $1", [name]);
      });
    const today = (await db.admin.query<{ d: string }>("select private.tashkent_today()::text as d")).rows[0]!.d;
    const names = [file(mobilographer), file(mobilographer), file(mobilographer)];
    for (const name of names) {
      await db.admin.query(
        "insert into storage.objects (bucket_id, name, metadata) values ('incoming', $1, '{\"mimetype\": \"image/jpeg\", \"size\": 1000}')",
        [name],
      );
    }
    const body = (id?: string) =>
      JSON.stringify({
        id,
        block_id: ids.publicBlock,
        unit_id: ids.units[0],
        shot_on: today,
        comment: { ru: "Двор", uz: "Hovli" },
        photos: names.map((path) => ({ path, width: 10, height: 10 })),
      });
    const draft = (
      await db.as(user(mobilographer), (tx) => tx.query<{ r: { id: string } }>("select public.save_progress_draft($1) as r", [body()]))
    ).rows[0]!.r.id;
    await expectDenied(upload(user(mobilographer), names[0]!));
    await db.as(user(mobilographer), (tx) => tx.query("select public.submit_progress_report($1)", [body(draft)]));
    expect((await remove(mobilographer, names[0]!)).affectedRows).toBe(0);
    expect((await remove(other, names[0]!)).affectedRows).toBe(0);
    const loose = file(mobilographer);
    await upload(user(mobilographer), loose);
    expect((await remove(other, loose)).affectedRows).toBe(0);
    expect((await remove(mobilographer, loose)).affectedRows).toBe(1);
  });
});
