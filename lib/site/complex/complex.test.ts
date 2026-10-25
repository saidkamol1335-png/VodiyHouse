import { describe, expect, it } from "vitest";
import { layoutsLink, parseLayoutsLink } from "./layoutsLink";
import { distanceOf, mapLink, mapWidgetSrc, nearestSchool, routeLink, staticMapSrc } from "./location";
import { nearbyFrom, nearbyRecord } from "./nearby";

// Страница ЖК (шаг 3.5): пограничные случаи без базы — «Удобство локации», ссылки Яндекс Карт
// (Ф5) и якорь «Планировок» с фильтром. Данные страницы — tests/db/site-complex.test.ts.

const POINT = { lat: 40.3842, lng: 71.7843 };
const school = (meters: number | null, ru = "Школа") => ({ kind: "school", name: { ru, uz: "Maktab" }, meters, minutes: 4 });

describe("«Удобство локации» (Ф5)", () => {
  it("из базы: неверный вид, без названия и без расстояния — пропускаются; пешком — по умолчанию", () => {
    const places = nearbyFrom([
      school(270),
      { kind: "zoo", name: { ru: "Зоопарк", uz: "Zoo" }, meters: 100 },
      { kind: "park", name: { ru: "Парк" }, meters: 100 },
      { kind: "shop", name: { ru: "Магазин", uz: "Do‘kon" } },
      { kind: "stop", name: { ru: "Центр", uz: "Markaz" }, minutes: 7, mode: "car", meters: 0 },
    ]);
    expect(places.map((place) => [place.kind, place.meters, place.minutes, place.mode])).toEqual([
      ["school", 270, 4, "walk"],
      ["stop", null, 7, "car"],
    ]);
    expect(nearbyFrom("не список")).toEqual([]);
  });

  it("для базы — без пустых полей и без «пешком» (null база не примет)", () => {
    expect(nearbyRecord({ kind: "stop", name: { ru: "Центр", uz: "Markaz" }, meters: null, minutes: 7, mode: "car" })).toEqual({
      kind: "stop",
      name: { ru: "Центр", uz: "Markaz" },
      minutes: 7,
      mode: "car",
    });
  });

  it("ближайшая школа — к ориентиру; метры до километра, дальше — км с одним знаком", () => {
    const places = nearbyFrom([school(900, "Школа №5"), school(270, "Школа №46"), school(null, "Без метров")]);
    expect(nearestSchool(places)?.name.ru).toBe("Школа №46");
    expect(distanceOf(950)).toEqual({ unit: "m", value: 950 });
    expect(distanceOf(1250)).toEqual({ unit: "km", value: 1.3 });
  });
});

describe("Яндекс Карты без ключа (Ф5)", () => {
  it("долгота первой; маршрут — до ЖК на машине; виджет — на языке страницы", () => {
    expect(mapLink(POINT)).toBe("https://yandex.uz/maps/?ll=71.7843%2C40.3842&z=17&pt=71.7843%2C40.3842%2Cpm2rdm");
    expect(routeLink(POINT)).toBe("https://yandex.uz/maps/?rtext=%7E40.3842%2C71.7843&rtt=auto");
    expect(mapWidgetSrc(POINT, "uz")).toContain("lang=uz_UZ");
  });

  it("картинка карты — только с ключом заказчика", () => {
    expect(staticMapSrc(POINT, "ru", undefined)).toBeNull();
    expect(staticMapSrc(POINT, "ru", "key-123")).toContain("apikey=key-123");
  });
});

describe("якорь «Планировок» с фильтром", () => {
  it("туда и обратно; чужой якорь — null; студия — 0 комнат", () => {
    const link = layoutsLink({ blockId: "b-1", rooms: 0 });
    expect(link).toBe("#planirovki?blok=b-1&komnat=0");
    expect(parseLayoutsLink(link)).toEqual({ blockId: "b-1", rooms: 0 });
    expect(parseLayoutsLink("#planirovki")).toEqual({ blockId: null, rooms: null });
    expect(parseLayoutsLink("#planirovki?komnat=x")).toEqual({ blockId: null, rooms: null });
    expect(parseLayoutsLink("#dokumenty")).toBeNull();
  });
});
