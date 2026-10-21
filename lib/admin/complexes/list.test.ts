import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { containsContact } from "../contactGuard";
import { COMPLEX_NAME_MAX, normalizeComplexName, parseComplexCreate } from "./create";
import { DEMO_COMPLEX_ROWS } from "./demo";
import {
  complexFilterCounts,
  complexListScope,
  filterComplexes,
  isHiddenByDeveloper,
} from "./list";
import { roomGroupOf, stockByComplex, stockTone, type RoomAvailabilityRecord } from "./stock";
import { toUzbekLatin } from "@/lib/translit";

const MIGRATION = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../../supabase/migrations/20261019170000_developers_complexes_media.sql",
  ),
  "utf8",
);

const room = (
  complexId: string,
  rooms: number,
  free: number | null,
  available = true,
): RoomAvailabilityRecord => ({ complex_id: complexId, rooms, free_count: free, available });

describe("остатки по комнатам", () => {
  it("группы мокапа: студия, 1–3, «4+» складывает 4 и 5 комнат и валюты", () => {
    expect([0, 1, 2, 3, 4, 7].map(roomGroupOf)).toEqual([
      "studio",
      "1",
      "2",
      "3",
      "4plus",
      "4plus",
    ]);
    const stock = stockByComplex([
      room("a", 1, 10),
      room("a", 4, 2),
      room("a", 5, 1),
      room("a", 4, 3),
      room("a", 2, 0),
    ]).get("a")!;
    expect(stock.groups).toEqual([
      { group: "1", free: 10 },
      { group: "4plus", free: 6 },
    ]);
    expect(stock).toMatchObject({ free: 16, partial: false });
  });

  it("блок без списка квартир: тип без числа, сумма — по известным; недоступный — как ноль", () => {
    const stock = stockByComplex([
      room("b", 1, null),
      room("b", 2, 5),
      room("b", 3, null, false),
    ]).get("b")!;
    expect(stock.groups).toEqual([
      { group: "1", free: null },
      { group: "2", free: 5 },
    ]);
    expect(stock).toMatchObject({ free: 5, partial: true });
    expect(stockTone(stock)).toBe("ok");
  });

  it("цвет пилюли как в мокапе: 0 — нет, до 10 — янтарь, больше — зелёный", () => {
    const tone = (free: number) =>
      stockTone({ groups: [{ group: "1", free }], free, partial: false });
    expect([tone(0), tone(6), tone(10), tone(11)]).toEqual(["none", "low", "low", "ok"]);
  });
});

describe("список ЖК", () => {
  it("«Все» без архива; поиск по UZ-названию, городу и застройщику без апострофов", () => {
    const all = filterComplexes(DEMO_COMPLEX_ROWS, { query: "", filter: "all" });
    expect(all.map((row) => row.name.ru)).not.toContain("Lola");
    const find = (query: string) =>
      filterComplexes(DEMO_COMPLEX_ROWS, { query, filter: "all" }).map((row) => row.name.ru);
    expect(find("коканд")).toEqual(["Gulzor"]);
    expect(find("margilon")).toEqual(["Namuna", "Yulduz"]);
    expect(find("NAVRO‘Z")).toEqual(["Gulzor", "Bahor"]);
  });

  it("ЖК застройщика: строки и счётчики пилюль — только его", () => {
    const developerId = DEMO_COMPLEX_ROWS[1]!.developerId;
    const rows = filterComplexes(DEMO_COMPLEX_ROWS, { query: "", filter: "all", developerId });
    expect(rows.map((row) => row.name.ru)).toEqual(["Namuna", "Yulduz"]);
    expect(complexFilterCounts(DEMO_COMPLEX_ROWS, developerId)).toMatchObject({
      all: 2,
      archived: 0,
    });
    expect(complexFilterCounts(DEMO_COMPLEX_ROWS)).toMatchObject({ all: 6, draft: 1, archived: 1 });
  });

  it("«ЖК застройщика →» у застройщика в архиве: имя из его ЖК, список — на «Архиве»", () => {
    const [row] = DEMO_COMPLEX_ROWS;
    const options = [{ id: row!.developerId, name: row!.developerName }];
    expect(complexListScope(row!.developerId, options, DEMO_COMPLEX_ROWS)).toEqual({
      developer: options[0],
      archived: false,
    });
    expect(complexListScope(row!.developerId, [], DEMO_COMPLEX_ROWS)).toEqual({
      developer: { id: row!.developerId, name: row!.developerName },
      archived: true,
    });
    for (const scopeId of [undefined, ["a", "b"], "00000000-0000-4000-8000-000000000000"])
      expect(complexListScope(scopeId, options, DEMO_COMPLEX_ROWS)).toEqual({
        developer: null,
        archived: false,
      });
  });

  it("опубликованный ЖК у неопубликованного застройщика на сайте не виден", () => {
    const bahor = DEMO_COMPLEX_ROWS.find((row) => row.name.ru === "Bahor")!;
    expect(isHiddenByDeveloper(bahor)).toBe(true);
    expect(isHiddenByDeveloper(DEMO_COMPLEX_ROWS[0]!)).toBe(false);
  });
});

