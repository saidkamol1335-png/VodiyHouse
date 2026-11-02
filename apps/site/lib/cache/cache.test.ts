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
