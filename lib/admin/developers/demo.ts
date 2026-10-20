import type { JournalRecord } from "../journal/format";
import type { DeveloperListRow } from "./list";
import type { PrivateNotes } from "./privateNotes";
import type { ProjectDraft } from "./projects";
import type { DeveloperRecord } from "./types";

// DEMO для служебных стендов /dev/zastroyshchiki и /dev/zhurnal: застройщики и сданные объекты —
// как supabase/demo/seed.sql (мокап), «N ЖК» — по DEMO-ЖК сида. Ещё три названия — из пилюль
// «Программ оплаты» мокапа, без цифр: показывают черновик, скрытого и архив. В базу не попадают.

export const DEMO_DEVELOPER_ID = "00000000-0000-4000-8000-0000000000d1";

// Настоящие uuid (сервер проверяет формат): застройщики — …d1–d6, сданные объекты — …e1–e2.
const id = (n: number) => `00000000-0000-4000-8000-0000000000d${n}`;
const projectId = (n: number) => `00000000-0000-4000-8000-0000000000e${n}`;

const row = (
  overrides: Partial<DeveloperListRow> & Pick<DeveloperListRow, "id" | "slug" | "name">,
): DeveloperListRow => ({
  status: "published",
  foundedYear: null,
  flatsDelivered: null,
  deliveredCheckedAt: null,
  archivedAt: null,
  complexes: 0,
  logoPath: null,
  ...overrides,
});

export const DEMO_DEVELOPER_ROWS: readonly DeveloperListRow[] = [
  row({
    id: id(1),
    slug: "demo-sifat",
    name: "Farg‘ona Sifat Qurilish",
    foundedYear: 2012,
    flatsDelivered: 2140,
    deliveredCheckedAt: "2026-09-14",
    complexes: 1,
  }),
  row({
    id: id(2),
    slug: "demo-margilan-invest",
    name: "Marg‘ilon Invest",
    foundedYear: 2016,
    flatsDelivered: 980,
    deliveredCheckedAt: "2026-09-11",
    complexes: 2,
  }),
  row({
    id: id(3),
    slug: "demo-kamalak",
    name: "Kamalak Development",
    foundedYear: 2018,
    flatsDelivered: 760,
    deliveredCheckedAt: "2026-09-09",
    complexes: 1,
  }),
  row({ id: id(4), slug: "demo-navroz", name: "Navro‘z Qurilish", status: "draft" }),
  row({ id: id(5), slug: "demo-barakat", name: "Barakat Development", status: "hidden" }),
  row({
    id: id(6),
    slug: "demo-yangi-makon",
    name: "Yangi Makon",
    status: "archived",
    archivedAt: "2026-10-12T08:30:00Z",
  }),
];

export const DEMO_DEVELOPER: DeveloperRecord = {
  id: DEMO_DEVELOPER_ID,
  slug: "demo-sifat",
  name: "Farg‘ona Sifat Qurilish",
  status: "published",
  foundedYear: 2012,
  flatsDelivered: 2140,
  deliveredCheckedAt: "2026-09-14",
  about: {
    ru: "Строит жильё в Фергане и Маргилане с 2012 года. Основатели — инженеры-строители, начинали с ремонта и реконструкции. Ключевые проекты — Mehr в Маргилане и Shodlik у центрального парка Ферганы. Работает с монолитным каркасом и сдаёт дома с черновой отделкой или white box.",
    uz: "2012 yildan beri Farg‘ona va Marg‘ilonda uy-joy quradi. Asoschilari — quruvchi muhandislar, faoliyatni ta’mirlash va rekonstruksiyadan boshlagan. Asosiy loyihalari — Marg‘ilondagi Mehr va Farg‘ona markaziy bog‘i yonidagi Shodlik. Monolit karkas bilan ishlaydi, uylarni qoralama pardoz yoki white box holatida topshiradi.",
  },
  founders: null,
  archivedAt: null,
};

/** Стенд показывает любого застройщика списка: у DEMO из сида — свои данные, у остальных — пусто. */
export function demoDeveloper(developerId: string): DeveloperRecord | null {
  if (developerId === DEMO_DEVELOPER_ID) return DEMO_DEVELOPER;
  const listed = DEMO_DEVELOPER_ROWS.find((item) => item.id === developerId);
  if (!listed) return null;
  return {
    ...DEMO_DEVELOPER,
    id: listed.id,
    slug: listed.slug,
    name: listed.name,
    status: listed.status,
    foundedYear: listed.foundedYear,
    flatsDelivered: listed.flatsDelivered,
    deliveredCheckedAt: listed.deliveredCheckedAt,
    archivedAt: listed.archivedAt,
    about: null,
  };
}

export const DEMO_PROJECTS: readonly ProjectDraft[] = [
  {
    key: projectId(1),
    id: projectId(1),
    name: { ru: "Дом на ул. Мустакиллик, 14", uz: "Mustaqillik ko‘chasi, 14-uy" },
    plannedOn: "2021-06-30",
    deliveredOn: "2021-06-30",
  },
  {
    key: projectId(2),
    id: projectId(2),
    name: { ru: "ЖК Sifat City", uz: "Sifat City" },
    plannedOn: "2022-12-31",
    deliveredOn: "2023-03-31",
  },
];

export const DEMO_PRIVATE: PrivateNotes = { contacts: "", notes: "" };

const entry = (n: number, at: string, overrides: Partial<JournalRecord>): JournalRecord => ({
  id: n,
  at,
  action: "update",
  entity: "developers",
  entity_id: DEMO_DEVELOPER_ID,
  changes: {},
  actor_name: "Бахтиёр Каримов",
  subject: "Farg‘ona Sifat Qurilish",
  ...overrides,
});

/** Журнал DEMO: правки руководителя мокапа (DEMO-сотрудник), от новых к старым. */
export const DEMO_JOURNAL: readonly JournalRecord[] = [
  entry(6, "2026-10-20T09:12:00Z", {
    changes: { delivered_checked_at: ["2026-06-02", "2026-09-14"] },
  }),
  entry(5, "2026-10-19T15:40:00Z", {
    entity: "developer_past_projects",
    action: "update",
    subject: "ЖК Sifat City",
    changes: { delivered_on: ["2022-12-31", "2023-03-31"] },
  }),
  entry(4, "2026-10-19T15:38:00Z", {
    entity: "developer_past_projects",
    action: "insert",
    subject: "ЖК Sifat City",
  }),
  entry(3, "2026-10-18T11:05:00Z", { changes: { status: ["draft", "published"] } }),
  entry(2, "2026-10-18T10:55:00Z", {
    entity: "media_assets",
    action: "insert",
    subject: "Farg‘ona Sifat Qurilish",
  }),
  entry(1, "2026-10-18T10:50:00Z", { action: "insert", actor_name: null }),
];
