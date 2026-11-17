"use client";

import { Fragment } from "react";
import { AdBanner } from "@/components/AdBanner";
import { CatalogCard } from "@/components/CatalogCard";
import type { LocalizedText } from "@/lib/contacts";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { adSlotAfter } from "@/lib/site/showcase/slots";
import type { ShowcaseAd } from "@/lib/site/showcase/records";

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
  /** Баннеры рекламы для слотов каталога (правки 15.11, п. 4 + 13); нет — слотов нет. */
  ads?: readonly ShowcaseAd[];
  /** Телефон Vodiy House для кнопки баннера. */
  phone?: string | null;
};

export function CatalogGrid({ catalog, complexes, preloadFirst = true, badges, ads = [], phone = null }: CatalogGridProps) {
  return (
    <div className="catalog-grid">
      {complexes.map((complex, index) => {
        const ad = adSlotAfter(index, ads);
        return (
          <Fragment key={complex.id}>
            <CatalogCard complex={complex} catalog={catalog} preload={preloadFirst && index < PRELOAD_CARDS} badge={badges?.[complex.id] ?? null} />
            {ad ? <AdBanner ad={ad} phone={phone} variant="slot" /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}
