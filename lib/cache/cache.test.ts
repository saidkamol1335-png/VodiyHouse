import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateTag, revalidateTag } = vi.hoisted(() => ({
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({ updateTag, revalidateTag }));

const {
  complexIdFrom,
  expireComplex,
  expireDeveloper,
  expireDictionaries,
  markComplexStale,
  markDeveloperStale,
} = await import(".");

describe("теги кэша сайта", () => {
  beforeEach(() => {
    updateTag.mockClear();
    revalidateTag.mockClear();
  });

  it("ЖК поменялся — его страница и каталог сразу", () => {
    expireComplex("c1");
    expect(updateTag.mock.calls).toEqual([["complex:c1"], ["complexes"]]);
  });

  it("застройщик — его страница, список застройщиков и каталог (видимость его ЖК)", () => {
    expireDeveloper("d1");
    expect(updateTag.mock.calls).toEqual([["developer:d1"], ["developers"], ["complexes"]]);
  });

  it("менять было нечего (complex_id: null) — кэш не трогаем", () => {
    expireComplex(null);
    expireComplex(complexIdFrom({ complex_id: null, changed: 0 }));
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("точка фокуса — мягко, без перерисовки кабинета; каталог и список — тоже", () => {
    markComplexStale("c1");
    markDeveloperStale("d1");
    expect(revalidateTag.mock.calls).toEqual([
      ["complex:c1", "max"],
      ["complexes", "max"],
      ["developer:d1", "max"],
      ["developers", "max"],
    ]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("справочник — свой тег (страницы ЖК и каталог подписаны на него)", () => {
    expireDictionaries();
    expect(updateTag.mock.calls).toEqual([["dictionaries"]]);
  });

  it("id ЖК — из ответа функции базы", () => {
    expect(complexIdFrom({ complex_id: "c1", changed: 2 })).toBe("c1");
    expect(complexIdFrom("c1")).toBeNull();
    expect(complexIdFrom(null)).toBeNull();
  });
});

// Новое действие, которое меняет видимое на сайте, не должно забыть сбросить кэш. Без тега —
// только черновики (сайт их не видит), чертёж до сохранения планировок и «Внутреннее».
const ACTIONS_DIR = path.join("lib", "admin", "actions");
const CONTENT_FILES = [
  "complexes.ts",
  "complexContent.ts",
  "complexMedia.ts",
  "contacts.ts",
  "developers.ts",
  "developerMedia.ts",
  "dictionaries.ts",
  "hints.ts",
  "programs.ts",
  "units.ts",
  "unitsMass.ts",
  "unitsStatus.ts",
];
// Без контента сайта: вход, сотрудники, снимки расчётов, чтение журнала и списка квартир.
const NO_CONTENT_FILES = [
  "auth.ts",
  "calculations.ts",
  "journal.ts",
  "siteStock.ts",
  "staff.ts",
  "unitsList.ts",
];
const WITHOUT_TAG = new Set([
  "createComplexAction",
  "createDeveloperAction",
  "attachComplexDrawingAction",
  "saveDeveloperPrivateAction",
]);
const EXPIRES =
  /\b(expireComplex|expireDeveloper|expireDictionaries|expirePrograms|expireSiteSettings|markComplexStale|markDeveloperStale)\(/;

describe("действия контента сбрасывают кэш сайта", () => {
  const all = readdirSync(ACTIONS_DIR).filter(
    (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
  );
  const files = all.filter((file) => CONTENT_FILES.includes(file));

  // Новый файл действий без разбора валит тест: иначе его действия проверку бы не проходили.
  it("каждый файл действий разобран: контент сайта или явно без него", () => {
    expect(all.filter((file) => !NO_CONTENT_FILES.includes(file)).sort()).toEqual(
      [...CONTENT_FILES].sort(),
    );
  });

  it.each(files)("%s", (file) => {
    const source = readFileSync(path.join(ACTIONS_DIR, file), "utf8").replace(/\r\n/g, "\n");
    const actions = [
      ...source.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n([\s\S]*?)\n\}/g),
    ];
    expect(actions.length).toBeGreaterThan(0);
    for (const [, name, body] of actions) {
      if (WITHOUT_TAG.has(name!)) continue;
      expect(body, name).toMatch(EXPIRES);
    }
  });
});
