import { DEMO_DEVELOPER_ROWS } from "../developers/demo";
import type { ComplexListRow } from "./list";
import { ROOM_GROUPS, type ComplexStock, type RoomGroup } from "./stock";
import type { DeveloperOption } from "./types";

// DEMO для служебного стенда /dev/zhk: ЖК мокапа и остатки по комнатам — как «Остатки по ЖК» на
// главной кабинета (supabase/demo/seed.sql: Shodlik 41, Namuna 65, Yulduz 43, Orzu 27). Ещё три —
// из того же списка мокапа, чтобы показать черновик, «не на сайте» и архив. В базу не попадают.

const id = (n: number) => `00000000-0000-4000-8000-0000000000c${n}`;
const developerId = (n: number) => `00000000-0000-4000-8000-0000000000d${n}`;

// Порядок — как у ROOM_GROUPS: у объекта ключи-числа («1») идут раньше «studio».
function stock(groups: Partial<Record<RoomGroup, number | null>>): ComplexStock {
  const items = ROOM_GROUPS.filter((group) => group in groups).map((group) => ({
    group,
    free: groups[group] ?? null,
    known: groups[group] ?? 0,
  }));
  return {
    groups: items,
    free: items.reduce((sum, item) => sum + (item.free ?? 0), 0),
    partial: items.some((item) => item.free === null),
  };
}

type DemoRow = Omit<ComplexListRow, "developerName" | "developerStatus" | "name"> & {
  name: string;
  developer: number;
};

const ROWS: readonly DemoRow[] = [
  {
    id: id(1),
    slug: "demo-shodlik",
    name: "Shodlik",
    status: "published",
    archivedAt: null,
    developerId: developerId(1),
    developer: 1,
    locationName: "Фергана",
    stock: stock({ "1": 14, "2": 22, "3": 5 }),
  },
  {
    id: id(2),
    slug: "demo-namuna",
    name: "Namuna",
    status: "published",
    archivedAt: null,
    developerId: developerId(2),
    developer: 2,
    locationName: "Фергана",
    stock: stock({ studio: 13, "1": 18, "2": 18, "3": 13, "4plus": 3 }),
  },
  {
    id: id(3),
    slug: "demo-yulduz",
    name: "Yulduz",
    status: "published",
    archivedAt: null,
    developerId: developerId(2),
    developer: 2,
    locationName: "Фергана",
    stock: stock({ "1": 15, "2": 15, "3": 12, "4plus": 1 }),
  },
  {
    id: id(4),
    slug: "demo-orzu",
    name: "Orzu",
    status: "published",
    archivedAt: null,
    developerId: developerId(3),
    developer: 3,
    locationName: "Фергана",
    stock: stock({ studio: 7, "1": 10, "2": 3, "3": 7 }),
  },
  {
    id: id(5),
    slug: "demo-gulzor",
    name: "Gulzor",
    status: "draft",
    archivedAt: null,
    developerId: developerId(4),
    developer: 4,
    locationName: "Коканд",
    stock: stock({ studio: null, "2": 5, "3": 7 }),
  },
  {
    id: id(6),
    slug: "demo-bahor",
    name: "Bahor",
    status: "published",
    archivedAt: null,
    developerId: developerId(4),
    developer: 4,
    locationName: "Маргилан",
    stock: stock({ "1": 2, "2": 1, "3": 3 }),
  },
  {
    id: id(7),
    slug: "demo-lola",
    name: "Lola",
    status: "archived",
    archivedAt: "2026-10-14T09:00:00Z",
    developerId: developerId(3),
    developer: 3,
    locationName: "Кувасай",
    stock: stock({}),
  },
];

function developerOf(n: number) {
  return DEMO_DEVELOPER_ROWS.find((row) => row.id === developerId(n))!;
}

export const DEMO_COMPLEX_ROWS: readonly ComplexListRow[] = ROWS.map(
  ({ developer, name, ...row }) => ({
    ...row,
    name: { ru: name, uz: name },
    developerName: developerOf(developer).name,
    developerStatus: developerOf(developer).status,
  }),
);

export const DEMO_DEVELOPER_OPTIONS: readonly DeveloperOption[] = DEMO_DEVELOPER_ROWS.filter(
  (row) => row.status !== "archived",
).map((row) => ({ id: row.id, name: row.name }));
