import { EMPTY_BILINGUAL, type BilingualValue } from "../bilingual";
import { readText } from "../credentials";
import { isEmptyFilter, readFilterSearch } from "./filterForm";
import {
  onlyIssues,
  publicTextIssue,
  readActive,
  readBilingual,
  readComplexIds,
  readSort,
  SHOWCASE_LIMITS,
  type ShowcaseIssue,
} from "./forms";
import { COLLECTION_MODES, type CollectionMode, type CollectionRecord, type FilterSearch } from "./types";

// Подборка (3.16а, мокап coll*): название RU | UZ, ЖК вручную или фильтр каталога, порядок на
// главной, «на сайте». Адрес (slug) даёт сервер из русского названия при создании.

export type CollectionFields = {
  title: BilingualValue;
  mode: string;
  complexIds: string[];
  filter: FilterSearch;
  isActive: boolean;
  sort: string;
};

export type CollectionErrors = Partial<Record<keyof CollectionFields, ShowcaseIssue>>;

export type CollectionInput = {
  title: BilingualValue;
  mode: CollectionMode;
  complexIds: string[];
  filter: FilterSearch;
  isActive: boolean;
  sort: number;
};

export type CollectionParse =
  | { ok: true; value: CollectionInput; fields: CollectionFields }
  | { ok: false; fields: CollectionFields; fieldErrors: CollectionErrors };

const isMode = (value: string): value is CollectionMode =>
  (COLLECTION_MODES as readonly string[]).includes(value);

export function collectionFieldsOf(record: CollectionRecord | null): CollectionFields {
  if (!record) {
    return { title: EMPTY_BILINGUAL, mode: "filter", complexIds: [], filter: {}, isActive: false, sort: "" };
  }
  return {
    title: record.title,
    mode: record.mode,
    complexIds: record.complexIds,
    filter: record.filter,
    isActive: record.isActive,
    sort: String(record.sort),
  };
}

function readFields(formData: FormData): CollectionFields {
  return {
    title: readBilingual(formData, "title"),
    mode: (readText(formData, "mode") ?? "").trim(),
    complexIds: readComplexIds(formData, SHOWCASE_LIMITS.collectionComplexesMax),
    filter: readFilterSearch(formData),
    isActive: readActive(formData),
    sort: readSort(formData).raw,
  };
}

/** Вручную — хотя бы один ЖК; по фильтру — хотя бы одно условие (иначе это «все ЖК»). */
export function parseCollection(formData: FormData): CollectionParse {
  const fields = readFields(formData);
  const sort = readSort(formData).parsed;
  const manual = fields.mode === "manual";
  const fieldErrors = onlyIssues({
    title: publicTextIssue(fields.title, { max: SHOWCASE_LIMITS.collectionTitleMax, required: true }),
    mode: isMode(fields.mode) ? undefined : "kindInvalid",
    complexIds: manual && fields.complexIds.length === 0 ? "noComplexes" : undefined,
    filter: !manual && isMode(fields.mode) && isEmptyFilter(fields.filter) ? "noFilter" : undefined,
    sort: sort.issue ?? undefined,
  });
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fields, fieldErrors };
  return {
    ok: true,
    fields,
    value: {
      title: fields.title,
      mode: fields.mode as CollectionMode,
      // Второй способ не хранится: смена режима не оставляет хвостов.
      complexIds: manual ? fields.complexIds : [],
      filter: manual ? {} : fields.filter,
      isActive: fields.isActive,
      sort: sort.value,
    },
  };
}

/** Строка для insert / update collections (slug — отдельно, только при создании). */
export function collectionRow(input: CollectionInput) {
  return {
    title: input.title,
    mode: input.mode,
    complex_ids: input.complexIds,
    filter: input.filter,
    is_active: input.isActive,
    sort: input.sort,
  };
}
