import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import messages from "@/messages/ru.json";
import { isInFerganaRegion, parseCoordinates, yandexMapsUrl } from "@/lib/geo";
import { COMPLEX_LIMITS, parseComplexMain } from "./mainForm";
import {
  COMPLEX_REQUIREMENTS,
  PUBLISH_RULES,
  parseReadiness,
  photosShort,
  requirementsFromDetail,
  tabsNeedingAttention,
} from "./readiness";

const migration = (file: string) =>
  readFileSync(path.resolve(import.meta.dirname, "../../../supabase/migrations", file), "utf8");
const ADMIN_MIGRATION = migration("20261021090000_complexes_admin.sql");
const SCHEMA_MIGRATION = migration("20261019170000_developers_complexes_media.sql");

describe("точка на карте (И2)", () => {
  it("текст «широта, долгота» и ссылки Яндекса (долгота первой) и Google", () => {
    const fergana = { lat: 40.3864, lng: 71.7864 };
    expect(parseCoordinates("40.3864, 71.7864")).toEqual(fergana);
    expect(parseCoordinates(" 40.3864 71.7864 ")).toEqual(fergana);
    expect(parseCoordinates("https://yandex.uz/maps/?ll=71.7864%2C40.3864&z=16")).toEqual(fergana);
    expect(parseCoordinates("https://yandex.ru/maps/?pt=71.7864,40.3864&z=17&l=map")).toEqual(
      fergana,
    );
    // «Что здесь?»: ll (центр окна) стоит раньше отмеченной точки — берём точку.
    expect(
      parseCoordinates(
        "https://yandex.uz/maps/?ll=71.7846%2C40.3890&mode=whatshere&whatshere%5Bpoint%5D=71.7864%2C40.3864&z=17",
      ),
    ).toEqual(fergana);
    expect(
      parseCoordinates("https://yandex.uz/maps/?ll=71.7846%2C40.3890&pt=71.7864%2C40.3864&z=17"),
    ).toEqual(fergana);
    expect(parseCoordinates("https://www.google.com/maps/place/x/@40.3864,71.7864,17z")).toEqual(
      fergana,
    );
    expect(
      parseCoordinates(
        "https://www.google.com/maps/place/x/@40.1,71.1,17z/data=!3d40.3864!4d71.7864",
      ),
    ).toEqual(fergana);
    expect(parseCoordinates("https://maps.google.com/?q=40.3864,71.7864")).toEqual(fergana);
  });

  it("короткая ссылка, мусор и числа вне диапазона — не точка; вне области — подсказка", () => {
    expect(parseCoordinates("https://yandex.uz/maps/-/CDqZaB2c")).toBeNull();
    expect(parseCoordinates("рядом с парком")).toBeNull();
    expect(parseCoordinates("140.1, 71.7")).toBeNull();
    expect(isInFerganaRegion({ lat: 40.3864, lng: 71.7864 })).toBe(true);
    // Перепутанные местами: 71° с. ш. — далеко за Ферганой.
    expect(isInFerganaRegion({ lat: 71.7864, lng: 40.3864 })).toBe(false);
    expect(yandexMapsUrl({ lat: 40.3864, lng: 71.7864 })).toContain("pt=71.7864,40.3864");
  });
});

describe("готовность к публикации (И7, И9)", () => {
  it("пункты и цифры — как в базе", () => {
    for (const requirement of COMPLEX_REQUIREMENTS) {
      expect(ADMIN_MIGRATION).toContain(`'${requirement}'`);
    }
    expect(ADMIN_MIGRATION).toContain(`photo_count >= ${PUBLISH_RULES.minPhotos}`);
    expect(ADMIN_MIGRATION).toContain(`cover_side >= ${PUBLISH_RULES.coverMinLongSide}`);
  });

  it("порядок вкладок, точки на вкладках, «нужно ещё N», пункты из отказа базы", () => {
    const items = parseReadiness([
      { requirement: "photos", ok: false, have: 3 },
      { requirement: "address", ok: true, have: null },
      { requirement: "point", ok: false, have: null },
      { requirement: "unknown", ok: false, have: null },
    ]);
    expect(items.map((item) => item.requirement)).toEqual(["address", "point", "photos"]);
    expect([...tabsNeedingAttention(items)]).toEqual(["main", "photos"]);
    expect(photosShort(items)).toBe(2);
    expect(requirementsFromDetail("address, point,nope")).toEqual(["address", "point"]);
    expect(requirementsFromDetail(null)).toEqual([]);
  });
});

describe("вкладка «Основное» (И1–И3)", () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    const base: Record<string, string> = {
      "name.ru": "Shodlik",
      "name.uz": "Shodlik",
      developerId: "00000000-0000-4000-8000-0000000000d1",
    };
    for (const [name, value] of Object.entries({ ...base, ...fields })) data.append(name, value);
    return data;
  };

  it("лимиты — как check в миграциях", () => {
    expect(SCHEMA_MIGRATION).toContain(`<= ${COMPLEX_LIMITS.shortDescriptionMax}`);
    expect(SCHEMA_MIGRATION).toContain(`between 0 and ${COMPLEX_LIMITS.minutesMax}`);
    expect(SCHEMA_MIGRATION).toContain(
      `between ${COMPLEX_LIMITS.ceilingMin} and ${COMPLEX_LIMITS.ceilingMax}`,
    );
    expect(ADMIN_MIGRATION).toContain(`length(address ->> 'ru') <= ${COMPLEX_LIMITS.addressMax}`);
    expect(ADMIN_MIGRATION).toContain(`length(landmark ->> 'ru') <= ${COMPLEX_LIMITS.landmarkMax}`);
  });

  it("потолки с запятой, точка из ссылки, пустое — null", () => {
    const parsed = parseComplexMain(
      form({
        ceilingHeight: "3,1",
        point: "https://yandex.uz/maps/?pt=71.7864,40.3864",
        class: "comfort",
        locationId: "1",
      }),
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        ceilingHeight: 3.1,
        point: { lat: 40.3864, lng: 71.7864 },
        class: "comfort",
        locationId: 1,
        parking: null,
        address: null,
      },
      fields: { ceilingHeight: "3,1" },
    });
  });

  it("контакты в тексте, кривая точка, чужой класс и потолки 7 м — ошибки по полям", () => {
    const parsed = parseComplexMain(
      form({
        "landmark.ru": "звоните +998 90 123 45 67",
        "landmark.uz": "qo‘ng‘iroq qiling",
        point: "рядом с парком",
        class: "luxury",
        ceilingHeight: "7",
        staffVisitedAt: "2026-02-31",
      }),
    );
    expect(parsed).toMatchObject({
      ok: false,
      fieldErrors: {
        landmark: "contacts",
        point: "pointInvalid",
        class: "choiceInvalid",
        ceilingHeight: "outOfRange",
        staffVisitedAt: "dateInvalid",
      },
    });
  });
});

describe("тексты капсулы статуса", () => {
  it("у ЖК те же ключи, что у застройщика, и подпись на каждый пункт готовности", () => {
    const keys = (value: object) => Object.keys(value).sort();
    const developer = messages.admin.developers.status;
    const complex = messages.admin.complexes.status;
    expect(keys(complex)).toEqual(keys(developer));
    expect(keys(complex.missing)).toEqual([...COMPLEX_REQUIREMENTS].sort());
    expect(keys(messages.admin.complexes.readiness.items)).toEqual(
      [...COMPLEX_REQUIREMENTS].sort(),
    );
  });
});
