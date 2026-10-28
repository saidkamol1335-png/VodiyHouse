import {
  bilingualIssue,
  bilingualOrNull,
  readBilingual,
  type BilingualIssue,
  type BilingualValue,
} from "../bilingual";
import { bilingualHasContact } from "../contactGuard";
import { readText } from "../credentials";
import { isoDateIssue } from "../developers/mainForm";
import { bilingualMentionsDiscount } from "../discountGuard";
import { todayInTashkent } from "./period";

// Общее у форм витрины (3.16а): публичные тексты RU | UZ проходят перевод, правило 1.2 (нет
// контактов) и запрет «скидка»; период — две даты по порядку; ЖК — список uuid; порядок — число.
// Пределы — под вёрстку карточек главной (мокап sp*, ad*, coll*); проверка до базы, ошибки — по полям.

export const SHOWCASE_LIMITS = {
  badgeMax: 24,
  titleMax: 80,
  textMax: 300,
  adTextMax: 200,
  collectionTitleMax: 60,
  complexesMax: 20,
  collectionComplexesMax: 30,
  sortMax: 999,
  yearMin: 2020,
  yearMax: 2100,
  /** Новый период по умолчанию — месяц от сегодня. */
  defaultDays: 30,
} as const;

export type ShowcaseIssue =
  | BilingualIssue
  | "contacts"
  | "discount"
  | "dateInvalid"
  | "outOfRange"
  | "periodOrder"
  | "noComplexes"
  | "noFilter"
  | "kindInvalid"
  | "notWholeNumber";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Публичный текст: перевод и длина, затем правило 1.2 и «нет скидок» (PLAN §3.13). */
export function publicTextIssue(
  value: BilingualValue,
  options: { max: number; required?: boolean },
): ShowcaseIssue | undefined {
  const issue = bilingualIssue(value, options);
  if (issue) return issue;
  if (bilingualHasContact(value)) return "contacts";
  return bilingualMentionsDiscount(value) ? "discount" : undefined;
}

export type PeriodFields = { validFrom: string; validTo: string };

export function readPeriod(formData: FormData): PeriodFields {
  return {
    validFrom: (readText(formData, "validFrom") ?? "").trim(),
    validTo: (readText(formData, "validTo") ?? "").trim(),
  };
}

/** Дата формы: пусто — required, иначе проверка ISO-даты застройщика (dateInvalid / outOfRange). */
function dateIssue(raw: string): ShowcaseIssue | null {
  if (!raw) return "required";
  const issue = isoDateIssue(raw, SHOWCASE_LIMITS.yearMin, SHOWCASE_LIMITS.yearMax);
  return issue === "dateInvalid" || issue === "outOfRange" ? issue : null;
}

/** Обе даты настоящие, конец не раньше начала. */
export function periodIssues(period: PeriodFields): Partial<Record<keyof PeriodFields, ShowcaseIssue>> {
  const from = dateIssue(period.validFrom);
  const to = dateIssue(period.validTo);
  const issues: Partial<Record<keyof PeriodFields, ShowcaseIssue>> = {};
  if (from) issues.validFrom = from;
  if (to) issues.validTo = to;
  if (!from && !to && period.validTo < period.validFrom) issues.validTo = "periodOrder";
  return issues;
}

/** Период новой записи: с сегодняшнего дня на месяц (Ташкент). */
export function defaultPeriod(now: Date = new Date()): PeriodFields {
  const validFrom = todayInTashkent(now);
  const validTo = todayInTashkent(new Date(now.getTime() + SHOWCASE_LIMITS.defaultDays * DAY_MS));
  return { validFrom, validTo };
}

/** Отмеченные ЖК формы — только uuid, без повторов, не больше max (лишние отбрасываются). */
export function readComplexIds(formData: FormData, max: number): string[] {
  const ids = formData
    .getAll("complexIds")
    .filter((value): value is string => typeof value === "string" && UUID.test(value))
    .map((value) => value.toLowerCase());
  return [...new Set(ids)].slice(0, max);
}

export function readActive(formData: FormData): boolean {
  return readText(formData, "isActive") === "on";
}

export type SortParse = { value: number; issue: ShowcaseIssue | null };

/** Порядок показа: целое от 0 до 999; пусто — 0 (первые). */
export function readSort(formData: FormData): { raw: string; parsed: SortParse } {
  const raw = (readText(formData, "sort") ?? "").trim();
  if (!raw) return { raw, parsed: { value: 0, issue: null } };
  const value = Number(raw);
  if (!Number.isInteger(value)) return { raw, parsed: { value: 0, issue: "notWholeNumber" } };
  const outside = value < 0 || value > SHOWCASE_LIMITS.sortMax;
  return { raw, parsed: { value: outside ? 0 : value, issue: outside ? "outOfRange" : null } };
}

export function readUuidField(formData: FormData, name: string): string {
  const value = (readText(formData, name) ?? "").trim().toLowerCase();
  return UUID.test(value) ? value : "";
}

/** Текст необязательный: пустой — null для базы. */
export function optionalText(value: BilingualValue): BilingualValue | null {
  return bilingualOrNull(value);
}

export { readBilingual };

/** Оставляет только найденные ошибки — форма показывает их под полями. */
export function onlyIssues<Errors extends Record<string, ShowcaseIssue | undefined | null>>(
  issues: Errors,
): Partial<Record<keyof Errors, ShowcaseIssue>> {
  return Object.fromEntries(Object.entries(issues).filter(([, issue]) => issue)) as Partial<
    Record<keyof Errors, ShowcaseIssue>
  >;
}
