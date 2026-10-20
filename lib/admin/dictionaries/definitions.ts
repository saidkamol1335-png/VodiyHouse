import {
  bilingualFrom,
  bilingualIssue,
  bilingualOrNull,
  readBilingual,
  type BilingualIssue,
  type BilingualValue,
} from "../bilingual";
import { readText } from "../credentials";

// «Настройки → Справочники» (решение Д6, ТЗ 13.2): города и районы, типы документов, темы
// деталей, уровни отделки. Подсказки к терминам — с расчётом (фаза 2): их набор задаёт код.

export const DICTIONARY_KEYS = [
  "locations",
  "document_types",
  "detail_topics",
  "finishings",
] as const;
export type DictionaryKey = (typeof DICTIONARY_KEYS)[number];

export const LOCATION_KINDS = ["city", "district"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

type DictionaryDefinition = {
  /** Второе поле на двух языках: «что это значит для вас» у документа, «что входит» у отделки. */
  second: "hint" | "description" | null;
  /** Город или район — только у locations. */
  hasKind: boolean;
  /** Адрес, если в названии нет ни буквы латиницей, ни цифры. */
  slugFallback: string;
};

export const DICTIONARIES: Record<DictionaryKey, DictionaryDefinition> = {
  locations: { second: null, hasKind: true, slugFallback: "joy" },
  document_types: { second: "hint", hasKind: false, slugFallback: "hujjat" },
  detail_topics: { second: null, hasKind: false, slugFallback: "mavzu" },
  finishings: { second: "description", hasKind: false, slugFallback: "pardoz" },
};

export const DICTIONARY_LIMITS = { nameMax: 80, secondMax: 300, maxItems: 500 } as const;

export type DictionaryItem = {
  id: number;
  slug: string;
  name: BilingualValue;
  second: BilingualValue | null;
  kind: LocationKind | null;
  isActive: boolean;
  sort: number;
};

export type DictionaryRecord = Record<string, unknown> & {
  id: number;
  slug: string;
  is_active: boolean;
  sort?: number | null;
};

/** Колонки для select: только то, что есть у справочника. */
export function dictionaryColumns(key: DictionaryKey): string {
  const { second, hasKind } = DICTIONARIES[key];
  return [
    "id",
    "slug",
    "name",
    "sort",
    "is_active",
    ...(second ? [second] : []),
    ...(hasKind ? ["kind"] : []),
  ].join(", ");
}

const isKind = (value: unknown): value is LocationKind =>
  LOCATION_KINDS.includes(value as LocationKind);

export function parseDictionaryItems(
  key: DictionaryKey,
  records: readonly DictionaryRecord[],
): DictionaryItem[] {
  const { second } = DICTIONARIES[key];
  return records.map((record) => ({
    id: Number(record.id),
    slug: record.slug,
    name: bilingualFrom(record.name),
    second: second && record[second] ? bilingualFrom(record[second]) : null,
    kind: isKind(record.kind) ? record.kind : null,
    isActive: record.is_active,
    sort: Number(record.sort ?? 0),
  }));
}

export type DictionaryItemInput = {
  name: BilingualValue;
  second: BilingualValue | null;
  kind: LocationKind | null;
};
export type DictionaryItemErrors = Partial<
  Record<"name" | "second" | "kind", BilingualIssue | "kindInvalid">
>;
export type DictionaryItemParse =
  { ok: true; value: DictionaryItemInput } | { ok: false; fieldErrors: DictionaryItemErrors };

/** Строка «правка на месте» или «+ Добавить»: название обязательно, второе поле — по желанию. */
export function parseDictionaryItem(key: DictionaryKey, formData: FormData): DictionaryItemParse {
  const { second, hasKind } = DICTIONARIES[key];
  const { nameMax, secondMax } = DICTIONARY_LIMITS;
  const name = readBilingual(formData, "name");
  const secondValue = second ? readBilingual(formData, "second") : null;
  const kind = hasKind ? readText(formData, "kind") : null;
  const fieldErrors: DictionaryItemErrors = {};
  const nameProblem = bilingualIssue(name, { max: nameMax, required: true });
  if (nameProblem) fieldErrors.name = nameProblem;
  const secondProblem = secondValue ? bilingualIssue(secondValue, { max: secondMax }) : null;
  if (secondProblem) fieldErrors.second = secondProblem;
  if (hasKind && !isKind(kind)) fieldErrors.kind = "kindInvalid";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      name,
      second: secondValue ? bilingualOrNull(secondValue) : null,
      kind: isKind(kind) ? kind : null,
    },
  };
}

/** Поля строки для insert / update в таблицу справочника. */
export function dictionaryRow(
  key: DictionaryKey,
  input: DictionaryItemInput,
): Record<string, unknown> {
  const { second, hasKind } = DICTIONARIES[key];
  return {
    name: input.name,
    ...(second ? { [second]: input.second } : {}),
    ...(hasKind ? { kind: input.kind } : {}),
  };
}

export function readDictionaryKey(formData: FormData): DictionaryKey | null {
  const key = readText(formData, "dictionary");
  return DICTIONARY_KEYS.includes(key as DictionaryKey) ? (key as DictionaryKey) : null;
}

const SMALLINT_MAX = 32767;

/** id значения справочника (smallint): только целое число в пределах. */
export function readItemId(formData: FormData): number | null {
  const raw = readText(formData, "id") ?? "";
  const id = /^\d{1,5}$/.test(raw) ? Number(raw) : NaN;
  return id > 0 && id <= SMALLINT_MAX ? id : null;
}

/** Новый порядок перетаскиванием: поле `order` — JSON-массив id без повторов. */
export function readOrder(formData: FormData): number[] | null {
  try {
    const ids: unknown = JSON.parse(readText(formData, "order") ?? "");
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > DICTIONARY_LIMITS.maxItems)
      return null;
    const valid = ids.every((id) => Number.isInteger(id) && id > 0 && id <= SMALLINT_MAX);
    return valid && new Set(ids).size === ids.length ? (ids as number[]) : null;
  } catch {
    return null;
  }
}

/** Новое значение — в конец списка (sort с шагом 10, как у reorder_dictionary). */
export function nextSort(items: readonly DictionaryItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.sort), 0) + 10;
}
