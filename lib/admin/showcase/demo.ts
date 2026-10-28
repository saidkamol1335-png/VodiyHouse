import { DEMO_COMPLEX_ROWS } from "../complexes/demo";
import { DEMO_DEVELOPER_ROWS } from "../developers/demo";
import { todayInTashkent } from "./period";
import type {
  AdRecord,
  CollectionRecord,
  ShowcaseListRow,
  ShowcaseOptions,
  SpecialRecord,
} from "./types";

// DEMO «Витрины» для служебного стенда /dev/vitrina — как supabase/demo/seed.sql: четыре
// спецпредложения (одно ждёт своего дня), две рекламы с пересечением периодов (Г1 A), пять
// подборок мокапа. Периоды — от сегодняшнего дня, поэтому записи считаются на вызове, а не при
// загрузке модуля (Next не пускает new Date() в пререндер). В базу не попадают.

const specialId = (n: number) => `00000000-0000-4000-8000-00000000f0a${n}`;
const adId = (n: number) => `00000000-0000-4000-8000-00000000f0b${n}`;
const collectionId = (n: number) => `00000000-0000-4000-8000-00000000f0c${n}`;
const developer = (n: number) => DEMO_DEVELOPER_ROWS[n - 1]!;
const complex = (slug: string) => DEMO_COMPLEX_ROWS.find((row) => row.slug === slug)!.id;

const DAY_MS = 24 * 60 * 60 * 1000;
const day = (offset: number) => todayInTashkent(new Date(Date.now() + offset * DAY_MS));

type SpecialSeed = Pick<SpecialRecord, "kind" | "badge" | "title" | "text"> & {
  developer: number;
  complexes: string[];
  period: [fromDays: number, toDays: number];
};

const special = (n: number, seed: SpecialSeed): SpecialRecord => ({
  id: specialId(n),
  developerId: developer(seed.developer).id,
  kind: seed.kind,
  badge: seed.badge,
  title: seed.title,
  text: seed.text,
  complexIds: seed.complexes.map(complex),
  validFrom: day(seed.period[0]),
  validTo: day(seed.period[1]),
  isActive: true,
  sort: n * 10,
});

// Сами данные — без дат: даты считаются в special() на вызове demoSpecials().
const SPECIAL_SEEDS: readonly SpecialSeed[] = [
  {
    developer: 1,
    kind: "gift",
    badge: { ru: "Подарок", uz: "Sovg‘a" },
    title: { ru: "Кухонный гарнитур в подарок", uz: "Oshxona mebeli sovg‘a" },
    text: {
      ru: "При покупке квартиры в блоке B до конца месяца — кухонный гарнитур от застройщика.",
      uz: "Oy oxirigacha B blokdan kvartira xarid qilganda — quruvchidan oshxona mebeli.",
    },
    complexes: ["demo-shodlik"],
    period: [-10, 20],
  },
  {
    developer: 2,
    kind: "installment",
    badge: { ru: "Рассрочка 24 мес.", uz: "24 oy muddatli" },
    title: {
      ru: "Рассрочка на 24 месяца без наценки",
      uz: "24 oyga ustama narxsiz muddatli to‘lov",
    },
    text: {
      ru: "Первый взнос от 30%, остаток — равными частями до сдачи дома.",
      uz: "Boshlang‘ich to‘lov 30% dan, qolgani — uy topshirilgunga qadar teng ulushlarda.",
    },
    complexes: ["demo-namuna", "demo-yulduz"],
    period: [-3, 45],
  },
  {
    developer: 3,
    kind: "bank",
    badge: { ru: "Через банк", uz: "Bank orqali" },
    title: {
      ru: "Первый взнос от 20% через банк-партнёр",
      uz: "Hamkor bank orqali 20% dan boshlang‘ich to‘lov",
    },
    text: null,
    complexes: ["demo-orzu"],
    period: [-1, 30],
  },
  {
    developer: 2,
    kind: "sales_start",
    badge: { ru: "Старт продаж", uz: "Savdo boshlanishi" },
    title: {
      ru: "Старт продаж второй очереди Yulduz",
      uz: "Yulduz ikkinchi navbati savdosi boshlanadi",
    },
    text: null,
    complexes: ["demo-yulduz"],
    period: [5, 40],
  },
];

export function demoSpecials(): SpecialRecord[] {
  return SPECIAL_SEEDS.map((seed, index) => special(index + 1, seed));
}

