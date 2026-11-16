import type { NearbyKind, NearbyPlace } from "./nearby";

// «Расположение» (Ф5): ссылки Яндекс Карт по точке ЖК — без ключа API и без скриптов Яндекса на
// странице. Интерактивная карта — виджет Яндекса во фрейме, только по нажатию; картинка до нажатия —
// Static API, если задан ключ заказчика (NEXT_PUBLIC_YANDEX_MAPS_KEY), иначе — своя заглушка.

export type GeoPoint = { lat: number; lng: number };
export type MapLocale = "ru" | "uz";

const MAPS = "https://yandex.uz/maps/";
const ZOOM = 16;
const LANG: Record<MapLocale, string> = { ru: "ru_RU", uz: "uz_UZ" };

/** «71.7843,40.3842» — у Яндекса долгота первой. */
const lngLat = ({ lat, lng }: GeoPoint) => `${lng},${lat}`;

/** Открыть точку ЖК в Яндекс Картах (метка «pm2rdm» — красная). */
export function mapLink(point: GeoPoint): string {
  const params = new URLSearchParams({ ll: lngLat(point), z: "17", pt: `${lngLat(point)},pm2rdm` });
  return `${MAPS}?${params}`;
}

/** «Проложить маршрут»: от места, где сейчас клиент, до ЖК на машине. */
export function routeLink(point: GeoPoint): string {
  const params = new URLSearchParams({ rtext: `~${point.lat},${point.lng}`, rtt: "auto" });
  return `${MAPS}?${params}`;
}

/** «Школы», «Остановки» — поиск мест этого вида вокруг ЖК в Яндекс Картах. */
export function searchLink(point: GeoPoint, query: string): string {
  const params = new URLSearchParams({ ll: lngLat(point), z: String(ZOOM), text: query });
  return `${MAPS}?${params}`;
}

/**
 * Статичная карта ЖК (правки 15.11, п. 17: «карта видна сразу, без кнопки»): с ключом Static API
 * заказчика — v1, без ключа — бесплатный 1.x (ключ не нужен, до 650×450). Метку ставит сайт поверх
 * картинки — своей у Яндекса нет, чтобы не было двух меток.
 */
export function staticMapSrc(point: GeoPoint, locale: MapLocale, apiKey: string | undefined): string {
  const params = new URLSearchParams({ ll: lngLat(point), z: String(ZOOM), size: "650,450", lang: LANG[locale] });
  if (apiKey) return `https://static-maps.yandex.ru/v1?${params}&${new URLSearchParams({ apikey: apiKey })}`;
  params.set("l", "map");
  return `https://static-maps.yandex.ru/1.x/?${params}`;
}

export type Distance = { unit: "m"; value: number } | { unit: "km"; value: number };

/** До километра — метрами (как ввёл руководитель), дальше — километрами с одним знаком. */
export function distanceOf(meters: number): Distance {
  return meters < 1000 ? { unit: "m", value: meters } : { unit: "km", value: Math.round(meters / 100) / 10 };
}

/** Виды мест для чипов поиска (мокап .omap__chips): кафе — без списка руководителя тоже. */
export const SEARCH_KINDS = ["school", "kindergarten", "mosque", "clinic", "shop", "cafe", "stop"] as const satisfies readonly NearbyKind[];

/** Ближайшая школа — к ориентиру (мокап: «напротив парка · Школа №46 — 270 м»). */
export function nearestSchool(places: readonly NearbyPlace[]): NearbyPlace | null {
  const schools = places.filter((place) => place.kind === "school" && place.meters !== null);
  return schools.sort((a, b) => (a.meters ?? 0) - (b.meters ?? 0))[0] ?? null;
}
