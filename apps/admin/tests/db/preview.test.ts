import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import { anon, createStaff, createTestDb, expectHint, isRemoteTarget, user, type Db, type TestDb } from "./harness";

// Предпросмотр ЖК на сайте по гранту кабинета (PLAN §10, фаза C; 20261102190000): сайт шлёт токен
// заголовком x-vh-preview, функции сайта видят черновик только с действующим грантом.

describe.skipIf(isRemoteTarget)("предпросмотр по гранту", () => {
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

  const grant = (actor: string, complex: string) =>
    db.as(user(actor), async (tx) =>
      (await tx.query<{ token: string }>("select public.create_preview_grant($1) as token", [complex])).rows[0]!.token,
    );
  /** Страница ЖК ролью посетителя; token — заголовок предпросмотра, как шлёт сайт. */
  const page = (slug: string, token?: string) =>
    db.as(anon, async (tx: Db) => {
      if (token) await tx.query("select set_config('request.headers', $1, true)", [JSON.stringify({ "x-vh-preview": token })]);
      return (await tx.query<{ page: unknown }>("select public.site_complex($1) as page", [slug])).rows[0]!.page;
    });

  it("менеджер и руководитель берут грант на 15 минут; мобилограф и посетитель — нет", async () => {
    expect(await grant(manager, ids.draftComplex)).toMatch(/^[0-9a-f]{48}$/);
    expect(await grant(head, ids.draftComplex)).toMatch(/^[0-9a-f]{48}$/);
    await expectHint(grant(mobilographer, ids.draftComplex), "vh:forbidden");
    await expect(db.as(anon, (tx) => tx.query("select public.create_preview_grant($1)", [ids.draftComplex]))).rejects.toThrow(/permission denied/);
    const { rows } = await db.admin.query<{ minutes: number }>(
      "select round(extract(epoch from max(expires_at) - now()) / 60)::int as minutes from private.preview_grants",
    );
    expect(rows[0]!.minutes).toBe(15);
  });

  it("черновик виден посетителю только с действующим грантом своего ЖК", async () => {
    expect(await page("draft-zhk")).toBeNull();
    const token = await grant(manager, ids.draftComplex);
    const preview = (await page("draft-zhk", token)) as { complex: { on_site: boolean } } | null;
    expect(preview).not.toBeNull();
    // Пометка предпросмотра «посетитель не видит» — по настоящей публикации, не по гранту.
    expect(preview!.complex.on_site).toBe(false);
    expect(await page("draft-zhk", "0".repeat(48))).toBeNull();
    expect(await page("draft-zhk", "не токен")).toBeNull();

    const other = await grant(manager, ids.hiddenComplex);
    expect(await page("draft-zhk", other)).toBeNull();

    await db.admin.query("update private.preview_grants set expires_at = now() - interval '1 minute'");
    expect(await page("draft-zhk", token)).toBeNull();
  });

  it("без заголовка опубликованный ЖК виден как раньше", async () => {
    const slug = (await db.admin.query<{ slug: string }>("select slug from complexes where id = $1", [ids.publicComplex])).rows[0]!.slug;
    expect(await page(slug)).not.toBeNull();
  });
});

describe.skipIf(isRemoteTarget)("сайт проверяет грант до включения предпросмотра", () => {
  let db: TestDb;
  let ids: ContentIds;
  let manager: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  const slugFor = (token?: string) =>
    db.as(anon, async (tx: Db) => {
      if (token) await tx.query("select set_config('request.headers', $1, true)", [JSON.stringify({ "x-vh-preview": token })]);
      return (await tx.query<{ slug: string | null }>("select public.site_preview_slug() as slug")).rows[0]!.slug;
    });

  it("site_preview_slug: slug ЖК из действующего гранта, без гранта — null", async () => {
    const token = await db.as(user(manager), async (tx) =>
      (await tx.query<{ token: string }>("select public.create_preview_grant($1) as token", [ids.draftComplex])).rows[0]!.token,
    );
    expect(await slugFor(token)).toBe("draft-zhk");
    expect(await slugFor("1".repeat(48))).toBeNull();
    expect(await slugFor()).toBeNull();
  });
});
