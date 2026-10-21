import { SEED_DICTIONARIES } from "../dictionaries/seed";
import { DEMO_COMPLEX_ROWS } from "./demo";
import { blockDraftsFrom, type BlockDraft, type BlockRecord } from "./blocks";

// Блоки DEMO для стенда /dev/zhk/<id>/bloki — как supabase/demo/seed.sql (мокап: «Блоки и
// условия покупки»): Shodlik A сдан, B строится 58 %; квартиры — по генератору сида.

const finishing = (slug: string) =>
  SEED_DICTIONARIES.finishings.find((item) => item.slug === slug)?.id ?? null;

const blockId = (n: number) => `00000000-0000-4000-8000-0000000000b${n}`;

type DemoBlock = Omit<BlockRecord, "finishing_id" | "price_includes" | "cadastre_expected_on"> & {
  complexSlug: string;
  finishing: string;
};

const BLOCKS: readonly DemoBlock[] = [
  {
    complexSlug: "demo-shodlik",
    id: blockId(1),
    name: "A",
    build_status: "delivered",
    progress_pct: 100,
    floors_total: 12,
    floors_built: 12,
    deadline_year: 2025,
    deadline_quarter: 3,
    finishing: "rough",
    cadastre: "done",
    currency: "USD",
    units: 88,
    priced_layouts: 0,
  },
  {
    complexSlug: "demo-shodlik",
    id: blockId(2),
    name: "B",
    build_status: "building",
    progress_pct: 58,
    floors_total: 12,
    floors_built: 7,
    deadline_year: 2027,
    deadline_quarter: 4,
    finishing: "white-box",
    cadastre: "after_delivery",
    currency: "USD",
    units: 88,
    priced_layouts: 0,
  },
  {
    complexSlug: "demo-namuna",
    id: blockId(3),
    name: "1",
    build_status: "building",
    progress_pct: 40,
    floors_total: 16,
    floors_built: 6,
    deadline_year: 2028,
    deadline_quarter: 2,
    finishing: "white-box",
    cadastre: "after_delivery",
    currency: "USD",
    units: 0,
    priced_layouts: 2,
  },
];

export const DEMO_FINISHING_OPTIONS = SEED_DICTIONARIES.finishings.map((item) => ({
  value: String(item.id),
  label: item.name.ru,
}));

export function demoBlocks(complexId: string): BlockDraft[] {
  const slug = DEMO_COMPLEX_ROWS.find((row) => row.id === complexId)?.slug;
  return blockDraftsFrom(
    BLOCKS.filter((block) => block.complexSlug === slug).map(
      ({ finishing: key, ...block }) => ({
        ...block,
        finishing_id: finishing(key),
        price_includes: [],
        cadastre_expected_on: null,
      }),
    ),
  );
}
