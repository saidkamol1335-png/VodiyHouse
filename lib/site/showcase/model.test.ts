import { describe, expect, it } from "vitest";
import { NO_FILTER } from "@/lib/site/catalog/filter";
import type { CatalogBlock, CatalogComplex, CatalogOffer, CatalogPhoto, SiteCatalog } from "@/lib/site/catalog/records";
import {
  adView,
  cardBadges,
  collectionBySlug,
  collectionComplexes,
  collectionCount,
  collectionResults,
  complexGift,
  daysLeft,
  searchWithCollection,
  specialView,
  visibleCollections,
  visibleSpecials,
} from "./model";
import type { ShowcaseAd, ShowcaseCollection, ShowcaseSpecial, SiteShowcase } from "./records";

// Витрина на сайте (3.16б): подборки, цифры рекламы и спецпредложений — из одного ответа каталога.

const text = (ru: string) => ({ ru, uz: ru });
const photo = (path: string): CatalogPhoto => ({ path, width: 2400, height: 1600, blur: null, focus: { x: 0.5, y: 0.5 }, alt: null });

const offer = (rooms: number, priceFrom: number | null, free: number | null = 3): CatalogOffer => ({
  rooms,
  available: true,
  free,
  areaFrom: 50,
  priceFrom,
  priceTo: priceFrom,
  pricePerM2From: null,
});

const block = (id: string, patch: Partial<CatalogBlock>): CatalogBlock => ({
  id,
  name: id,
  currency: "USD",
  buildStatus: "building",
  deadline: { year: 2027, quarter: 2 },
  floorsTotal: 12,
  finishing: null,
  offers: [],
  ...patch,
});

const complex = (slug: string, developerId: string, blocks: CatalogBlock[], photos: CatalogPhoto[] = []): CatalogComplex => ({
  id: `id-${slug}`,
  slug,
  name: text(slug),
  class: "comfort",
  sort: 0,
  developerId,
  location: { slug: "fergana", kind: "city", name: text("Фергана") },
  address: null,
  landmark: null,
  minutesToCenter: null,
  checked: { permit: null, land: null, visit: null },
  createdAt: "2026-10-01",
  photos,
  blocks,
});

const sifat = { id: "d1", slug: "sifat", name: "Sifat" };
const kamalak = { id: "d2", slug: "kamalak", name: "Kamalak" };

// a — Sifat, 1-комн. $40 000 (3 свободных) и 2-комн. $60 000 (число свободных неизвестно);
// b — Kamalak, сдан, 2-комн. в сумах; c — Sifat, сдан, 2-комн. $35 000 без фото.
const catalog: SiteCatalog = {
  rate: { usdUzs: 12500, date: "2026-10-25", source: "cbu" },
  developers: [
    { ...sifat, programs: [] },
    { ...kamalak, programs: [] },
  ],
  complexes: [
    complex("a", "d1", [block("a1", { offers: [offer(1, 40000), offer(2, 60000, null)] })], [photo("a.jpg")]),
    complex("b", "d2", [block("b1", { currency: "UZS", buildStatus: "delivered", deadline: null, offers: [offer(2, 750_000_000, 5)] })], [photo("b.jpg")]),
    complex("c", "d1", [block("c1", { buildStatus: "delivered", deadline: null, offers: [offer(2, 35000, 2)] })]),
  ],
};

const collection = (slug: string, patch: Partial<ShowcaseCollection>): ShowcaseCollection => ({
  id: `k-${slug}`,
  slug,
  title: text(slug),
  mode: "filter",
  complexIds: [],
  filter: NO_FILTER,
  cover: null,
  ...patch,
});

const special = (id: string, patch: Partial<ShowcaseSpecial>): ShowcaseSpecial => ({
  id,
  kind: "gift",
  badge: text(`бейдж ${id}`),
  title: text(`условие ${id}`),
  text: null,
  developer: sifat,
  complexIds: ["id-a"],
  validTo: "2026-11-30",
  cover: null,
  ...patch,
});

const ad = (id: string, patch: Partial<ShowcaseAd>): ShowcaseAd => ({
  id,
  title: text(`реклама ${id}`),
  text: null,
  developer: sifat,
  complexIds: [],
  filter: NO_FILTER,
  validTo: "2026-11-30",
  cover: null,
  ...patch,
});

const showcase = (patch: Partial<SiteShowcase>): SiteShowcase => ({ collections: [], specials: [], ads: [], today: "2026-10-28", ...patch });

