import { describe, expect, it, vi } from "vitest";
import type { ComplexPage } from "./model";
import { complexSections } from "./sections";

// Таблица наличия и планировки считаются своими модулями — здесь только выбор разделов.
vi.mock("./stock", () => ({ stockRows: () => [{ rooms: 1 }] }));
vi.mock("./layouts", () => ({ layoutCards: () => [] }));

// Правки 15.11, п. 19 (20.11): выбор блок → этаж → квартира — на месте таблицы «Наличие».
const page = (picker: { state: "open" | "layouts" | "soon" }[] | null, patch: Record<string, unknown> = {}) =>
  ({
    state: "open",
    blocks: [{}],
    picker: picker === null ? null : { blocks: picker.map((block, index) => ({ id: String(index), contour: [], state: block.state })) },
    address: null,
    point: null,
    landmark: null,
    nearby: [],
    layouts: [],
    progress: [],
    videos: [],
    details: [],
    documents: [],
    faq: [],
    shortDescription: null,
    ...patch,
  }) as unknown as ComplexPage;

describe("разделы страницы ЖК: выбор квартиры вместо «Наличия»", () => {
  it("на фасаде есть блок с квартирами — «Наличия» нет, «Выбрать квартиру» есть", () => {
    const keys = complexSections(page([{ state: "open" }, { state: "soon" }]));
    expect(keys).toContain("pick");
    expect(keys).not.toContain("stock");
  });

  it("выбора нет или на фасаде только планировки — таблица «Наличие» остаётся", () => {
    expect(complexSections(page(null))).not.toContain("pick");
    const layoutsOnly = complexSections(page([{ state: "layouts" }]));
    expect(layoutsOnly).toContain("pick");
    expect(layoutsOnly.indexOf("pick")).toBeLessThan(layoutsOnly.indexOf("stock"));
  });
});

describe("«Детали проекта»: описание и видео над каруселью (правки 15.11, п. 22)", () => {
  it("раздел есть и с одним описанием или одним видео; своего раздела видео нет", () => {
    expect(complexSections(page(null))).not.toContain("details");
    expect(complexSections(page(null, { shortDescription: { ru: "Коротко", uz: "Qisqa" } }))).toContain("details");
    expect(complexSections(page(null, { videos: [{ youtubeId: "abc", title: null }] }))).toContain("details");
    expect(complexSections(page(null, { videos: [{ youtubeId: "abc", title: null }] }))).not.toContain("video");
  });
});
