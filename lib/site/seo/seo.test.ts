import { describe, expect, it } from "vitest";
import { NO_CONTACTS } from "@/lib/contacts";
import { agencyLd, breadcrumbLd, complexLd, serializeJsonLd, type ComplexLdInput } from "./jsonLd";
import { buildSitemap, SITEMAP_ROUTES } from "./sitemap";

const ORIGIN = "https://vodiyhouse.uz";

describe("schema.org (3.14)", () => {
  it("агентство: офис и только введённые контакты Vodiy House", () => {
    const bare = agencyLd({ origin: ORIGIN, locale: "ru", office: "Фергана, ул. Сайилгох, 4", contacts: NO_CONTACTS });
    expect(bare).toMatchObject({ "@type": "RealEstateAgent", url: `${ORIGIN}/ru`, address: { streetAddress: "Фергана, ул. Сайилгох, 4" } });
    expect(bare).not.toHaveProperty("telephone");
    expect(bare).not.toHaveProperty("sameAs");
    const full = agencyLd({
      origin: ORIGIN,
      locale: "uz",
      office: "Farg‘ona",
      contacts: { ...NO_CONTACTS, phone: "+998901234567", telegram: "vodiyhouse", instagram: "vodiy.house" },
    });
    expect(full).toMatchObject({ telephone: "+998901234567", sameAs: ["https://t.me/vodiyhouse", "https://www.instagram.com/vodiy.house"] });
  });

  const complex: ComplexLdInput = {
    origin: ORIGIN,
    url: `${ORIGIN}/ru/novostroyki/shodlik`,
    name: "ЖК Shodlik",
    description: "…",
    address: "ул. Мустакиллик, 12",
    point: { lat: 40.38, lng: 71.78 },
    images: ["https://cdn/1.jpg"],
    price: { amount: 31000, currency: "USD" },
    free: 12,
  };

  it("ЖК с ценой: Product + AggregateOffer «от» в валюте блока, свободные квартиры", () => {
    expect(complexLd(complex)).toMatchObject({
      "@type": ["ApartmentComplex", "Product"],
      geo: { latitude: 40.38, longitude: 71.78 },
      numberOfAvailableAccommodationUnits: 12,
      offers: { "@type": "AggregateOffer", lowPrice: 31000, priceCurrency: "USD", offerCount: 12, availability: "https://schema.org/InStock" },
    });
  });

  it("ЖК без цены и точки — только ApartmentComplex, без пустых полей", () => {
    const ld = complexLd({ ...complex, price: null, point: null, address: null, images: [], free: null });
    expect(ld["@type"]).toBe("ApartmentComplex");
    for (const key of ["offers", "geo", "address", "image", "numberOfAvailableAccommodationUnits"]) expect(ld).not.toHaveProperty(key);
    expect(complexLd({ ...complex, free: 0 })).toMatchObject({ offers: { availability: "https://schema.org/SoldOut" } });
  });

  it("крошки по порядку; «<» из базы не закрывает тег", () => {
    const crumbs = breadcrumbLd([
      { name: "Vodiy House", url: `${ORIGIN}/ru` },
      { name: "ЖК </script><b>", url: complex.url },
    ]);
    expect(crumbs).toMatchObject({ itemListElement: [{ position: 1 }, { position: 2, item: complex.url }] });
    const text = serializeJsonLd(crumbs);
    expect(text).not.toContain("</script>");
    expect(JSON.parse(text)).toEqual(crumbs);
  });
});

describe("sitemap.xml (3.14)", () => {
  const map = buildSitemap(ORIGIN, ["shodlik"]);

  it("страницы и ЖК на обоих языках, у каждой — пара и x-default", () => {
    expect(map).toHaveLength((SITEMAP_ROUTES.length + 1) * 2);
    const complexRu = map.find((entry) => entry.url === `${ORIGIN}/ru/novostroyki/shodlik`);
    expect(complexRu?.alternates?.languages).toEqual({
      uz: `${ORIGIN}/uz/novostroyki/shodlik`,
      ru: `${ORIGIN}/ru/novostroyki/shodlik`,
      "x-default": `${ORIGIN}/uz/novostroyki/shodlik`,
    });
    expect(map.find((entry) => entry.url === `${ORIGIN}/uz`)?.priority).toBe(1);
  });

  it("избранного и подборки нет — они без индексации", () => {
    expect(map.some((entry) => /izbrannoe|podborka|admin|dev/.test(entry.url))).toBe(false);
  });
});
