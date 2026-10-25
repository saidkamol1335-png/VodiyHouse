import { bilingualFrom, type BilingualValue } from "../bilingual";
import type { PublicationStatus } from "../publication";
import { isPublicationStatus } from "../publicationFilter";
import { nearbyFrom, type NearbyPlace } from "@/lib/site/complex/nearby";

// ЖК страницы кабинета: поля вкладки «Основное» и статус. Наборы значений — как enum в базе
// (миграция 20261019170000; подписи — messages admin.complexes.values).

export const COMPLEX_CLASSES = ["econom", "comfort", "business", "premium"] as const;
export const HOUSE_TYPES = ["monolith", "brick", "frame"] as const;
export const PARKING_TYPES = ["underground", "ground", "mixed"] as const;

export type ComplexClass = (typeof COMPLEX_CLASSES)[number];
export type HouseType = (typeof HOUSE_TYPES)[number];
export type ParkingType = (typeof PARKING_TYPES)[number];

export type ComplexRecord = {
  id: string;
  slug: string;
  name: BilingualValue;
  status: PublicationStatus;
  archivedAt: string | null;
  developerId: string;
  developerName: string;
  developerStatus: PublicationStatus;
  shortDescription: BilingualValue | null;
  class: ComplexClass | null;
  houseType: HouseType | null;
  ceilingHeight: number | null;
  parking: ParkingType | null;
  locationId: number | null;
  address: BilingualValue | null;
  landmark: BilingualValue | null;
  minutesToCenter: number | null;
  lat: number | null;
  lng: number | null;
  nearby: NearbyPlace[];
  staffVisitedAt: string | null;
};

export const COMPLEX_COLUMNS =
  "id, slug, name, status, archived_at, developer_id, short_description, class, house_type, ceiling_height, parking, location_id, address, landmark, minutes_to_center, lat, lng, nearby, staff_visited_at, developers (name, status)";

export type ComplexDbRow = {
  id: string;
  slug: string;
  name: unknown;
  status: string;
  archived_at: string | null;
  developer_id: string;
  short_description: unknown;
  class: string | null;
  house_type: string | null;
  ceiling_height: number | string | null;
  parking: string | null;
  location_id: number | null;
  address: unknown;
  landmark: unknown;
  minutes_to_center: number | null;
  lat: number | string | null;
  lng: number | string | null;
  nearby: unknown;
  staff_visited_at: string | null;
  developers: { name: string; status: string } | null;
};

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | null =>
  value !== null && (values as readonly string[]).includes(value) ? (value as T) : null;

// numeric из PostgREST приходит строкой.
const numberOrNull = (value: number | string | null) => (value === null ? null : Number(value));

const bilingualOrNull = (raw: unknown) => (raw ? bilingualFrom(raw) : null);

const statusOf = (value: string | undefined): PublicationStatus =>
  value && isPublicationStatus(value) ? value : "draft";

export function complexFrom(row: ComplexDbRow): ComplexRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: bilingualFrom(row.name),
    status: statusOf(row.status),
    archivedAt: row.archived_at,
    developerId: row.developer_id,
    developerName: row.developers?.name ?? "",
    developerStatus: statusOf(row.developers?.status),
    shortDescription: bilingualOrNull(row.short_description),
    class: oneOf(COMPLEX_CLASSES, row.class),
    houseType: oneOf(HOUSE_TYPES, row.house_type),
    ceilingHeight: numberOrNull(row.ceiling_height),
    parking: oneOf(PARKING_TYPES, row.parking),
    locationId: row.location_id,
    address: bilingualOrNull(row.address),
    landmark: bilingualOrNull(row.landmark),
    minutesToCenter: row.minutes_to_center,
    lat: numberOrNull(row.lat),
    lng: numberOrNull(row.lng),
    nearby: nearbyFrom(row.nearby),
    staffVisitedAt: row.staff_visited_at,
  };
}
