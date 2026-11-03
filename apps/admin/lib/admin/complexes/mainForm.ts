import {
  bilingualIssue,
  bilingualOrNull,
  readBilingual,
  type BilingualIssue,
  type BilingualValue,
} from "../bilingual";
import { bilingualHasContact } from "../contactGuard";
import { readText, readUuid } from "../credentials";
import { isoDateIssue } from "../developers/mainForm";
import { isInFerganaRegion, parseCoordinates, type GeoPoint } from "@/lib/geo";
import { nearbyRecord, type NearbyPlace } from "@/lib/site/complex/nearby";
import { COMPLEX_NAME_MAX, normalizeComplexName } from "./create";
import { parseNearby, readNearbyDrafts, type NearbyDraft, type NearbyIssue } from "./nearby";
import {
  COMPLEX_CLASSES,
  HOUSE_TYPES,
  PARKING_TYPES,
  type ComplexClass,
  type HouseType,
  type ParkingType,
} from "./record";

// Вкладка «Основное» ЖК (И1–И3): разбор формы и проверка до базы. Пределы — как check в
// миграциях complexes (тест сверяет); тексты — под вёрстку карточки и страницы ЖК (PLAN 3а).

export const COMPLEX_LIMITS = {
  nameMax: COMPLEX_NAME_MAX,
  shortDescriptionMax: 140,
  addressMax: 60,
  landmarkMax: 50,
  minutesMax: 240,
  ceilingMin: 2,
  ceilingMax: 6,
  checkedYearMin: 2000,
  checkedYearMax: 2100,
} as const;

export type ComplexMainFields = {
  name: BilingualValue;
  developerId: string;
  class: string;
  houseType: string;
  ceilingHeight: string;
  parking: string;
  shortDescription: BilingualValue;
  locationId: string;
  address: BilingualValue;
  landmark: BilingualValue;
  minutesToCenter: string;
  point: string;
  /** «Удобство локации» (Ф5) — строки как набраны. */
  nearby: NearbyDraft[];
  staffVisitedAt: string;
};

export type ComplexMainInput = {
  name: BilingualValue;
  developerId: string;
  class: ComplexClass | null;
  houseType: HouseType | null;
  ceilingHeight: number | null;
  parking: ParkingType | null;
  shortDescription: BilingualValue | null;
  locationId: number | null;
  address: BilingualValue | null;
  landmark: BilingualValue | null;
  minutesToCenter: number | null;
  point: GeoPoint | null;
  nearby: NearbyPlace[];
  staffVisitedAt: string | null;
};

export type ComplexFieldIssue =
  | BilingualIssue
  | "contacts"
  | "developerRequired"
  | "choiceInvalid"
  | "outOfRange"
  | "notNumber"
  | "pointInvalid"
  | "dateInvalid"
  | NearbyIssue;
export type ComplexMainErrors = Partial<Record<keyof ComplexMainFields, ComplexFieldIssue>>;
export type ComplexMainParse =
  | { ok: true; value: Partial<ComplexMainInput>; fields: ComplexMainFields }
  | { ok: false; fields: ComplexMainFields; fieldErrors: ComplexMainErrors };

const TEXT_FIELDS = [
  "class",
  "houseType",
  "parking",
  "locationId",
  "minutesToCenter",
  "point",
] as const;
// «Разрешение» и «Земля» — из документов ЖК (шаг 3.5): здесь только визит сотрудника.
const DATE_FIELDS = ["staffVisitedAt"] as const;

function readFields(formData: FormData): ComplexMainFields {
  const plain = (name: string) => (readText(formData, name) ?? "").trim();
  const name = readBilingual(formData, "name");
  return {
    name: { ru: normalizeComplexName(name.ru), uz: normalizeComplexName(name.uz) },
    developerId: readUuid(formData, "developerId") ?? "",
    ceilingHeight: plain("ceilingHeight"),
    shortDescription: readBilingual(formData, "shortDescription"),
    address: readBilingual(formData, "address"),
    landmark: readBilingual(formData, "landmark"),
    nearby: readNearbyDrafts(readText(formData, "nearby")),
    ...(Object.fromEntries(TEXT_FIELDS.map((field) => [field, plain(field)])) as Record<
      (typeof TEXT_FIELDS)[number],
      string
    >),
    ...(Object.fromEntries(DATE_FIELDS.map((field) => [field, plain(field)])) as Record<
      (typeof DATE_FIELDS)[number],
      string
    >),
  };
}

type Parsed<T> = { value: T | null; issue?: ComplexFieldIssue };

function choice<T extends string>(values: readonly T[], raw: string): Parsed<T> {
  if (!raw) return { value: null };
  return (values as readonly string[]).includes(raw)
    ? { value: raw as T }
    : { value: null, issue: "choiceInvalid" };
}

function numberIn(raw: string, min: number, max: number, whole: boolean): Parsed<number> {
  if (!raw) return { value: null };
  const value = Number(raw);
  if (!Number.isFinite(value) || (whole && !Number.isInteger(value)))
    return { value: null, issue: "notNumber" };
  return value < min || value > max ? { value: null, issue: "outOfRange" } : { value };
}

function text(value: BilingualValue, max: number, required = false): Parsed<BilingualValue> {
  const issue = bilingualIssue(value, { max, required });
  if (issue) return { value: null, issue };
  return bilingualHasContact(value)
    ? { value: null, issue: "contacts" }
    : { value: bilingualOrNull(value) };
}

