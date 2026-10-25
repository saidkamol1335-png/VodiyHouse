"use client";

import { CatalogCard } from "@/components/CatalogCard";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";

/** Заранее грузится обложка первой карточки — LCP; на телефоне виден один ряд из одной карточки. */
const PRELOAD_CARDS = 1;

/** Сетка карточек (мокап .cards): 3 в ряд на десктопе, 2 на планшете, 1 на телефоне. */
export function CatalogGrid({ catalog, complexes }: { catalog: SiteCatalog; complexes: readonly CatalogComplex[] }) {
  return (
    <div className="catalog-grid">
      {complexes.map((complex, index) => (
        <CatalogCard key={complex.id} complex={complex} catalog={catalog} preload={index < PRELOAD_CARDS} />
      ))}
    </div>
  );
}
