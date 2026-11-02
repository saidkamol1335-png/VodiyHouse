"use client";

import { CatalogCard } from "@/components/CatalogCard";
import type { LocalizedText } from "@/lib/contacts";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";

/** Заранее грузится обложка первой карточки — LCP; на телефоне виден один ряд из одной карточки. */
const PRELOAD_CARDS = 1;

/** Сетка карточек (мокап .cards): 3 в ряд на десктопе, 2 на планшете, 1 на телефоне. */
type CatalogGridProps = {
  catalog: SiteCatalog;
  complexes: readonly CatalogComplex[];
  /** false — сетка ниже первого экрана (главная): обложка не спорит за канал с фото обложки. */
  preloadFirst?: boolean;
  /** Бейдж спецпредложения по id ЖК (витрина, 3.16б). */
  badges?: Record<string, LocalizedText>;
};

export function CatalogGrid({ catalog, complexes, preloadFirst = true, badges }: CatalogGridProps) {
  return (
    <div className="catalog-grid">
      {complexes.map((complex, index) => (
        <CatalogCard key={complex.id} complex={complex} catalog={catalog} preload={preloadFirst && index < PRELOAD_CARDS} badge={badges?.[complex.id] ?? null} />
      ))}
    </div>
  );
}