function date(raw: string): Parsed<string> {
  if (!raw) return { value: null };
  const issue = isoDateIssue(raw, COMPLEX_LIMITS.checkedYearMin, COMPLEX_LIMITS.checkedYearMax);
  return issue ? { value: null, issue: "dateInvalid" } : { value: raw };
}

function point(raw: string): Parsed<GeoPoint> {
  if (!raw) return { value: null };
  const parsed = parseCoordinates(raw);
  return parsed ? { value: parsed } : { value: null, issue: "pointInvalid" };
}

function parseValues(fields: ComplexMainFields) {
  const limits = COMPLEX_LIMITS;
  return {
    name: text(fields.name, limits.nameMax, true),
    // Обязателен только для публикации: это проверяет минимум ЖК.
    developerId: { value: fields.developerId || null, issue: undefined },
    class: choice(COMPLEX_CLASSES, fields.class),
    houseType: choice(HOUSE_TYPES, fields.houseType),
    ceilingHeight: numberIn(
      fields.ceilingHeight.replace(",", "."),
      limits.ceilingMin,
      limits.ceilingMax,
      false,
    ),
    parking: choice(PARKING_TYPES, fields.parking),
    shortDescription: text(fields.shortDescription, limits.shortDescriptionMax),
    locationId: numberIn(fields.locationId, 1, 32_767, true),
    address: text(fields.address, limits.addressMax),
    landmark: text(fields.landmark, limits.landmarkMax),
    minutesToCenter: numberIn(fields.minutesToCenter, 0, limits.minutesMax, true),
    point: point(fields.point),
    nearby: parseNearby(fields.nearby),
    staffVisitedAt: date(fields.staffVisitedAt),
  };
}

/**
 * Поля «Основного» по вкладкам экрана 3 (PLAN §10, п. 21): каждая вкладка сохраняет только свои
 * колонки — правка «Расположения» не перезапишет то, что коллега поменял в «Основном».
 */
export const MAIN_SECTIONS = {
  main: ["name", "developerId", "class", "houseType", "ceilingHeight", "parking"],
  about: ["shortDescription"],
  location: ["locationId", "address", "landmark", "minutesToCenter", "point", "nearby"],
  checks: ["staffVisitedAt"],
} as const satisfies Record<string, readonly (keyof ComplexMainFields)[]>;

export type ComplexMainSection = keyof typeof MAIN_SECTIONS;

export const isMainSection = (value: unknown): value is ComplexMainSection =>
  typeof value === "string" && Object.hasOwn(MAIN_SECTIONS, value);

const ALL_FIELDS = Object.values(MAIN_SECTIONS).flat() as (keyof ComplexMainFields)[];

/**
 * «Сохранить»: значения для базы или ошибки по полям (введённое возвращается в форму). section —
 * только поля этой вкладки; без него — вся форма (служебный стенд, тесты).
 */
export function parseComplexMain(formData: FormData, section?: ComplexMainSection): ComplexMainParse {
  const fields = readFields(formData);
  const keys: readonly string[] = section ? MAIN_SECTIONS[section] : ALL_FIELDS;
  const parsed = Object.entries(parseValues(fields)).filter(([key]) => keys.includes(key));
  const fieldErrors = Object.fromEntries(
    parsed.flatMap(([key, result]) => (result.issue ? [[key, result.issue]] : [])),
  ) as ComplexMainErrors;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fields, fieldErrors };
  const value = Object.fromEntries(
    parsed.map(([key, result]) => [key, result.value]),
  ) as unknown as Partial<ComplexMainInput>;
  return { ok: true, fields, value };
}

/** Точка вне Ферганской области — подсказка (обычно перепутаны числа), не ошибка. */
export const pointOutsideRegion = (point: GeoPoint | null | undefined) =>
  Boolean(point && !isInFerganaRegion(point));

type ColumnsOf = { [K in keyof ComplexMainInput]-?: (value: ComplexMainInput[K]) => Record<string, unknown> };

const COLUMNS: ColumnsOf = {
  name: (name) => ({ name }),
  developerId: (developer_id) => ({ developer_id }),
  class: (value) => ({ class: value }),
  houseType: (house_type) => ({ house_type }),
  ceilingHeight: (ceiling_height) => ({ ceiling_height }),
  parking: (parking) => ({ parking }),
  shortDescription: (short_description) => ({ short_description }),
  locationId: (location_id) => ({ location_id }),
  address: (address) => ({ address }),
  landmark: (landmark) => ({ landmark }),
  minutesToCenter: (minutes_to_center) => ({ minutes_to_center }),
  point: (point) => ({ lat: point?.lat ?? null, lng: point?.lng ?? null }),
  nearby: (nearby) => ({ nearby: nearby.map(nearbyRecord) }),
  staffVisitedAt: (staff_visited_at) => ({ staff_visited_at }),
};

/** Строка для update complexes — только разобранные поля. */
export function complexMainRow(input: Partial<ComplexMainInput>): Record<string, unknown> {
  return Object.assign(
    {},
    ...Object.entries(input).map(([key, value]) =>
      (COLUMNS[key as keyof ComplexMainInput] as (value: unknown) => Record<string, unknown>)(value),
    ),
  );
}
