import { DEMO_COMPLEX_ROWS } from "../complexes/demo";
import { isOnSite } from "../complexes/list";
import {
  siteStockFrom,
  type BlockAvailabilityRecord,
  type RoomOfferRecord,
  type SiteStock,
  type SiteStockResult,
} from "./siteStock";

// DEMO для стенда /dev/glavnaya — записи той же формы, что отдают room_availability и
// block_availability, и тот же разбор (siteStockFrom), что у /admin. Цифры — как
// supabase/demo/seed.sql (прогон в PGlite): Shodlik 41 (Бл. A 12 · Бл. B 29), Namuna 65, Yulduz 43,
// Orzu 27; «цена от» — минимум по свободным квартирам сида. Gulzor, Bahor и Lola не на сайте (Г2 A).
// В базу не попадают.
//
// Сценарии (?demo=…), которых в сиде нет: change — следующее чтение видит, что квартиры сменили
// статус (вспышка пилюли); fail — перечитывание не удаётся (база); session — сессия кончилась
// (перечитывание на паузе, «Войти»); empty — на сайте нет ЖК; variety —
// блок без списка в сумах («2к 18+», «свободно 65+»), «цена по запросу», мало свободных (янтарь),
// свободные без планировки (у Shodlik — в дополнение к типам, у Yulduz — только они); layouts —
// у всех ЖК блоки без списка квартир (итог — словами, а не «0+»); unassigned — свободные есть, но
// ни одной не назначена планировка (итог — их число с пояснением, а не «0»); unpublished — при
// следующем чтении Orzu сняли с сайта (строка уходит, фокус в ней — на заголовок панели).

export const SITE_STOCK_SCENARIOS = [
  "change",
  "fail",
  "session",
  "empty",
  "variety",
  "layouts",
  "unassigned",
  "unpublished",
] as const;
export type SiteStockScenario = (typeof SITE_STOCK_SCENARIOS)[number] | null;

export function siteStockScenario(value: unknown): SiteStockScenario {
  return (SITE_STOCK_SCENARIOS as readonly unknown[]).includes(value)
    ? (value as SiteStockScenario)
    : null;
}

/** rooms, свободно (null — по планировкам), площадь от, цена от (null — по запросу), валюта. */
type Room = [rooms: number, free: number | null, area: number, price: number | null, uzs?: true];
/** Блок: название, свободно (null — нет списка квартир), из них без планировки. */
type Block = [name: string, free: number | null, unassigned?: number];
type Demo = Record<string, { rooms: Room[]; blocks: Block[] }>;

const SEED: Demo = {
  "demo-shodlik": {
    rooms: [
      [1, 14, 42.5, 30290],
      [2, 22, 58.7, 40270],
      [3, 5, 78, 54930],
    ],
    blocks: [
      ["A", 12],
      ["B", 29],
    ],
  },
  "demo-namuna": {
    rooms: [
      [0, 13, 34.2, 33720],
      [1, 18, 48.6, 46680],
      [2, 18, 71.3, 70290],
      [3, 13, 98.5, 97110],
      [4, 3, 132, 139450],
    ],
    blocks: [["1", 65]],
  },
  "demo-yulduz": {
    rooms: [
      [1, 15, 56, 68600],
      [2, 15, 82.4, 103620],
      [3, 12, 118.6, 145290],
      [4, 1, 156, 213720],
    ],
    blocks: [["1", 43]],
  },
  "demo-orzu": {
    rooms: [
      [0, 7, 30.5, 23460],
      [1, 10, 44.6, 33220],
      [2, 3, 63.2, 47070],
      [3, 7, 88, 66590],
    ],
    blocks: [
      ["1", 5],
      ["2", 22],
    ],
  },
};

/** Через минуту: в Shodlik бронь 2-комн. в блоке B, в Orzu освободилась студия в блоке 2. */
const CHANGED: Demo = {
  ...SEED,
  "demo-shodlik": {
    rooms: [
      [1, 14, 42.5, 30290],
      [2, 21, 58.7, 40270],
      [3, 5, 78, 54930],
    ],
    blocks: [
      ["A", 12],
      ["B", 28],
    ],
  },
  "demo-orzu": {
    rooms: [
      [0, 8, 30.5, 23460],
      [1, 10, 44.6, 33220],
      [2, 3, 63.2, 47070],
      [3, 7, 88, 66590],
    ],
    blocks: [
      ["1", 5],
      ["2", 23],
    ],
  },
};

