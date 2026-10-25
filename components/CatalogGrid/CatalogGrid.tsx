"use client";

import { useTranslations } from "next-intl";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { CatalogCard } from "@/components/CatalogCard";

/** Карточек на первом экране, у которых фото грузится сразу (LCP): ряд на десктопе. */
const PRELOAD_CARDS = 3;

/** Сетка карточек (мокап .cards): 3 в ряд на десктопе, 2 на планшете, 1 на телефоне. */
export function CatalogGrid({ catalog }: { catalog: SiteCatalog }) {
  const t = useTranslations("catalog.page");
  return (
    <>
      <p className="catalog-grid__count">{t("found", { n: catalog.complexes.length })}</p>
      <div className="catalog-grid">
        {catalog.complexes.map((complex, index) => (
          <CatalogCard key={complex.id} complex={complex} catalog={catalog} preload={index < PRELOAD_CARDS} />
        ))}
      </div>
    </>
  );
}
