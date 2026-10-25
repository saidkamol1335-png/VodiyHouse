"use client";

import { CatalogCard } from "@/components/CatalogCard";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";

/** Карточек первого ряда, у которых фото грузится сразу (LCP). */
const PRELOAD_CARDS = 3;

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
