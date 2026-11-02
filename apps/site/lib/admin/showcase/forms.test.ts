import { describe, expect, it } from "vitest";
import { adFieldsOf, parseAd } from "./adForm";
import { collectionFieldsOf, parseCollection } from "./collectionForm";
import { defaultPeriod, periodIssues, readComplexIds, readSort } from "./forms";
import { filterShowcaseRows, showcaseCounts } from "./list";
import { parseSpecial, specialFieldsOf } from "./specialForm";
import type { ShowcaseListRow } from "./types";

const DEVELOPER = "00000000-0000-4000-8000-0000000000d1";
const COMPLEX = "00000000-0000-4000-8000-0000000000c1";

const form = (entries: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
};

const specialForm = (overrides: Record<string, string | string[]> = {}) =>
  form({
    developerId: DEVELOPER,
    kind: "gift",
    "badge.ru": "Подарок",
    "badge.uz": "Sovg‘a",
    "title.ru": "Кухня в подарок",
    "title.uz": "Oshxona sovg‘a",
    "text.ru": "",
    "text.uz": "",
    complexIds: [COMPLEX],
    validFrom: "2026-11-01",
    validTo: "2026-11-30",
    isActive: "on",
    sort: "10",
    ...overrides,
  });

describe("форма спецпредложения", () => {
  it("правильная форма — значения для базы, пустой текст — null", () => {
    const parsed = parseSpecial(specialForm());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual({
      developerId: DEVELOPER,
      kind: "gift",
      badge: { ru: "Подарок", uz: "Sovg‘a" },
      title: { ru: "Кухня в подарок", uz: "Oshxona sovg‘a" },
      text: null,
      complexIds: [COMPLEX],
      validFrom: "2026-11-01",
      validTo: "2026-11-30",
      isActive: true,
      sort: 10,
    });
  });

  it("«скидка» и контакты не проходят, половина перевода — тоже; без ЖК — noComplexes", () => {
    const parsed = parseSpecial(
      specialForm({
        "title.ru": "Скидка 15% при 100% оплате",
        "title.uz": "100% to‘lovda 15% chegirma",
        "text.ru": "Звоните +998 90 123 45 67",
        "text.uz": "Qo‘ng‘iroq qiling +998 90 123 45 67",
        "badge.uz": "",
        complexIds: [],
        kind: "discount",
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({
      kind: "kindInvalid",
      badge: "missingUz",
      title: "discount",
      text: "contacts",
      complexIds: "noComplexes",
    });
    // Введённое возвращается в форму как есть.
    expect(parsed.fields.title.ru).toBe("Скидка 15% при 100% оплате");
  });

  it("период: конец раньше начала, несуществующая дата, пустая дата", () => {
    expect(periodIssues({ validFrom: "2026-11-10", validTo: "2026-11-01" })).toEqual({ validTo: "periodOrder" });
    expect(periodIssues({ validFrom: "2026-02-30", validTo: "" })).toEqual({ validFrom: "dateInvalid", validTo: "required" });
    expect(periodIssues({ validFrom: "2026-11-01", validTo: "2026-11-01" })).toEqual({});
  });

  it("новая запись: период на месяц от сегодня по Ташкенту", () => {
    expect(defaultPeriod(new Date("2026-10-28T12:00:00Z"))).toEqual({ validFrom: "2026-10-28", validTo: "2026-11-27" });
    expect(specialFieldsOf(null).kind).toBe("gift");
  });

  it("ЖК — только uuid без повторов, не больше предела; порядок — целое 0…999", () => {
    expect(readComplexIds(form({ complexIds: [COMPLEX, COMPLEX.toUpperCase(), "нет", "x"] }), 20)).toEqual([COMPLEX]);
    expect(readSort(form({ sort: "7" })).parsed).toEqual({ value: 7, issue: null });
    expect(readSort(form({ sort: "" })).parsed).toEqual({ value: 0, issue: null });
    expect(readSort(form({ sort: "1.5" })).parsed.issue).toBe("notWholeNumber");
    expect(readSort(form({ sort: "1000" })).parsed.issue).toBe("outOfRange");
  });
});

describe("форма подборки", () => {
  it("по фильтру — нужно хотя бы одно условие; вручную — хотя бы один ЖК; второй способ не хранится", () => {
    const base = { "title.ru": "Сданные дома", "title.uz": "Topshirilgan uylar" };
    const empty = parseCollection(form({ ...base, mode: "filter" }));
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.fieldErrors).toEqual({ filter: "noFilter" });
    const manual = parseCollection(form({ ...base, mode: "manual", "filter.srok": "built" }));
    expect(manual.ok).toBe(false);
    if (!manual.ok) expect(manual.fieldErrors).toEqual({ complexIds: "noComplexes" });
    const ok = parseCollection(form({ ...base, mode: "filter", "filter.srok": "built", complexIds: [COMPLEX] }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toMatchObject({ mode: "filter", filter: { srok: "built" }, complexIds: [] });
    expect(collectionFieldsOf(null).mode).toBe("filter");
  });
});

describe("форма рекламы", () => {
  it("цель — ЖК застройщика или фильтр; запись с ЖК открывается на «ЖК»", () => {
    const base = {
      developerId: DEVELOPER,
      "title.ru": "Готовые 2-комнатные",
      "title.uz": "Tayyor 2 xonali",
      validFrom: "2026-11-01",
      validTo: "2026-11-20",
    };
    const noTarget = parseAd(form({ ...base, target: "filter" }));
    expect(noTarget.ok).toBe(false);
    if (!noTarget.ok) expect(noTarget.fieldErrors).toEqual({ filter: "noFilter" });
    const ok = parseAd(form({ ...base, target: "filter", "filter.komnat": "2", "filter.srok": "built" }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toMatchObject({ complexIds: [], filter: { komnat: "2", srok: "built" }, isActive: false, sort: 0 });
    expect(
      adFieldsOf({
        id: "a",
        developerId: DEVELOPER,
        title: { ru: "x", uz: "y" },
        text: null,
        complexIds: [COMPLEX],
        filter: {},
        validFrom: "2026-11-01",
        validTo: "2026-11-20",
        isActive: true,
        sort: 1,
      }).target,
    ).toBe("complexes");
  });
});

describe("списки витрины", () => {
  const row = (id: string, sort: number, isActive: boolean, validTo: string | null): ShowcaseListRow => ({
    id,
    kind: "special",
    title: id,
    developerName: null,
    complexCount: 1,
    byFilter: false,
    validFrom: validTo ? "2026-10-01" : null,
    validTo,
    isActive,
    sort,
    createdAt: `2026-10-0${id}`,
    coverPath: null,
  });

  it("«На сайте» — только действующие; порядок — sort, затем дата добавления", () => {
    const rows = [row("3", 20, true, "2026-10-05"), row("2", 10, true, "2026-12-01"), row("1", 10, false, null)];
    expect(filterShowcaseRows(rows, "all", "2026-10-28").map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(filterShowcaseRows(rows, "active", "2026-10-28").map((r) => r.id)).toEqual(["2"]);
    expect(showcaseCounts(rows, "2026-10-28")).toEqual({ active: 1, all: 3 });
  });
});
