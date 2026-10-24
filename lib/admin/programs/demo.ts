import type { CabinetProgramRecord, CabinetTierRecord } from "@/lib/calc/cabinet/records";
import type { FeeRecord, TermRecord } from "@/lib/calc/records";
import { panelsFrom, type PanelRecord } from "./panels";
import type { BankOption, ProgramsScreenData, RateSetting } from "./types";

// DEMO для стендов /dev/programmy — как supabase/demo/seed.sql (мокап: PROGS) и тот же
// преобразователь, что у кабинета (panelsFrom). Совпадение с базой — tests/db/programs-demo.test.ts.

const BANKS: Record<"ipoteka" | "ipak", BankOption> = {
  ipoteka: { id: 901, name: { ru: "Ipoteka Bank", uz: "Ipoteka Bank" } },
  ipak: { id: 902, name: { ru: "Ipak Yuli Bank", uz: "Ipak Yuli Bank" } },
};

const developerId = (n: number) => `00000000-0000-4000-8000-0000000000d${n}`;
const blockId = (n: number) => `00000000-0000-4000-8000-0000000000b${n}`;
const programId = (n: number) =>
  `00000000-0000-4000-8000-0000000001${n.toString(16).padStart(2, "0")}`;
const complexId = (n: number) => `00000000-0000-4000-8000-0000000000c${n}`;

const UPDATED = "2026-10-01T09:00:00+00:00";

const tier = (min: number, discount: number, max: number): CabinetTierRecord => ({
  min_down_pct: min,
  discount_pct: discount,
  min_months: 1,
  max_months: max,
});
const term = (months: number, rate: number): TermRecord => ({ months, rate_pct: rate });
const fee = (name: FeeRecord["name"], kind: FeeRecord["kind"], value: number): FeeRecord => ({
  name,
  kind,
  value,
});

type ProgramSeed = Partial<CabinetProgramRecord> & Pick<CabinetProgramRecord, "type">;

function program(n: number, developer: number, sort: number, seed: ProgramSeed) {
  const bank = seed.bank_id === BANKS.ipoteka.id ? BANKS.ipoteka : seed.bank_id ? BANKS.ipak : null;
  const record: CabinetProgramRecord & { bank: unknown } = {
    id: programId(n),
    developer_id: developerId(developer),
    bank_id: null,
    bank: bank?.name ?? null,
    method: null,
    discount_pct: null,
    min_down_pct: null,
    tiers: [],
    terms: [],
    fees: [],
    preset_months: [],
    allow_custom_months: false,
    over_max_behavior: "block",
    currency: null,
    blocks_scope: "all",
    block_ids: [],
    conditions: null,
    is_active: true,
    sort,
    created_at: UPDATED,
    updated_at: UPDATED,
    ...seed,
  };
  return record;
}

const scheme = (tiers: CabinetTierRecord[]): ProgramSeed => ({
  type: "installment",
  method: "tiers",
  tiers,
  preset_months: [12, 24, 36, 48],
  allow_custom_months: true,
});
const bankProgram = (seed: ProgramSeed): ProgramSeed => ({ currency: "UZS", ...seed });

const block = (n: number, name: string, complex: number, complexName: string) => ({
  id: blockId(n),
  name,
  complex_id: complexId(complex),
  complex_name: { ru: complexName, uz: complexName },
  currency: "USD" as const,
});

const panel = (seed: Omit<PanelRecord, "status" | "programs_checked_at">): PanelRecord => ({
  status: "published",
  programs_checked_at: null,
  ...seed,
});

const PANEL_RECORDS: readonly PanelRecord[] = [
  panel({
    id: developerId(1),
    slug: "demo-sifat",
    name: "Farg‘ona Sifat Qurilish",
    complexes: 1,
    blocks: [block(1, "A", 1, "Shodlik"), block(2, "B", 1, "Shodlik")],
    price_hint: { per_m2: 685.981308411215, currency: "USD" },
    programs: [
      program(1, 1, 10, { type: "full", discount_pct: 12 }),
      program(2, 1, 20, scheme([tier(30, 0, 36), tier(50, 6, 18), tier(70, 9, 12)])),
      program(
        3,
        1,
        30,
        bankProgram({
          type: "bank_installment",
          method: "annuity",
          bank_id: BANKS.ipoteka.id,
          min_down_pct: 20,
          terms: [term(12, 16), term(24, 18)],
          fees: [fee("appraisal", "fixed", 1_500_000), fee("commission", "pct", 1)],
        }),
      ),
      program(
        4,
        1,
        40,
        bankProgram({
          type: "mortgage",
          method: "annuity",
          bank_id: BANKS.ipoteka.id,
          min_down_pct: 25,
          terms: [term(60, 17.5), term(120, 17.5), term(180, 17.5)],
          fees: [fee("appraisal", "fixed", 1_500_000), fee("insurance", "pct", 0.5)],
          blocks_scope: "selected",
          block_ids: [blockId(1)],
        }),
      ),
    ],
  }),
  panel({
    id: developerId(2),
    slug: "demo-margilan-invest",
    name: "Marg‘ilon Invest",
    complexes: 2,
    blocks: [block(3, "1", 2, "Namuna"), block(4, "1", 3, "Yulduz")],
    price_hint: { per_m2: 960.3053435114504, currency: "USD" },
    programs: [
      program(5, 2, 10, { type: "full", discount_pct: 10 }),
      program(6, 2, 20, scheme([tier(40, 0, 36), tier(60, 5, 24), tier(80, 8, 12)])),
      program(
        7,
        2,
        30,
        bankProgram({
          type: "bank_installment",
          method: "differentiated",
          bank_id: BANKS.ipak.id,
          min_down_pct: 25,
          terms: [term(12, 15), term(24, 16), term(36, 17)],
          fees: [fee("commission", "pct", 1)],
        }),
      ),
      program(
        8,
        2,
        40,
        bankProgram({
          type: "mortgage",
          method: "annuity",
          bank_id: BANKS.ipak.id,
          min_down_pct: 20,
          terms: [term(120, 18), term(180, 18), term(240, 18)],
          fees: [fee("appraisal", "fixed", 1_200_000)],
        }),
      ),
    ],
  }),
  panel({
    id: developerId(3),
    slug: "demo-kamalak",
    name: "Kamalak Development",
    complexes: 1,
    blocks: [block(5, "1", 4, "Orzu"), block(6, "2", 4, "Orzu")],
    price_hint: { per_m2: 744.6902654867257, currency: "USD" },
    programs: [
      program(9, 3, 10, { type: "full", discount_pct: 9 }),
      program(10, 3, 20, {
        ...scheme([tier(30, 0, 18), tier(50, 5, 12)]),
        blocks_scope: "selected",
        block_ids: [blockId(6)],
      }),
      program(
        11,
        3,
        30,
        bankProgram({
          type: "bank_installment",
          method: "annuity",
          bank_id: BANKS.ipak.id,
          min_down_pct: 30,
          terms: [term(24, 16)],
          fees: [fee("commission", "pct", 1)],
        }),
      ),
    ],
  }),
];

/** Курс мокапа на 01.10.2026 — как в сиде. */
export const DEMO_RATE: RateSetting = {
  cbu: { usdUzs: 11808.76, date: "2026-10-01" },
  manual: null,
};

export const DEMO_PANEL_RECORDS = PANEL_RECORDS;

export const DEMO_PROGRAMS_SCREEN: ProgramsScreenData = {
  panels: panelsFrom(PANEL_RECORDS),
  rate: DEMO_RATE,
  banks: [BANKS.ipoteka, BANKS.ipak],
};
