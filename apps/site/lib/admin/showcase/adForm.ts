import { EMPTY_BILINGUAL, type BilingualValue } from "../bilingual";
import { readText } from "../credentials";
import { isEmptyFilter, readFilterSearch } from "./filterForm";
import {
  defaultPeriod,
  onlyIssues,
  optionalText,
  periodIssues,
  publicTextIssue,
  readActive,
  readBilingual,
  readComplexIds,
  readPeriod,
  readSort,
  readUuidField,
  SHOWCASE_LIMITS,
  type ShowcaseIssue,
} from "./forms";
import type { AdRecord, FilterSearch } from "./types";

// Реклама застройщика (3.16а, мокап ad*): заголовок и текст, цель — ЖК застройщика или фильтр
// каталога («Показать N квартир» ведёт туда), период, порядок очереди (Г1 A), «на сайте».

export const AD_TARGETS = ["complexes", "filter"] as const;
export type AdTarget = (typeof AD_TARGETS)[number];

export type AdFields = {
  developerId: string;
  title: BilingualValue;
  text: BilingualValue;
  target: string;
  complexIds: string[];
  filter: FilterSearch;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  sort: string;
};

export type AdErrors = Partial<Record<keyof AdFields, ShowcaseIssue>>;

export type AdInput = {
  developerId: string;
  title: BilingualValue;
  text: BilingualValue | null;
  complexIds: string[];
  filter: FilterSearch;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  sort: number;
};

export type AdParse =
  | { ok: true; value: AdInput; fields: AdFields }
  | { ok: false; fields: AdFields; fieldErrors: AdErrors };

const isTarget = (value: string): value is AdTarget => (AD_TARGETS as readonly string[]).includes(value);

export function adFieldsOf(record: AdRecord | null): AdFields {
  if (!record) {
    return {
      developerId: "",
      title: EMPTY_BILINGUAL,
      text: EMPTY_BILINGUAL,
      target: "complexes",
      complexIds: [],
      filter: {},
      ...defaultPeriod(),
      isActive: false,
      sort: "",
    };
  }
  return {
    developerId: record.developerId,
    title: record.title,
    text: record.text ?? EMPTY_BILINGUAL,
    target: record.complexIds.length > 0 ? "complexes" : "filter",
    complexIds: record.complexIds,
    filter: record.filter,
    validFrom: record.validFrom,
    validTo: record.validTo,
    isActive: record.isActive,
    sort: String(record.sort),
  };
}

function readFields(formData: FormData): AdFields {
  return {
    developerId: readUuidField(formData, "developerId"),
    title: readBilingual(formData, "title"),
    text: readBilingual(formData, "text"),
    target: (readText(formData, "target") ?? "").trim(),
    complexIds: readComplexIds(formData, SHOWCASE_LIMITS.complexesMax),
    filter: readFilterSearch(formData),
    ...readPeriod(formData),
    isActive: readActive(formData),
    sort: readSort(formData).raw,
  };
}

export function parseAd(formData: FormData): AdParse {
  const fields = readFields(formData);
  const sort = readSort(formData).parsed;
  const byComplexes = fields.target === "complexes";
  const fieldErrors = onlyIssues({
    developerId: fields.developerId ? undefined : "required",
    title: publicTextIssue(fields.title, { max: SHOWCASE_LIMITS.titleMax, required: true }),
    text: publicTextIssue(fields.text, { max: SHOWCASE_LIMITS.adTextMax }),
    target: isTarget(fields.target) ? undefined : "kindInvalid",
    complexIds: byComplexes && fields.complexIds.length === 0 ? "noComplexes" : undefined,
    filter: !byComplexes && isTarget(fields.target) && isEmptyFilter(fields.filter) ? "noFilter" : undefined,
    ...periodIssues(fields),
    sort: sort.issue ?? undefined,
  });
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fields, fieldErrors };
  return {
    ok: true,
    fields,
    value: {
      developerId: fields.developerId,
      title: fields.title,
      text: optionalText(fields.text),
      complexIds: byComplexes ? fields.complexIds : [],
      filter: byComplexes ? {} : fields.filter,
      validFrom: fields.validFrom,
      validTo: fields.validTo,
      isActive: fields.isActive,
      sort: sort.value,
    },
  };
}

/** Строка для insert / update ads. */
export function adRow(input: AdInput) {
  return {
    developer_id: input.developerId,
    title: input.title,
    text: input.text,
    complex_ids: input.complexIds,
    filter: input.filter,
    valid_from: input.validFrom,
    valid_to: input.validTo,
    is_active: input.isActive,
    sort: input.sort,
  };
}
