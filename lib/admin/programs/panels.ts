import { cabinetProgramFromRecord, type CabinetProgramRecord } from "@/lib/calc/cabinet/records";
import type { Currency } from "@/lib/calc/money";
import { bilingualFrom } from "../bilingual";
import type { PublicationStatus } from "../publication";
import type {
  BankOption,
  PriceHint,
  ProgramItem,
  ProgramKind,
  ProgramPanel,
  RatePart,
  RateSetting,
} from "./types";

// Ответ payment_program_panels() (20261024100000_payment_programs.sql) → панели экрана.

type BlockRecord = {
  id: string;
  name: string;
  complex_id: string;
  complex_name: unknown;
  currency: Currency;
};

export type PanelRecord = {
  id: string;
  slug: string;
  name: string;
  status: PublicationStatus;
  programs_checked_at: string | null;
  complexes: number;
  blocks: BlockRecord[];
  programs: (CabinetProgramRecord & { bank: unknown })[];
  price_hint: { per_m2: number; currency: Currency } | null;
};

export function kindOf(record: Pick<CabinetProgramRecord, "type" | "method">): ProgramKind {
  if (record.type === "full") return "full";
  if (record.type === "installment") return record.method === "markup" ? "markup" : "scheme";
  return record.type === "mortgage" ? "mortgage" : "bank";
}

export function programItemFrom(record: CabinetProgramRecord & { bank: unknown }): ProgramItem {
  return {
    id: record.id,
    developerId: record.developer_id,
    kind: kindOf(record),
    bankName: record.bank ? bilingualFrom(record.bank) : null,
    isActive: record.is_active,
    record,
    program: cabinetProgramFromRecord(record),
  };
}

function priceHintFrom(record: PanelRecord["price_hint"]): PriceHint | null {
  if (!record || !(Number(record.per_m2) > 0)) return null;
  return { perM2: Number(record.per_m2), currency: record.currency };
}

export function panelsFrom(records: readonly PanelRecord[]): ProgramPanel[] {
  return records.map((record) => ({
    id: record.id,
    slug: record.slug,
    name: record.name,
    status: record.status,
    checkedAt: record.programs_checked_at,
    complexes: Number(record.complexes ?? 0),
    blocks: record.blocks.map((block) => ({
      id: block.id,
      name: block.name,
      complexId: block.complex_id,
      complexName: bilingualFrom(block.complex_name),
      currency: block.currency,
    })),
    programs: record.programs.map(programItemFrom),
    priceHint: priceHintFrom(record.price_hint),
  }));
}

function ratePartFrom(raw: unknown): RatePart | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as { usd_uzs?: unknown; date?: unknown };
  const usdUzs = Number(value.usd_uzs);
  if (!(usdUzs > 0) || typeof value.date !== "string") return null;
  return { usdUzs, date: value.date };
}

/** settings 'exchange.usd_uzs' = {cbu, manual, demo?}; нет строки — курса нет. */
export function rateSettingFrom(value: unknown): RateSetting {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return { cbu: ratePartFrom(raw.cbu), manual: ratePartFrom(raw.manual) };
}

export function banksFrom(records: readonly { id: number; name: unknown }[]): BankOption[] {
  return records.map((record) => ({ id: record.id, name: bilingualFrom(record.name) }));
}

/** «Обновлено» панели: позднее из правки условий программ и отметки «проверены» (Р5). */
export function panelUpdatedAt(panel: Pick<ProgramPanel, "checkedAt" | "programs">): string | null {
  const dates = [panel.checkedAt, ...panel.programs.map((item) => item.record.updated_at)];
  const present = dates.filter((date): date is string => Boolean(date));
  return present.length > 0 ? present.reduce((a, b) => (a > b ? a : b)) : null;
}
