import type { JournalRecord } from "../journal/format";

// Журнал DEMO для стенда /dev/zhk/<id>/zhurnal: правки руководителя мокапа по Shodlik — те же
// подписи, что даёт journal_entries() («Блок B», «Блок A · 1-комн. · 42,5 м²»).

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

export const DEMO_COMPLEX_JOURNAL: readonly JournalRecord[] = [
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
