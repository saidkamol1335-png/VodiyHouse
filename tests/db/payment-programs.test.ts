import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ContentIds, seedContent } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  service,
  user,
  type Db,
  type TestDb,
} from "./harness";

// Фаза 2 · шаг 2.2: программы оплаты, курс, снимки расчётов (20261024100000_payment_programs.sql).

type Program = Record<string, unknown>;

const SCHEME_TIERS = [
  { min_down_pct: 30, discount_pct: 0, min_months: 1, max_months: 36 },
  { min_down_pct: 50, discount_pct: 6, min_months: 1, max_months: 18 },
];

describe("программы оплаты", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let otherManager: string;
  let videographer: string;
  let content: ContentIds;
  let bankId: number;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    otherManager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");
    content = await seedContent(db.admin);
    const { rows } = await db.admin.query<{ id: number }>(
      `insert into banks (slug, name) values ('ipoteka', '{"ru": "Ipoteka Bank", "uz": "Ipoteka Bank"}') returning id`,
    );
    bankId = rows[0]!.id;
  });
  afterAll(() => db.close());

  const full = (patch: Program = {}): Program => ({
    developer_id: content.publicDeveloper,
    type: "full",
    discount_pct: 12,
    ...patch,
  });
  const scheme = (patch: Program = {}): Program => ({
    developer_id: content.publicDeveloper,
    type: "installment",
    method: "tiers",
    tiers: SCHEME_TIERS,
    preset_months: [12, 24, 36, 48],
    allow_custom_months: true,
    ...patch,
  });
  const bank = (patch: Program = {}): Program => ({
    developer_id: content.publicDeveloper,
    bank_id: bankId,
    type: "bank_installment",
    method: "annuity",
    min_down_pct: 20,
    currency: "UZS",
    terms: [
      { months: 12, rate_pct: 16 },
      { months: 24, rate_pct: 18 },
    ],
    fees: [{ name: "commission", kind: "pct", value: 1 }],
    ...patch,
  });

  const save = (actor: string, program: Program) =>
    db.as(user(actor), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "select save_payment_program($1::jsonb) as id",
        [JSON.stringify(program)],
      );
      return rows[0]!.id;
    });
  const asHead = <T>(run: (tx: Db) => Promise<T>) => db.as(user(head), run);
  const setActive = (id: string, active: boolean) =>
    asHead((tx) => tx.query("select set_payment_program_active($1, $2)", [id, active]));
  const programRow = async (id: string) =>
    (
      await db.admin.query<{
        is_active: boolean;
        sort: number;
        block_ids: string[];
        blocks_scope: string;
      }>("select is_active, sort, block_ids, blocks_scope from payment_programs where id = $1", [
        id,
      ])
    ).rows[0];
  const sitePrograms = async () =>
    (
      await db.as(anon, (tx) =>
        tx.query<{ data: { rate: unknown; developers: { id: string; programs: Program[] }[] } }>(
          "select site_payment_programs() as data",
        ),
      )
    ).rows[0]!.data;

  describe("права и создание", () => {
    it("руководитель создаёт: новая выключена и встаёт в конец панели", async () => {
      const first = await save(head, full());
      const second = await save(head, scheme());
      expect(await programRow(first)).toMatchObject({ is_active: false });
      expect((await programRow(second))!.sort).toBeGreaterThan((await programRow(first))!.sort);
    });

    it("менеджер и видеограф не правят; посетитель не читает таблицу", async () => {
      await expectHint(save(manager, full()), "vh:forbidden");
      await expectHint(save(videographer, full()), "vh:forbidden");
      await expectDenied(db.as(anon, (tx) => tx.query("select * from payment_programs")));
    });

    it("читают руководитель и менеджер; видеограф не видит ни одной", async () => {
      const visible = async (actor: string) =>
        (await db.as(user(actor), (tx) => tx.query("select id from payment_programs"))).rows.length;
      expect(await visible(manager)).toBeGreaterThan(0);
      expect(await visible(videographer)).toBe(0);
    });
  });

  describe("проверка условий", () => {
    const invalid: [string, () => Program, string][] = [
      ["100 % с методом", () => full({ method: "markup" }), "method"],
      ["схема с банком", () => scheme({ bank_id: 1 }), "bank"],
      ["банк без валюты", () => bank({ currency: null }), "currency"],
      ["скидка 60 %", () => full({ discount_pct: 60 }), "discount_pct"],
      ["банк без мин. взноса", () => bank({ min_down_pct: null }), "min_down_pct"],
      ["мин. взнос у схемы", () => scheme({ min_down_pct: 30 }), "min_down_pct"],
      ["ступени не по возрастанию", () => scheme({ tiers: [...SCHEME_TIERS].reverse() }), "tiers"],
      [
        "лишний ключ ступени",
        () => scheme({ tiers: [{ ...SCHEME_TIERS[0], note: "x" }] }),
        "tiers",
      ],
      [
        "максимум срока меньше минимума",
        () => scheme({ tiers: [{ ...SCHEME_TIERS[0], min_months: 40 }] }),
        "tiers",
      ],
      [
        "взнос ступени 95 %",
        () => scheme({ tiers: [{ ...SCHEME_TIERS[0], min_down_pct: 95 }] }),
        "tiers",
      ],
      [
        "сроки не по возрастанию",
        () =>
          bank({
            terms: [
              { months: 24, rate_pct: 18 },
              { months: 12, rate_pct: 16 },
            ],
          }),
        "terms",
      ],
      ["дробный срок", () => bank({ terms: [{ months: 12.5, rate_pct: 16 }] }), "terms"],
      ["срок строкой", () => bank({ terms: [{ months: "12", rate_pct: 16 }] }), "terms"],
      [
        "разовое дважды",
        () =>
          bank({
            fees: [
              { name: "commission", kind: "pct", value: 1 },
              { name: "commission", kind: "fixed", value: 5 },
            ],
          }),
        "fees",
      ],
      [
        "комиссия 150 %",
        () => bank({ fees: [{ name: "commission", kind: "pct", value: 150 }] }),
        "fees",
      ],
      [
        "неизвестное разовое",
        () => bank({ fees: [{ name: "gift", kind: "fixed", value: 5 }] }),
        "fees",
      ],
      ["кнопка 18 мес.", () => scheme({ preset_months: [12, 18] }), "preset_months"],
      ["кнопки у банка", () => bank({ preset_months: [12] }), "preset_months"],
      ["свой срок у банка", () => bank({ allow_custom_months: true }), "preset_months"],
      [
        "«все блоки» со списком",
        () => scheme({ block_ids: ["00000000-0000-0000-0000-000000000000"] }),
        "blocks",
      ],
      ["неизвестный тип", () => ({ ...full(), type: "gift" }), "format"],
    ];

    it.each(invalid)("%s → поле в detail", async (_, program, field) => {
      await expectHint(save(head, program()), "vh:invalid_program", field);
    });

    it("блок другого застройщика или архивного ЖК — отказ; свой блок — можно", async () => {
      const { rows } = await db.admin.query<{ id: string }>(
        `insert into blocks (complex_id, name) values ($1, 'B') returning id`,
        [content.orphanComplex],
      );
      await expectHint(
        save(head, scheme({ blocks_scope: "selected", block_ids: [rows[0]!.id] })),
        "vh:invalid_program",
        "blocks",
      );
      const own = await save(
        head,
        scheme({ blocks_scope: "selected", block_ids: [content.publicBlock] }),
      );
      expect((await programRow(own))!.block_ids).toEqual([content.publicBlock]);
    });
  });

  describe("тумблер, удаление, копия, порядок", () => {
    it("последнюю включённую не выключить, включённую не удалить, выключенную — можно", async () => {
      const developer = content.draftDeveloper;
      const only = await save(head, full({ developer_id: developer }));
      await setActive(only, true);
      await expectHint(setActive(only, false), "vh:last_program");
      await expectHint(
        asHead((tx) => tx.query("select delete_payment_program($1)", [only])),
        "vh:program_active",
      );
      const second = await save(head, scheme({ developer_id: developer }));
      await setActive(second, true);
      await setActive(only, false);
      await asHead((tx) => tx.query("select delete_payment_program($1)", [only]));
      expect(await programRow(only)).toBeUndefined();
    });

    it("менеджер не переключает и не удаляет", async () => {
      const id = await save(head, full());
      await expectHint(
        db.as(user(manager), (tx) => tx.query("select set_payment_program_active($1, true)", [id])),
        "vh:forbidden",
      );
      await expectHint(
        db.as(user(manager), (tx) => tx.query("select delete_payment_program($1)", [id])),
        "vh:forbidden",
      );
    });

    it("копия к другому застройщику — выключена и на всех блоках", async () => {
      const source = await save(
        head,
        scheme({ blocks_scope: "selected", block_ids: [content.publicBlock] }),
      );
      const copy = await asHead(async (tx) => {
        const { rows } = await tx.query<{ id: string }>(
          "select copy_payment_program($1, $2) as id",
          [source, content.draftDeveloper],
        );
        return rows[0]!.id;
      });
      expect(await programRow(copy)).toMatchObject({
        is_active: false,
        blocks_scope: "all",
        block_ids: [],
      });
    });

    it("порядок стрелками и «Условия проверены сегодня»", async () => {
      const a = await save(head, full());
      const b = await save(head, full());
      await asHead((tx) =>
        tx.query("select reorder_payment_programs($1, $2::uuid[])", [
          content.publicDeveloper,
          [b, a],
        ]),
      );
      expect((await programRow(b))!.sort).toBeLessThan((await programRow(a))!.sort);
      await asHead((tx) => tx.query("select mark_programs_checked($1)", [content.publicDeveloper]));
      const { rows } = await db.admin.query<{ checked: boolean }>(
        "select programs_checked_at is not null as checked from developers where id = $1",
        [content.publicDeveloper],
      );
      expect(rows[0]!.checked).toBe(true);
    });
  });

  describe("сайт", () => {
    it("видит включённые программы опубликованных застройщиков — без полей скидки", async () => {
      const shown = await save(head, scheme());
      const fullId = await save(head, full());
      const hidden = await save(head, bank());
      await setActive(shown, true);
      await setActive(fullId, true);
      const draft = await save(head, full({ developer_id: content.draftDeveloper }));
      await setActive(draft, true);

      const data = await sitePrograms();
      const ids = data.developers.flatMap((developer) =>
        developer.programs.map((program) => program.id),
      );
      expect(ids).toEqual(expect.arrayContaining([shown, fullId]));
      expect(ids).not.toContain(hidden);
      expect(ids).not.toContain(draft);
      expect(JSON.stringify(data)).not.toMatch(/discount/);
      const tiers = data.developers[0]!.programs.find((program) => program.id === shown)!.tiers;
      expect(tiers).toEqual([
        { min_down_pct: 30, min_months: 1, max_months: 36 },
        { min_down_pct: 50, min_months: 1, max_months: 18 },
      ]);
    });

    it("программа на выбранных блоках видна, пока хоть один из них на сайте; удалённый блок уходит", async () => {
      const onDraft = await save(
        head,
        scheme({ blocks_scope: "selected", block_ids: [content.draftBlock] }),
      );
      await setActive(onDraft, true);
      const listed = async () =>
        (await sitePrograms()).developers.flatMap((developer) =>
          developer.programs.map((p) => p.id),
        );
      expect(await listed()).not.toContain(onDraft);

      const { rows } = await db.admin.query<{ id: string }>(
        `insert into blocks (complex_id, name) values ($1, 'C') returning id`,
        [content.publicComplex],
      );
      const blockC = rows[0]!.id;
      const onPublic = await save(head, scheme({ blocks_scope: "selected", block_ids: [blockC] }));
      await setActive(onPublic, true);
      expect(await listed()).toContain(onPublic);

      await db.admin.query("delete from blocks where id = $1", [blockC]);
      expect((await programRow(onPublic))!.block_ids).toEqual([]);
      expect(await listed()).not.toContain(onPublic);
    });
  });

  describe("курс USD/сум", () => {
    const rate = async () =>
      (
        await db.as(anon, (tx) =>
          tx.query<{ data: { rate: unknown } }>("select site_payment_programs() as data"),
        )
      ).rows[0]!.data.rate;
    const settingsEntries = async () =>
      Number(
        (
          await db.admin.query<{ n: number }>(
            "select count(*)::int as n from audit_log where entity = 'settings' and entity_id = 'exchange.usd_uzs'",
          )
        ).rows[0]!.n,
      );

    it("ЦБ — сервер и руководитель, без записи в журнал; менеджер — нет; вне пределов — отказ", async () => {
      await db.as(service, (tx) =>
        tx.query("select set_cbu_exchange_rate(11808.76, '2026-10-01')"),
      );
      expect(await rate()).toEqual({ usd_uzs: 11808.76, date: "2026-10-01", source: "cbu" });
      await asHead((tx) => tx.query("select set_cbu_exchange_rate(11900, '2026-10-02')"));
      expect(await settingsEntries()).toBe(0);
      await expectHint(
        db.as(user(manager), (tx) => tx.query("select set_cbu_exchange_rate(11900, '2026-10-02')")),
        "vh:forbidden",
      );
      await expectHint(
        asHead((tx) => tx.query("select set_cbu_exchange_rate(500, '2026-10-02')")),
        "vh:invalid_rate",
      );
      await expectHint(
        asHead((tx) => tx.query("select set_cbu_exchange_rate(11900, '2099-01-01')")),
        "vh:invalid_rate",
      );
    });

    it("ручной главнее ЦБ, правка — в журнал; «Вернуть курс ЦБ» — снова ЦБ", async () => {
      await asHead((tx) => tx.query("select set_manual_exchange_rate(12000)"));
      expect(await rate()).toMatchObject({ usd_uzs: 12000, source: "manual" });
      expect(await settingsEntries()).toBeGreaterThan(0);
      await asHead((tx) => tx.query("select set_manual_exchange_rate(null)"));
      expect(await rate()).toMatchObject({ usd_uzs: 11900, source: "cbu" });
      await expectHint(
        db.as(user(manager), (tx) => tx.query("select set_manual_exchange_rate(12000)")),
        "vh:forbidden",
      );
    });
  });

  describe("снимки расчётов", () => {
    const saveCalculation = (actor: string, programId: string) =>
      db.as(user(actor), async (tx) => {
        const { rows } = await tx.query<{ id: string }>(
          "select save_calculation($1, null, $2::jsonb, $3::jsonb) as id",
          [programId, JSON.stringify({ price: 84000 }), JSON.stringify({ payment: 2611 })],
        );
        return rows[0]!.id;
      });
    const visibleTo = async (actor: string) =>
      (
        await db.as(user(actor), (tx) => tx.query<{ id: string }>("select id from calculations"))
      ).rows.map((row) => row.id);

    it("менеджер видит свои, руководитель — все; условия и курс — из базы", async () => {
      const programId = await save(head, scheme());
      const mine = await saveCalculation(manager, programId);
      const theirs = await saveCalculation(otherManager, programId);
      expect(await visibleTo(manager)).toEqual([mine]);
      expect(await visibleTo(head)).toEqual(expect.arrayContaining([mine, theirs]));
      const { rows } = await db.admin.query<{ snapshot: Program; channel: string }>(
        "select program_snapshot as snapshot, channel from calculations where id = $1",
        [mine],
      );
      expect(rows[0]).toMatchObject({ channel: "cabinet", snapshot: { tiers: SCHEME_TIERS } });
    });

    it("посетитель и видеограф не сохраняют; чужая программа — «не найдена»", async () => {
      const programId = await save(head, full());
      await expectDenied(
        db.as(anon, (tx) => tx.query("select save_calculation($1, null, '{}', '{}')", [programId])),
      );
      await expectHint(saveCalculation(videographer, programId), "vh:forbidden");
      await expectHint(saveCalculation(manager, crypto.randomUUID()), "vh:not_found");
    });
  });

  it("правки программ — в журнале застройщика", async () => {
    await save(head, full());
    const { rows } = await asHead((tx) =>
      tx.query<{ entity: string }>("select entity from journal_entries($1)", [
        content.publicDeveloper,
      ]),
    );
    expect(rows.map((row) => row.entity)).toContain("payment_programs");
  });
});
