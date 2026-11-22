import { EMPTY_BILINGUAL, type BilingualValue } from "../bilingual";
import { containsContact } from "../contactGuard";
import { readText } from "../credentials";
import {
  defaultPeriod,
  onlyIssues,
  periodIssues,
  publicTextIssue,
  readActive,
  readBilingual,
  readPeriod,
  readSort,
  readUuidField,
  SHOWCASE_LIMITS,
  type ShowcaseIssue,
} from "./forms";
import type { AdRecord } from "./types";

// Реклама — баннер (правки 15.11, п. 4 + 13; 20.11 — рекламодатель не только застройщик): застройщик из
// списка ИЛИ название рекламодателя (одно из двух; без контактов — 1.2), название (подпись картинки на
// сайте и строка списка), кнопка — телефон Vodiy House или «Ariza qoldirish», период, порядок в
// слайдере и в каталоге, «на сайте». Картинки для ПК и телефона — под формой (ShowcaseFooter). Тексты,
// ЖК и фильтр прежней карточки рекламы при сохранении очищаются: сайт их больше не показывает.

export const AD_CTAS = ["lead", "phone"] as const;
export type AdCta = (typeof AD_CTAS)[number];

/** Название рекламодателя не из застройщиков — до 80 знаков (как check в базе). */
export const ADVERTISER_MAX = 80;

export type AdFields = {
  developerId: string;
  advertiser: string;
  title: BilingualValue;
  cta: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  sort: string;
};

export type AdErrors = Partial<Record<keyof AdFields, ShowcaseIssue>>;

export type AdInput = {
  developerId: string;
  advertiser: string;
  title: BilingualValue;
  cta: AdCta;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  sort: number;
};

export type AdParse =
  | { ok: true; value: AdInput; fields: AdFields }
  | { ok: false; fields: AdFields; fieldErrors: AdErrors };

export const isAdCta = (value: unknown): value is AdCta => (AD_CTAS as readonly unknown[]).includes(value);

export function adFieldsOf(record: AdRecord | null): AdFields {
  if (!record) {
    return { developerId: "", advertiser: "", title: EMPTY_BILINGUAL, cta: "lead", ...defaultPeriod(), isActive: false, sort: "" };
  }
  return {
    developerId: record.developerId,
    advertiser: record.advertiser ?? "",
    title: record.title,
    cta: record.cta,
    validFrom: record.validFrom,
    validTo: record.validTo,
    isActive: record.isActive,
    sort: String(record.sort),
  };
}

function readFields(formData: FormData): AdFields {
  return {
    developerId: readUuidField(formData, "developerId"),
    advertiser: (readText(formData, "advertiser") ?? "").trim(),
    title: readBilingual(formData, "title"),
    cta: (readText(formData, "cta") ?? "").trim(),
    ...readPeriod(formData),
    isActive: readActive(formData),
    sort: readSort(formData).raw,
  };
}

export function parseAd(formData: FormData): AdParse {
  const fields = readFields(formData);
  const sort = readSort(formData).parsed;
  const fieldErrors = onlyIssues({
    // Застройщик из списка или рекламодатель текстом — хотя бы одно.
    advertiser: advertiserIssue(fields),
    title: publicTextIssue(fields.title, { max: SHOWCASE_LIMITS.titleMax, required: true, allowDiscount: true }),
    cta: isAdCta(fields.cta) ? undefined : "kindInvalid",
    ...periodIssues(fields),
    sort: sort.issue ?? undefined,
  });
  if (Object.keys(fieldErrors).length > 0 || !isAdCta(fields.cta)) return { ok: false, fields, fieldErrors };
  return {
    ok: true,
    fields,
    value: {
      developerId: fields.developerId,
      advertiser: fields.advertiser,
      title: fields.title,
      cta: fields.cta,
      validFrom: fields.validFrom,
      validTo: fields.validTo,
      isActive: fields.isActive,
      sort: sort.value,
    },
  };
}

function advertiserIssue({ developerId, advertiser }: AdFields): ShowcaseIssue | undefined {
  if (!developerId && !advertiser) return "required";
  if (advertiser.length > ADVERTISER_MAX) return "tooLong";
  return containsContact(advertiser) ? "contacts" : undefined;
}

/** Строка для insert / update ads: прежние текст, ЖК и фильтр карточки — пустые. */
export function adRow(input: AdInput) {
  return {
    developer_id: input.developerId || null,
    advertiser: input.advertiser || null,
    title: input.title,
    cta: input.cta,
    text: null,
    complex_ids: [],
    filter: {},
    valid_from: input.validFrom,
    valid_to: input.validTo,
    is_active: input.isActive,
    sort: input.sort,
  };
}