const VARIETY: Demo = {
  "demo-shodlik": {
    ...SEED["demo-shodlik"]!,
    blocks: [
      ["A", 14, 2],
      ["B", 29],
    ],
  },
  "demo-namuna": {
    rooms: [...SEED["demo-namuna"]!.rooms, [2, null, 68, 640_000_000, true]],
    blocks: [
      ["1", 65],
      ["2", null],
    ],
  },
  "demo-yulduz": { rooms: [], blocks: [["1", 12, 12]] },
  "demo-orzu": {
    rooms: [
      [0, 2, 30.5, 23460],
      [1, 3, 44.6, 33220],
      [2, 1, 63.2, 47070],
      [3, 2, 88, null],
    ],
    blocks: [
      ["1", 3],
      ["2", 5],
    ],
  },
};

/** Как сид, только списков квартир нет: наличие — по флагу «доступна» планировок. */
const LAYOUTS: Demo = Object.fromEntries(
  Object.entries(SEED).map(([slug, { rooms, blocks }]) => [
    slug,
    {
      rooms: rooms.map(([count, , area, price]): Room => [count, null, area, price]),
      blocks: blocks.map(([name]): Block => [name, null]),
    },
  ]),
);

/** Как сид, только стояки не назначены: все свободные — без планировки. */
const UNASSIGNED: Demo = Object.fromEntries(
  Object.entries(SEED).map(([slug, { blocks }]) => [
    slug,
    { rooms: [], blocks: blocks.map(([name, free]): Block => [name, free, free ?? 0]) },
  ]),
);

const ON_SITE = DEMO_COMPLEX_ROWS.filter(isOnSite);

function roomRecord(complexId: string, [rooms, free, area, price, uzs]: Room): RoomOfferRecord {
  return {
    complex_id: complexId,
    rooms,
    currency: uzs ? "UZS" : "USD",
    free_count: free,
    listed_free: free ?? 0,
    available: free === null || free > 0,
    area_from: area,
    price_from: price,
  };
}

function blockRecord(complexId: string, [name, free, unassigned]: Block): BlockAvailabilityRecord {
  return {
    complex_id: complexId,
    // Блок на главной — только ключ строки; по нему никуда не переходят.
    block_id: `${complexId}:${name}`,
    name,
    free_count: free,
    free_unassigned: unassigned ?? 0,
    available: free === null || free > 0,
  };
}

function stockOf(demo: Demo): SiteStock {
  const rows = ON_SITE.map((row) => ({ row, data: demo[row.slug] ?? { rooms: [], blocks: [] } }));
  return siteStockFrom(
    ON_SITE,
    rows.flatMap(({ row, data }) => data.rooms.map((room) => roomRecord(row.id, room))),
    rows.flatMap(({ row, data }) => data.blocks.map((block) => blockRecord(row.id, block))),
  );
}

/** Что страница стенда показывает сразу. */
export function demoSiteStock(scenario: SiteStockScenario): SiteStock {
  if (scenario === "empty") return { complexes: [] };
  if (scenario === "variety") return stockOf(VARIETY);
  if (scenario === "unassigned") return stockOf(UNASSIGNED);
  return stockOf(scenario === "layouts" ? LAYOUTS : SEED);
}

/** Что отдаёт перечитывание — ответ действия, как у настоящего. */
export function demoSiteStockRead(scenario: SiteStockScenario): SiteStockResult {
  if (scenario === "fail") return { status: "error", error: "unavailable" };
  if (scenario === "session") return { status: "error", error: "session" };
  const stock = scenario === "change" ? stockOf(CHANGED) : demoSiteStock(scenario);
  if (scenario === "unpublished") {
    return {
      status: "done",
      stock: { complexes: stock.complexes.filter((item) => item.name !== "Orzu") },
    };
  }
  return { status: "done", stock };
}
