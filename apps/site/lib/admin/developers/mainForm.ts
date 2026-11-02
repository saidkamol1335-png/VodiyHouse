import {
  bilingualIssue,
  bilingualOrNull,
  readBilingual,
  type BilingualIssue,
  type BilingualValue,
} from "../bilingual";
import { bilingualHasContact, containsContact } from "../contactGuard";
import { readText } from "../credentials";

// Вкладка «Основное» застройщика (решение Д2): разбор формы и проверка до базы. Пределы —
// как check в миграции developers (тест сверяет); тексты — под вёрстку страницы застройщика.

export const DEVELOPER_LIMITS = {
  nameMin: 2,
  nameMax: 60,
  aboutMax: 600,
  foundersMax: 200,
  yearMin: 1950,
  yearMax: 2100,
  flatsMax: 1_000_000,
  checkedYearMin: 2000,
} as const;

export type DeveloperMainFields = {
  name: string;
  foundedYear: string;
  flatsDelivered: string;
  deliveredCheckedAt: string;
  about: BilingualValue;
  founders: BilingualValue;
};

export type DeveloperMainInput = {
  name: string;
  foundedYear: number | null;
  flatsDelivered: number | null;
  deliveredCheckedAt: string | null;
  about: BilingualValue | null;
  founders: BilingualValue | null;
};

export type DeveloperFieldIssue =
  BilingualIssue | "tooShort" | "outOfRange" | "notWholeNumber" | "dateInvalid" | "contacts";
export type DeveloperMainErrors = Partial<Record<keyof DeveloperMainFields, DeveloperFieldIssue>>;
/** fields — введённое как есть: React сбрасывает форму после действия, его возвращают в форму. */
export type DeveloperMainParse =
  | { ok: true; value: DeveloperMainInput; fields: DeveloperMainFields }
  | { ok: false; fields: DeveloperMainFields; fieldErrors: DeveloperMainErrors };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Название — как набрано, без лишних пробелов. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function nameIssue(name: string): DeveloperFieldIssue | null {
  if (!name) return "required";
  if (name.length < DEVELOPER_LIMITS.nameMin) return "tooShort";
  if (name.length > DEVELOPER_LIMITS.nameMax) return "tooLong";
  return containsContact(name) ? "contacts" : null;
}

/** Публичный текст: длина и перевод, затем правило 1.2 — контактов застройщика на сайте нет. */
function publicTextIssue(value: BilingualValue, max: number): DeveloperFieldIssue | undefined {
  return bilingualIssue(value, { max }) ?? (bilingualHasContact(value) ? "contacts" : undefined);
}

type WholeNumber = { value: number | null; issue: DeveloperFieldIssue | null };

function wholeNumber(raw: string, min: number, max: number): WholeNumber {
  if (!raw) return { value: null, issue: null };
  const value = Number(raw);
  if (!Number.isInteger(value)) return { value: null, issue: "notWholeNumber" };
  return value < min || value > max ? { value: null, issue: "outOfRange" } : { value, issue: null };
}

/** Дата ISO без часового пояса; несуществующая (31.02) — ошибка. */
export function isoDateIssue(
  raw: string,
  yearMin: number,
  yearMax: number,
): DeveloperFieldIssue | null {
  const match = ISO_DATE.exec(raw);
  if (!match) return "dateInvalid";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "dateInvalid";
  return year < yearMin || year > yearMax ? "outOfRange" : null;
}

function readFields(formData: FormData): DeveloperMainFields {
  const text = (name: string) => (readText(formData, name) ?? "").trim();
  return {
    name: normalizeName(readText(formData, "name") ?? ""),
    foundedYear: text("foundedYear"),
    flatsDelivered: text("flatsDelivered").replace(/\s+/g, ""),
    deliveredCheckedAt: text("deliveredCheckedAt"),
    about: readBilingual(formData, "about"),
    founders: readBilingual(formData, "founders"),
  };
}

/** «Сохранить вкладку»: значения для базы или ошибки по полям (введённое возвращается в форму). */
export function parseDeveloperMain(formData: FormData): DeveloperMainParse {
  const fields = readFields(formData);
  const { yearMin, yearMax, flatsMax, checkedYearMin, aboutMax, foundersMax } = DEVELOPER_LIMITS;
  const year = wholeNumber(fields.foundedYear, yearMin, yearMax);
  const flats = wholeNumber(fields.flatsDelivered, 0, flatsMax);
  const issues: DeveloperMainErrors = {
    name: nameIssue(fields.name) ?? undefined,
    foundedYear: year.issue ?? undefined,
    flatsDelivered: flats.issue ?? undefined,
    deliveredCheckedAt: fields.deliveredCheckedAt
      ? (isoDateIssue(fields.deliveredCheckedAt, checkedYearMin, yearMax) ?? undefined)
      : undefined,
    about: publicTextIssue(fields.about, aboutMax),
    founders: publicTextIssue(fields.founders, foundersMax),
  };
  const fieldErrors = Object.fromEntries(
    Object.entries(issues).filter(([, issue]) => issue),
  ) as DeveloperMainErrors;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fields, fieldErrors };
  return {
    ok: true,
    fields,
    value: {
      name: fields.name,
      foundedYear: year.value,
      flatsDelivered: flats.value,
      deliveredCheckedAt: fields.deliveredCheckedAt || null,
      about: bilingualOrNull(fields.about),
      founders: bilingualOrNull(fields.founders),
    },
  };
}

/** Строка для update developers. */
export function developerMainRow(input: DeveloperMainInput) {
  return {
    name: input.name,
    founded_year: input.foundedYear,
    flats_delivered: input.flatsDelivered,
    delivered_checked_at: input.deliveredCheckedAt,
    about: input.about,
    founders: input.founders,
  };
}
