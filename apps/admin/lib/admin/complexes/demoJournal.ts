import { SEED_DICTIONARIES } from "../dictionaries/seed";
import type { JournalRecord } from "../journal/format";

// Журнал DEMO для стенда /dev/zhk/<id>/zhurnal: правки руководителя и менеджера мокапа по
// Shodlik — те же подписи и та же форма записей, что дают journal_entries() и сводки квартир
// (private.write_units_summary): «Блок B», «Блок A · 1-комн. · 42,5 м²», «Блок A · кв. 41».

const BLOCK_A = "00000000-0000-4000-8000-0000000000b1";
const WHITE_BOX =
  SEED_DICTIONARIES.finishings.find((item) => item.slug === "white-box")?.id ?? null;

const entry = (n: number, at: string, overrides: Partial<JournalRecord>): JournalRecord => ({
  id: n,
  at,
  action: "update",
  entity: "complexes",
  entity_id: "00000000-0000-4000-8000-0000000000c1",
  changes: {},
  actor_name: "Бахтиёр Каримов",
  subject: "Shodlik",
  ...overrides,
});

/** Сводка о квартирах блока A: контекст записи — блок и его валюта. */
const units = (n: number, at: string, overrides: Partial<JournalRecord>, changes: object) =>
  entry(n, at, {
    entity: "units",
    entity_id: BLOCK_A,
    subject: "Блок A",
    ...overrides,
    changes: { block_id: BLOCK_A, block_name: "A", currency: "USD", ...changes },
  });

/** Номера прежнего списка, что были проданы: все, кроме свободных и броней. */
const SOLD_BEFORE = Array.from({ length: 88 }, (_, index) => String(index + 1))
  .filter(
    (number) =>
      !["3", "8", "12", "17", "21", "30", "41", "45", "46", "52", "60", "77"].includes(number),
  )
  .join(", ");

const MANAGER = { actor_name: "Дилноза Юсупова" };

export const DEMO_COMPLEX_JOURNAL: readonly JournalRecord[] = [
  units(
    13,
    "2026-10-21T09:41:00Z",
    { ...MANAGER, subject: "Блок A · кв. 41" },
    {
      status: ["free", "reserved"],
      summary: {
        kind: "status",
        count: 1,
        numbers: "41",
        groups: [{ from: "free", to: "reserved", count: 1, numbers: "41" }],
      },
    },
  ),
  units(12, "2026-10-21T09:36:00Z", MANAGER, {
    status: ["sold", "free"],
    summary: {
      kind: "status",
      undo: true,
      count: 2,
      numbers: "45, 46",
      groups: [{ from: "sold", to: "free", count: 2, numbers: "45, 46" }],
      skipped: 1,
      missing: 0,
    },
  }),
  units(11, "2026-10-21T09:35:00Z", MANAGER, {
    status: [null, "sold"],
    summary: {
      kind: "status",
      count: 3,
      numbers: "45–47",
      groups: [
        { from: "free", to: "sold", count: 2, numbers: "45, 46" },
        { from: "reserved", to: "sold", count: 1, numbers: "47" },
      ],
    },
  }),
  units(
    10,
    "2026-10-21T09:20:00Z",
    {},
    {
      price_per_m2: [null, 700],
      summary: {
        kind: "price",
        mode: "per_m2",
        value: 700,
        count: 22,
        numbers: "1–22",
        without_layout: 0,
      },
    },
  ),
  units(
    9,
    "2026-10-21T09:18:00Z",
    {},
    {
      finishing_id: [null, WHITE_BOX],
      summary: { kind: "finishing", count: 4, numbers: "85–88" },
    },
  ),
  // Стояки на разные планировки — без пары «было → стало», подробности только в сводке.
  units(
    8,
    "2026-10-21T09:12:00Z",
    {},
    {
      summary: {
        kind: "layouts",
        count: 2,
        numbers: "84, 88",
        assigned: [
          {
            layout_id: "00000000-0000-4000-8000-0000000000d4",
            label: "3-комн. · 78 м²",
            count: 1,
            numbers: "84",
          },
          { layout_id: null, label: null, count: 1, numbers: "88" },
        ],
      },
    },
  ),
  units(
    7,
    "2026-10-21T09:05:00Z",
    { action: "insert" },
    {
      summary: { kind: "create", count: 88, numbers: "1–88", unassigned: 0 },
    },
  ),
  units(
    6,
    "2026-10-21T09:02:00Z",
    { action: "delete" },
    {
      summary: {
        kind: "delete_list",
        count: 88,
        numbers: "1–88",
        statuses: { free: 10, reserved: 2, sold: 76 },
        reserved_numbers: "30, 77",
        sold_numbers: SOLD_BEFORE,
      },
    },
  ),
  entry(5, "2026-10-20T10:20:00Z", {
    entity: "blocks",
    subject: "Блок B",
    changes: { progress_pct: [52, 58], floors_built: [6, 7] },
  }),
  entry(4, "2026-10-20T10:18:00Z", {
    entity: "layouts",
    subject: "Блок A · 1-комн. · 42,5 м²",
    changes: { available: [false, true] },
  }),
  entry(3, "2026-10-19T16:02:00Z", {
    changes: {
      landmark: [
        { ru: "у парка", uz: "bog‘ yonida" },
        { ru: "напротив центрального парка", uz: "markaziy bog‘ ro‘parasida" },
      ],
    },
  }),
  entry(2, "2026-10-19T15:55:00Z", { entity: "media_assets", action: "insert" }),
  entry(1, "2026-10-19T15:40:00Z", { changes: { status: ["draft", "published"] } }),
];
