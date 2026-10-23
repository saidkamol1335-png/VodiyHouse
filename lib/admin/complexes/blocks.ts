import { bilingualFrom, type BilingualIssue, type BilingualValue } from "../bilingual";
import { quarterEndDate, type QuarterNumber } from "@/lib/quarters";

// Вкладка «Блоки» (И4): карточки блоков в браузере и строки из базы. Разбор формы —
// blocksParse.ts; пределы — как check в миграциях blocks (тест сверяет).

export const BLOCK_LIMITS = {
  nameMax: 8,
  maxRows: 20,
  floorsMax: 100,
  yearMin: 2000,
  yearMax: 2100,
  includesMax: 12,
  includeItemMax: 60,
} as const;

export const BUILD_STATUSES = ["building", "delivered"] as const;
export const CADASTRE_STATUSES = ["done", "in_progress", "after_delivery"] as const;
export const CURRENCIES = ["USD", "UZS"] as const;

export type BuildStatus = (typeof BUILD_STATUSES)[number];
export type CadastreStatus = (typeof CADASTRE_STATUSES)[number];
export type Currency = (typeof CURRENCIES)[number];

/** «Что входит в цену» (ТЗ 7.3в): пункт RU | UZ · входит или отдельно · цена, если отдельно. */
export type PriceInclude = { key: string; item: BilingualValue; included: boolean; price: string };

/** Карточка в браузере: числа — как набраны; key — для React и ошибок, id — у сохранённых. */
export type BlockDraft = {
  key: string;
  id: string | null;
  name: string;
  buildStatus: BuildStatus;
  progressPct: string;
  floorsTotal: string;
  floorsBuilt: string;
  /** Срок сдачи — последний день квартала (как у QuarterSelect); в базе — год и квартал. */
  deadline: string | null;
  finishingId: string;
  cadastre: CadastreStatus | "";
  cadastreExpectedOn: string | null;
  currency: Currency;
  priceIncludes: PriceInclude[];
  /** Только чтение: у блока есть список квартир — не удаляется (шаг 12). */
  units: number;
  /** Только чтение: планировок с ценой; с ними, квартирами или ценой пункта смена валюты спросит. */
  pricedLayouts: number;
};

export type BlockRowIssue =
  | BilingualIssue
  | "contacts"
  | "nameRequired"
  | "nameTooLong"
  | "nameTaken"
  | "includePrice"
  | "floorsRequired"
  | "outOfRange"
  | "notWholeNumber"
  | "builtOverTotal"
  | "choiceInvalid";
export type BlockRowErrors = Record<string, Partial<Record<string, BlockRowIssue>>>;

/** Для save_complex_blocks. */
export type BlockPayload = {
  id?: string;
  name: string;
  build_status: BuildStatus;
  progress_pct: number | null;
  floors_total: number;
  floors_built: number | null;
  deadline_year: number | null;
  deadline_quarter: QuarterNumber | null;
  finishing_id: number | null;
  cadastre: CadastreStatus | null;
  cadastre_expected_on: string | null;
  currency: Currency;
  price_includes: { item: BilingualValue; included: boolean; price?: number }[];
};

export type BlocksParse =
  | { ok: true; payload: BlockPayload[] }
  | { ok: false; error: "invalid" | "tooMany" }
  | { ok: false; error: null; rowErrors: BlockRowErrors };

export function newBlockDraft(): BlockDraft {
  return {
    key: crypto.randomUUID(),
    id: null,
    name: "",
    buildStatus: "building",
    progressPct: "",
    floorsTotal: "",
    floorsBuilt: "",
    deadline: null,
    finishingId: "",
    cadastre: "",
    cadastreExpectedOn: null,
    currency: "USD",
    priceIncludes: [],
    units: 0,
    pricedLayouts: 0,
  };
}

/** Новый пункт «что входит в цену»: входит, без цены. */
export function newPriceInclude(): PriceInclude {
  return { key: crypto.randomUUID(), item: { ru: "", uz: "" }, included: true, price: "" };
}

const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export type BlockRecord = {
  id: string;
  name: string;
  build_status: string;
  progress_pct: number | null;
  floors_total: number | null;
  floors_built: number | null;
  deadline_year: number | null;
  deadline_quarter: number | null;
  finishing_id: number | null;
  cadastre: string | null;
  cadastre_expected_on: string | null;
  currency: string;
  price_includes: unknown;
  units: number;
  priced_layouts: number;
};

const numberText = (value: number | null) => (value === null ? "" : String(value));

function includesFrom(raw: unknown): PriceInclude[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: Record<string, unknown>, index) => ({
    key: `include-${index}`,
    item: bilingualFrom(item?.item),
    included: item?.included === true,
    price: typeof item?.price === "number" ? String(item.price) : "",
  }));
}

/** Строки из базы — в карточки формы (key = id). */
export function blockDraftsFrom(records: readonly BlockRecord[]): BlockDraft[] {
  return records.map((record) => ({
    key: record.id,
    id: record.id,
    name: record.name,
    buildStatus: oneOf(BUILD_STATUSES, record.build_status) ? record.build_status : "building",
    progressPct: numberText(record.progress_pct),
    floorsTotal: numberText(record.floors_total),
    floorsBuilt: numberText(record.floors_built),
    deadline:
      record.deadline_year && record.deadline_quarter
        ? quarterEndDate({
            year: record.deadline_year,
            quarter: record.deadline_quarter as QuarterNumber,
          })
        : null,
    finishingId: numberText(record.finishing_id),
    cadastre: oneOf(CADASTRE_STATUSES, record.cadastre) ? record.cadastre : "",
    cadastreExpectedOn: record.cadastre_expected_on,
    currency: oneOf(CURRENCIES, record.currency) ? record.currency : "USD",
    priceIncludes: includesFrom(record.price_includes),
    units: record.units,
    pricedLayouts: record.priced_layouts,
  }));
}