export function demoAds(): AdRecord[] {
  return [
    {
      id: adId(1),
      developerId: developer(1).id,
      title: {
        ru: "Готовые 2-комнатные квартиры в рассрочку",
        uz: "Tayyor 2 xonali kvartiralar muddatli to‘lovga",
      },
      text: {
        ru: "Сданные дома — можно въезжать сразу.",
        uz: "Topshirilgan uylar — darhol ko‘chib o‘tish mumkin.",
      },
      complexIds: [],
      filter: { komnat: "2", srok: "built" },
      validFrom: day(-5),
      validTo: day(25),
      isActive: true,
      sort: 10,
    },
    {
      id: adId(2),
      developerId: developer(3).id,
      title: {
        ru: "Orzu: квартиры с отделкой white box",
        uz: "Orzu: white box pardozli kvartiralar",
      },
      text: {
        ru: "Сдан первый блок, второй — в 2027 году.",
        uz: "Birinchi blok topshirildi, ikkinchisi — 2027 yilda.",
      },
      complexIds: [complex("demo-orzu")],
      filter: {},
      validFrom: day(10),
      validTo: day(40),
      isActive: true,
      sort: 20,
    },
  ];
}

const collection = (
  n: number,
  slug: string,
  title: CollectionRecord["title"],
  rest: Partial<CollectionRecord>,
): CollectionRecord => ({
  id: collectionId(n),
  slug,
  title,
  mode: "filter",
  complexIds: [],
  filter: {},
  isActive: true,
  sort: n * 10,
  ...rest,
});

export const DEMO_COLLECTIONS: readonly CollectionRecord[] = [
  collection(
    1,
    "demo-sdannye-doma",
    { ru: "Сданные дома", uz: "Topshirilgan uylar" },
    { filter: { srok: "built" } },
  ),
  collection(
    2,
    "demo-rassrochka-cherez-bank",
    { ru: "Рассрочка через банк", uz: "Bank orqali muddatli to‘lov" },
    { filter: { oplata: "bank" } },
  ),
  collection(
    3,
    "demo-do-45000",
    { ru: "До $45 000", uz: "$45 000 gacha" },
    { filter: { do: "45000" } },
  ),
  collection(
    4,
    "demo-tsentr-fergany",
    { ru: "Центр Ферганы", uz: "Farg‘ona markazi" },
    { mode: "manual", complexIds: [complex("demo-namuna"), complex("demo-yulduz")] },
  ),
  collection(
    5,
    "demo-studii-i-1-komnatnye",
    { ru: "Студии и 1-комнатные", uz: "Studiya va 1 xonali" },
    { filter: { komnat: "0,1" } },
  ),
];

export const DEMO_SHOWCASE_OPTIONS: ShowcaseOptions = {
  developers: DEMO_DEVELOPER_ROWS.filter((row) => row.status !== "archived").map((row) => ({
    id: row.id,
    name: row.name,
  })),
  complexes: DEMO_COMPLEX_ROWS.map((row) => ({
    id: row.id,
    name: row.name.ru,
    developerId: row.developerId,
    status: row.status,
  })),
  locations: [
    { slug: "fergana", name: "Фергана", kind: "city" },
    { slug: "margilan", name: "Маргилан", kind: "city" },
    { slug: "kuvasay", name: "Кувасай", kind: "city" },
    { slug: "fergana-district", name: "Ферганский район", kind: "district" },
  ],
};

const developerName = (id: string) =>
  DEMO_DEVELOPER_ROWS.find((row) => row.id === id)?.name ?? null;

const createdAt = (n: number) => `2026-10-${String(10 + n).padStart(2, "0")}T09:00:00Z`;

type RowSource = (SpecialRecord | AdRecord | CollectionRecord) & { developerId?: string };

/** Строка списка из DEMO-записи: подборка — без застройщика и периода, «по фильтру» — без ЖК. */
function listRow(kind: ShowcaseListRow["kind"], item: RowSource, index: number): ShowcaseListRow {
  return {
    id: item.id,
    kind,
    title: item.title.ru,
    developerName: item.developerId ? developerName(item.developerId) : null,
    complexCount: item.complexIds.length,
    byFilter: kind !== "special" && item.complexIds.length === 0,
    validFrom: "validFrom" in item ? item.validFrom : null,
    validTo: "validTo" in item ? item.validTo : null,
    isActive: item.isActive,
    sort: item.sort,
    createdAt: createdAt(index),
    coverPath: null,
  };
}

export const demoSpecialRows = () =>
  demoSpecials().map((item, index) => listRow("special", item, index));
export const demoAdRows = () => demoAds().map((item, index) => listRow("ad", item, index));
export const demoCollectionRows = () =>
  DEMO_COLLECTIONS.map((item, index) => listRow("collection", item, index));

export const demoSpecial = (id: string) => demoSpecials().find((item) => item.id === id) ?? null;
export const demoAd = (id: string) => demoAds().find((item) => item.id === id) ?? null;
export const demoCollection = (id: string) =>
  DEMO_COLLECTIONS.find((item) => item.id === id) ?? null;
/** Первая DEMO-запись своего вида — куда ведёт «Создать» на стенде. */
export const DEMO_FIRST_IDS = {
  special: specialId(1),
  ad: adId(1),
  collection: collectionId(1),
} as const;