describe("подборки", () => {
  const built = collection("built", { filter: { ...NO_FILTER, deadline: "built" } });
  const manual = collection("manual", { mode: "manual", complexIds: ["id-c", "id-a", "net-takogo"] });
  const empty = collection("empty", { mode: "manual", complexIds: ["net-takogo"] });

  it("вручную — ЖК по списку в порядке каталога, по фильтру — как в выдаче; пустая не показывается", () => {
    expect(collectionComplexes(catalog, manual).map((c) => c.slug)).toEqual(["a", "c"]);
    expect(collectionComplexes(catalog, built).map((c) => c.slug)).toEqual(["b", "c"]);
    expect(visibleCollections(catalog, showcase({ collections: [built, empty, manual] })).map((c) => c.slug)).toEqual(["built", "manual"]);
  });

  it("«N ЖК · F квартир в продаже»: число свободных по подходящим типам; неизвестное — «не меньше»", () => {
    expect(collectionCount(catalog, built)).toEqual({ complexes: 2, flats: 7, partial: false });
    expect(collectionCount(catalog, manual)).toEqual({ complexes: 2, flats: 5, partial: true });
  });

  it("выдача с подборкой: вручную — только её ЖК внутри фильтра посетителя", () => {
    expect(collectionResults(catalog, manual, { ...NO_FILTER, rooms: [1] }).map((c) => c.slug)).toEqual(["a"]);
    expect(collectionResults(catalog, built, { ...NO_FILTER, deadline: "built", sort: "cheap" }).map((c) => c.slug)).toEqual(["c", "b"]);
  });

  it("адрес: ?podborka=slug первым, дальше параметры фильтра", () => {
    expect(searchWithCollection(NO_FILTER, "built")).toBe("?podborka=built");
    expect(searchWithCollection({ ...NO_FILTER, deadline: "built", sort: "cheap" }, "built")).toBe("?podborka=built&srok=built&sort=cheap");
    expect(searchWithCollection({ ...NO_FILTER, rooms: [2] }, null)).toBe("?komnat=2");
    expect(collectionBySlug([built, manual], "manual")).toBe(manual);
    expect(collectionBySlug([built], "net")).toBeNull();
  });
});

describe("спецпредложения", () => {
  it("дней до конца — включительно: последний день → 0, прошедшее → 0", () => {
    expect(daysLeft("2026-10-31", "2026-10-28")).toBe(3);
    expect(daysLeft("2026-10-28", "2026-10-28")).toBe(0);
    expect(daysLeft("2026-10-20", "2026-10-28")).toBe(0);
  });

  it("карточка: обложка первого ЖК без своей, «от» по самому дешёвому через курс, ссылка — ЖК или подборка", () => {
    const one = specialView(catalog, special("s1", { complexIds: ["id-b"] }), "2026-10-28")!;
    expect(one.cover?.path).toBe("b.jpg");
    expect(one.href).toBe("/novostroyki/b");
    expect(one.price).toMatchObject({ amount: 750_000_000, currency: "UZS" });
    const two = specialView(catalog, special("s2", { complexIds: ["id-a", "id-c"] }), "2026-10-28")!;
    expect(two.href).toBe("/podborka?zhk=a,c");
    expect(two.price).toMatchObject({ amount: 35000, currency: "USD" });
    expect(two.complexes.map((c) => c.slug)).toEqual(["a", "c"]);
    expect(two.daysLeft).toBe(33);
    expect(specialView(catalog, special("s3", { complexIds: ["net-takogo"] }), "2026-10-28")).toBeNull();
  });

  it("видимые — только с ЖК на сайте, по порядку руководителя", () => {
    const list = showcase({ specials: [special("s1", {}), special("s2", { complexIds: ["net"] }), special("s3", { complexIds: ["id-c"] })] });
    expect(visibleSpecials(catalog, list).map((view) => view.special.id)).toEqual(["s1", "s3"]);
  });

  it("бейдж на карточке ЖК — первое предложение с этим ЖК; «Подарок» — только вида gift", () => {
    const list = showcase({
      specials: [
        special("s1", { kind: "installment", complexIds: ["id-a", "id-c"] }),
        special("s2", { kind: "gift", complexIds: ["id-a"] }),
      ],
    });
    expect(cardBadges(list)).toEqual({ "id-a": text("бейдж s1"), "id-c": text("бейдж s1") });
    expect(complexGift(list, "id-a")?.id).toBe("s2");
    expect(complexGift(list, "id-c")).toBeNull();
  });
});

describe("реклама (Г1 A)", () => {
  it("первая действующая по порядку; без ЖК на сайте — следующая; null — нечего показывать", () => {
    const list = showcase({ ads: [ad("x", { complexIds: ["net-takogo"] }), ad("y", { complexIds: ["id-a", "id-c"] })] });
    const view = adView(catalog, list)!;
    expect(view.ad.id).toBe("y");
    expect(view.href).toBe("/podborka?zhk=a,c");
    expect(view.cover?.path).toBe("a.jpg");
    expect(view.count).toEqual({ complexes: 2, flats: 5, partial: true });
    expect(view.price).toMatchObject({ amount: 35000, currency: "USD" });
    expect(adView(catalog, showcase({ ads: [ad("x", { complexIds: ["net-takogo"] })] }))).toBeNull();
  });

  it("по фильтру — только ЖК своего застройщика, ссылка на каталог с его фильтром", () => {
    const view = adView(catalog, showcase({ ads: [ad("f", { filter: { ...NO_FILTER, rooms: [2] } })] }))!;
    expect(view.complexes.map((c) => c.slug)).toEqual(["a", "c"]);
    expect(view.href).toBe("/novostroyki?komnat=2&zastr=sifat");
    expect(view.count).toEqual({ complexes: 2, flats: 2, partial: true });
    const single = adView(catalog, showcase({ ads: [ad("g", { developer: kamalak, filter: { ...NO_FILTER, deadline: "built" } })] }))!;
    expect(single.complexes.map((c) => c.slug)).toEqual(["b"]);
    expect(single.href).toBe("/novostroyki?srok=built&zastr=kamalak");
  });

  it("один ЖК — ссылка на его страницу", () => {
    expect(adView(catalog, showcase({ ads: [ad("one", { complexIds: ["id-c"] })] }))!.href).toBe("/novostroyki/c");
  });
});
