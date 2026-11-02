import { SEED_DICTIONARIES } from "../dictionaries/seed";
import type { DeadlineChange } from "./deadlines";
import { DEMO_COMPLEX_ROWS } from "./demo";
import { detailRows, type DetailRow } from "./details";
import { documentRows, type DocumentRow } from "./documents";
import type { VideoDraft } from "./videos";

// «Видео», «Детали», «Документы» DEMO для стенда /dev/zhk/<id>/… — как supabase/demo/seed.sql:
// документы проверены (у сданных — и акт ввода), детали — у Namuna, видео нет (настоящих ссылок
// на ролики нет — TODO-заказчик).

const slugOf = (id: string) => DEMO_COMPLEX_ROWS.find((row) => row.id === id)?.slug ?? null;
const typeId = (slug: string) => SEED_DICTIONARIES.document_types.find((item) => item.slug === slug)!.id;
const topicId = (slug: string) => SEED_DICTIONARIES.detail_topics.find((item) => item.slug === slug)!.id;

const CHECKED: Record<string, { on: string; commissioning: boolean }> = {
  "demo-shodlik": { on: "2026-09-12", commissioning: true },
  "demo-namuna": { on: "2026-09-11", commissioning: false },
  "demo-yulduz": { on: "2026-09-11", commissioning: false },
  "demo-orzu": { on: "2026-09-09", commissioning: true },
};

export function demoDocuments(id: string): DocumentRow[] {
  const checked = CHECKED[slugOf(id) ?? ""];
  const slugs = ["land", "permit", "declaration", "expertise", "seismic", ...(checked?.commissioning ? ["commissioning"] : [])];
  const records = checked ? slugs.map((slug) => ({ document_type_id: typeId(slug), checked_on: checked.on })) : [];
  return documentRows(SEED_DICTIONARIES.document_types, records);
}

export function demoDetails(id: string): DetailRow[] {
  const records =
    slugOf(id) === "demo-namuna"
      ? [
          { topic_id: topicId("about"), text: { ru: "DEMO: башня бизнес-класса в центре Ферганы.", uz: "DEMO: Farg‘ona markazidagi biznes sinf minorasi." }, photo_id: null },
          { topic_id: topicId("landscaping"), text: { ru: "DEMO: закрытый двор без машин.", uz: "DEMO: mashinasiz yopiq hovli." }, photo_id: null },
        ]
      : [];
  return detailRows(SEED_DICTIONARIES.detail_topics, records);
}

export function demoVideos(): VideoDraft[] {
  return [];
}

/** Перенос срока Shodlik B, как в сиде: 2 кв. 2027 → 4 кв. 2027, записан 20.08.2026. */
export function demoDeadlineChanges(id: string): DeadlineChange[] {
  if (slugOf(id) !== "demo-shodlik") return [];
  return [
    {
      id: "00000000-0000-4000-8000-0000000000d1",
      blockId: "00000000-0000-4000-8000-0000000000b2",
      from: { year: 2027, quarter: 2 },
      to: { year: 2027, quarter: 4 },
      changedOn: "2026-08-20",
    },
  ];
}
