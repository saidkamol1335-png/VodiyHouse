import { blockMatches, offerMatches, type CatalogFilter } from "./filter";
import type { CatalogComplex, SiteCatalog } from "./records";

export type FlatCount = { flats: number; partial: boolean };

/**
 * Свободные квартиры подходящих типов в подходящих блоках: срок сдачи, способ оплаты и отделка —
 * свойства блока, поэтому квартиры несданных блоков частично сданного ЖК в «сданные» не попадают
 * (ревью блока G). partial — у части типов наличие без числа: на сайте «не меньше».
 * Одни и те же цифры у квиза, подборок и рекламы.
 */
export function countMatchingFlats(complexes: readonly CatalogComplex[], catalog: SiteCatalog, filter: CatalogFilter): FlatCount {
  let flats = 0;
  let partial = false;
  for (const complex of complexes) {
    const developer = catalog.developers.find((entry) => entry.id === complex.developerId);
    for (const block of complex.blocks) {
      if (!blockMatches(block, developer, filter, catalog.rate)) continue;
      for (const offer of block.offers) {
        if (!offerMatches(offer, block.currency, filter, catalog.rate)) continue;
        if (offer.free === null) partial ||= offer.available;
        else flats += offer.free;
      }
    }
  }
  return { flats, partial };
}
