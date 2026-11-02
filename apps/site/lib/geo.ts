// Точка ЖК на карте (решение И2): одно поле «Координаты или ссылка на карту». С телефона проще
// скопировать точку из карточки места и вставить, чем набирать два числа. Понимает «40.3864,
// 71.7864» (так копируют Яндекс и Google) и ссылки Яндекс и Google Карт. У Яндекса в ссылке
// сначала долгота (ll=, pt=), у Google — широта (@, q=, !3d…!4d…).

export type GeoPoint = { lat: number; lng: number };

const DECIMALS = 6;
const NUMBER = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

const LAT_LNG_TEXT = new RegExp(String.raw`^\s*${NUMBER}\s*[,;\s]\s*${NUMBER}\s*$`);
const yandexParam = (name: string) =>
  new RegExp(String.raw`[?&](?:${name})=${NUMBER}(?:,|%2C)${NUMBER}`, "i");
// Метка и «Что здесь?» — сама точка; ll — центр окна карты, он стоит в ссылке раньше и смещён
// на сотни метров. Поэтому порядок — по смыслу, а не по месту в ссылке.
const YANDEX_PARAMS = [
  yandexParam("pt"),
  yandexParam(String.raw`whatshere%5Bpoint%5D|whatshere\[point\]`),
  yandexParam("ll"),
];
const GOOGLE_AT = new RegExp(String.raw`@${NUMBER},${NUMBER}`);
const GOOGLE_QUERY = new RegExp(
  String.raw`[?&](?:q|query|ll|destination)=${NUMBER}(?:,|%2C)\+?${NUMBER}`,
  "i",
);
const GOOGLE_DATA = new RegExp(String.raw`!3d${NUMBER}!4d${NUMBER}`);

// Ферганская область с запасом (ТЗ 1.4): точка снаружи — почти всегда перепутанные числа.
const FERGANA_REGION = { latMin: 39.6, latMax: 41.0, lngMin: 70.3, lngMax: 72.4 };

const round = (value: number) => Number(value.toFixed(DECIMALS));

function point(lat: number, lng: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: round(lat), lng: round(lng) };
}

function fromMatch(match: RegExpExecArray | null, order: "latLng" | "lngLat"): GeoPoint | null {
  if (!match) return null;
  const [first, second] = [Number(match[1]), Number(match[2])];
  return order === "latLng" ? point(first, second) : point(second, first);
}

/** Точка из текста или ссылки; null — не разобрать (короткая ссылка «Поделиться», опечатка). */
export function parseCoordinates(raw: string): GeoPoint | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) return fromMatch(LAT_LNG_TEXT.exec(text), "latLng");
  if (/yandex\./i.test(text)) {
    for (const pattern of YANDEX_PARAMS) {
      const found = fromMatch(pattern.exec(text), "lngLat");
      if (found) return found;
    }
    return null;
  }
  return (
    fromMatch(GOOGLE_DATA.exec(text), "latLng") ??
    fromMatch(GOOGLE_AT.exec(text), "latLng") ??
    fromMatch(GOOGLE_QUERY.exec(text), "latLng")
  );
}

export function isInFerganaRegion({ lat, lng }: GeoPoint): boolean {
  const { latMin, latMax, lngMin, lngMax } = FERGANA_REGION;
  return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
}

/** «40.3864, 71.7864» — так точка стоит в поле и так её копируют карты. */
export function formatCoordinates({ lat, lng }: GeoPoint): string {
  return `${lat}, ${lng}`;
}

/** Проверка точки той же картой, что увидит клиент («Открыть в Яндекс Картах» мокапа). */
export function yandexMapsUrl({ lat, lng }: GeoPoint): string {
  return `https://yandex.uz/maps/?pt=${lng},${lat}&z=17&l=map`;
}
