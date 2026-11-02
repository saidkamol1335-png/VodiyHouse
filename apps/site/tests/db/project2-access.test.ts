import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeComplexReady, seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  isRemoteTarget,
  user,
  type Actor,
  type TestDb,
} from "./harness";

// Проект-2, фаза B (PLAN §10, пп. 3–6, 10–13): хранимое состояние ЖК, записи сайта с подписью,
// запросы руководителю и приватные загрузки мобилографа. Права по ролям в целом — access-matrix.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../../../supabase/demo");
const SECRET = "test-site-signing-secret-0123456789abcdef";

/** Подпись сервера сайта: hex(HMAC-SHA256(secret, scope \n signed_at \n payload)) — 20261102130000. */
function sign(scope: string, payload: string, signedAt = Math.floor(Date.now() / 1000), secret = SECRET) {
  const signature = createHmac("sha256", secret).update(`${scope}\n${signedAt}\n${payload}`).digest("hex");
  return { signedAt, signature };
}

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

  it("пересчёт не пишет журнал: в audit_log нет полей состояния", async () => {
    const { rows } = await db.admin.query<{ n: number }>(
      `select count(*)::int as n from public.audit_log
       where changes ?| array['site_state', 'missing_count', 'is_complete']`,
    );
    expect(rows[0]!.n).toBe(0);
  });
});

describe.skipIf(isRemoteTarget)("записи сайта с подписью сервера (PLAN §10, п. 5)", () => {
  let db: TestDb;
  let ids: ContentIds;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    await db.admin.query("insert into vault.decrypted_secrets (name, decrypted_secret) values ('site_signing_secret', $1)", [SECRET]);
    await db.admin.query(`insert into settings (key, value) values ('leads.channels', '["telegram"]')`);
  });
  afterAll(() => db.close());

  const call = (fn: string, payload: string, signed: { signedAt: number; signature: string }, actor: Actor = anon) =>
    db.as(actor, async (tx) => (await tx.query<{ v: unknown }>(`select public.${fn}($1, $2, $3) as v`, [payload, signed.signedAt, signed.signature])).rows[0]!.v);

  it("заявка с верной подписью принята; каналы доставки — из настройки админки", async () => {
    const payload = JSON.stringify({ lead: { type: "callback", name: "Азиз", phone: "+998901112233", site_lang: "ru" }, client_key: "k1" });
    const lead = (await call("site_submit_lead", payload, sign("lead", payload))) as { id: string; number: number };
    expect(lead.number).toBeGreaterThan(0);
    const channels = await db.admin.query<{ channel: string }>("select channel::text from lead_deliveries where lead_id = $1", [lead.id]);
    expect(channels.rows).toEqual([{ channel: "telegram" }]);
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
    expect(await visible(head)).toHaveLength(4);
    expect(await visible(manager)).toHaveLength(0);
  });
});