describe("«+ Добавить ЖК»", () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.append(name, value);
    return data;
  };
  const developerId = "00000000-0000-4000-8000-0000000000d1";

  it("лимит названия — как check в миграции complexes", () => {
    expect(MIGRATION).toContain(`length(name ->> 'ru') <= ${COMPLEX_NAME_MAX}`);
  });

  it("без застройщика и без UZ — ошибки по полям; «ЖК» в начале убирается", () => {
    const parsed = parseComplexCreate(form({ "name.ru": "ЖК  Шодлик", "name.uz": "" }));
    expect(parsed).toMatchObject({
      ok: false,
      fieldErrors: { developerId: "developerRequired", name: "missingUz" },
      fields: { name: { ru: "Шодлик", uz: "" } },
    });
    expect(normalizeComplexName("jk Orzu")).toBe("Orzu");
    const ok = parseComplexCreate(
      form({ developerId, "name.ru": "Shodlik", "name.uz": "Shodlik" }),
    );
    expect(ok).toMatchObject({
      ok: true,
      value: { developerId, name: { ru: "Shodlik", uz: "Shodlik" } },
    });
  });

  it("UZ-подсказка: кириллица → узбекская латиница с заглавными, латиница — как есть", () => {
    expect(toUzbekLatin("Шодлик")).toBe("Shodlik");
    expect(toUzbekLatin("Ёшлик Чорсу")).toBe("Yoshlik Chorsu");
    expect(toUzbekLatin("Ўзбекистон")).toBe("O‘zbekiston");
    expect(toUzbekLatin("ГУЛЗОР")).toBe("GULZOR");
    expect(toUzbekLatin("Farg‘ona Park")).toBe("Farg‘ona Park");
  });
});

describe("правило 1.2 в текстах", () => {
  it("телефон, сайт, @ник и t.me — нельзя; адрес, цена и номер школы — можно", () => {
    for (const text of [
      "звоните +998 90 123-45-67",
      "901234567",
      "www.sifat.uz",
      "sifat.uz",
      "https://example.com",
      "t.me/sifat_sales",
      "пишите @sifat_sales",
      "Telegram:@fargona_sifat",
      "«@fargona_sifat»",
      "+998 90 123–45–67",
      "90/123/45/67",
      "+998 901 234 567",
      "fargonasifat.online",
      "info@sifat.uz",
      "от 450 000 000 сум, звоните +998 90 123 45 67",
      "90.123.45.67",
    ]) {
      expect(containsContact(text), text).toBe(true);
    }
    for (const text of [
      "ул. Навои, 45",
      "1 500 000 сум",
      "Школа №46 — 270 м",
      "напротив центрального парка · до центра 7 мин",
      "Farg‘ona Sifat Qurilish",
      "e-mail нет",
      "Квартиры от 450 000 000 сум",
      "Narxi 450 000 000 so‘m dan",
      "Паркинг 150 000 000 сум",
      "Акция 01.10.2026–31.12.2026",
      "Цены от 450 000 000 до 900 000 000 сум",
      "120 000 000–150 000 000 so‘m",
      "450.000.000 so'm",
      "Narxi 450 000 000 sum",
      "Kvartiralar 450000000 so‘m dan",
      "Разрешение № 0123/45-6789",
    ]) {
      expect(containsContact(text), text).toBe(false);
    }
  });
});
