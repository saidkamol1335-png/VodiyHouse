import { EMPTY_BILINGUAL, type BilingualValue } from "../bilingual";
import { readText } from "../credentials";
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
import { SPECIAL_KINDS, type SpecialKind, type SpecialRecord } from "./types";

// Спецпредложение (3.16а): вид без «скидки», бейдж для карточки ЖК, заголовок и текст, ЖК своего
// застройщика (хотя бы один), период, порядок, «на сайте».

export type SpecialFields = {
  developerId: string;
  kind: string;
  badge: BilingualValue;
  title: BilingualValue;
  text: BilingualValue;
  complexIds: string[];
  validFrom: string;
  validTo: string;
  isActive: boolean;
  sort: string;
};

export type SpecialErrors = Partial<Record<keyof SpecialFields, ShowcaseIssue>>;

export type SpecialInput = {
  developerId: string;
  kind: SpecialKind;
  badge: BilingualValue;
  title: BilingualValue;
  text: BilingualValue | null;
  complexIds: string[];
  validFrom: string;
  validTo: string;
  isActive: boolean;
  sort: number;
};

export type SpecialParse =
  | { ok: true; value: SpecialInput; fields: SpecialFields }
  | { ok: false; fields: SpecialFields; fieldErrors: SpecialErrors };

const isKind = (value: string): value is SpecialKind =>
  (SPECIAL_KINDS as readonly string[]).includes(value);

/** Поля формы из записи; новая — пустая, с периодом на месяц. */
export function specialFieldsOf(record: SpecialRecord | null): SpecialFields {
  if (!record) {
    return {
      developerId: "",
      kind: "gift",
      badge: EMPTY_BILINGUAL,
      title: EMPTY_BILINGUAL,
      text: EMPTY_BILINGUAL,
      complexIds: [],
      ...defaultPeriod(),
      isActive: false,
      sort: "",
    };
  }
  return {
    developerId: record.developerId,
    kind: record.kind,
    badge: record.badge,
    title: record.title,
    text: record.text ?? EMPTY_BILINGUAL,
    complexIds: record.complexIds,
    validFrom: record.validFrom,
    validTo: record.validTo,
    isActive: record.isActive,
    sort: String(record.sort),
  };
}

function readFields(formData: FormData): SpecialFields {
  return {
    developerId: readUuidField(formData, "developerId"),
    kind: (readText(formData, "kind") ?? "").trim(),
    badge: readBilingual(formData, "badge"),
    title: readBilingual(formData, "title"),
    text: readBilingual(formData, "text"),
    complexIds: readComplexIds(formData, SHOWCASE_LIMITS.complexesMax),
    ...readPeriod(formData),
    isActive: readActive(formData),
    sort: readSort(formData).raw,
  };
}

/** «Сохранить»: значения для базы или ошибки по полям (введённое возвращается в форму). */
export function parseSpecial(formData: FormData): SpecialParse {
  const fields = readFields(formData);
  const sort = readSort(formData).parsed;
  const fieldErrors = onlyIssues({
    developerId: fields.developerId ? undefined : "required",
    kind: isKind(fields.kind) ? undefined : "kindInvalid",
    badge: publicTextIssue(fields.badge, { max: SHOWCASE_LIMITS.badgeMax, required: true }),
    title: publicTextIssue(fields.title, { max: SHOWCASE_LIMITS.titleMax, required: true }),
    text: publicTextIssue(fields.text, { max: SHOWCASE_LIMITS.textMax }),
    complexIds: fields.complexIds.length > 0 ? undefined : "noComplexes",
    ...periodIssues(fields),
    sort: sort.issue ?? undefined,
  });
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fields, fieldErrors };
  return {
    ok: true,
    fields,
    value: {
      developerId: fields.developerId,
      kind: fields.kind as SpecialKind,
      badge: fields.badge,
      title: fields.title,
      text: optionalText(fields.text),
      complexIds: fields.complexIds,
      validFrom: fields.validFrom,
      validTo: fields.validTo,
      isActive: fields.isActive,
      sort: sort.value,
    },
  };
}

/** Строка для insert / update specials. */
export function specialRow(input: SpecialInput) {
  return {
    developer_id: input.developerId,
    kind: input.kind,
    badge: input.badge,
    title: input.title,
    text: input.text,
    complex_ids: input.complexIds,
    valid_from: input.validFrom,
    valid_to: input.validTo,
    is_active: input.isActive,
    sort: input.sort,
  };
}
