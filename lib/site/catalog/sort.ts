import { convertMoney } from "@/lib/calc/money";
import { blockMatches, complexMatches, offerMatches, type CatalogFilter } from "./filter";
import type { CatalogComplex, SiteCatalog } from "./records";

// Выдача каталога (мокап: сортировки «Рекомендуемые», «Дешевле», «Дороже», «Срок сдачи»).
// Цена ЖК в выдаче — самая низкая среди подходящих под фильтр квартир, в $: сортировать сумы
// и доллары можно только через курс; без курса и без цены ЖК — в конце списка (Ф6).

/** Цена «от» в $ среди подходящих под фильтр типов комнат; null — неизвестна. */
export function matchingPriceUsd(complex: CatalogComplex, catalog: SiteCatalog, filter: CatalogFilter): number | null {
  const developer = catalog.developers.find((entry) => entry.id === complex.developerId);
  let best: number | null = null;
  for (const block of complex.blocks) {
    if (!blockMatches(block, developer, filter, catalog.rate)) continue;
    for (const offer of block.offers) {
      if (!offerMatches(offer, block.currency, filter, catalog.rate) || offer.priceFrom === null) continue;
      const usd = convertMoney(offer.priceFrom, block.currency, "USD", catalog.rate);
      if (usd !== null && (best === null || usd < best)) best = usd;
    }
  }
  return best;
}

/** Ближайший срок сдачи (год × 4 + квартал); всё сдано — 0; у строящихся срока нет — null (в конце). */
export function deadlineRank(complex: CatalogComplex): number | null {
  const building = complex.blocks.filter((block) => block.buildStatus !== "delivered");
  if (building.length === 0) return 0;
  const ranks = building.flatMap((block) => (block.deadline ? [block.deadline.year * 4 + block.deadline.quarter] : []));
  return ranks.length > 0 ? Math.min(...ranks) : null;
}

/** null — в конце при любом направлении. */
function byNumber(direction: 1 | -1) {
  return (a: number | null, b: number | null) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (a - b) * direction;
  };
}

/** Подходящие ЖК в порядке сортировки; «Рекомендуемые» — порядок руководителя из базы. */
export function filterCatalog(catalog: SiteCatalog, filter: CatalogFilter): CatalogComplex[] {
  const found = catalog.complexes.filter((complex) => complexMatches(complex, catalog, filter));
  if (filter.sort === "rec") return found;
  if (filter.sort === "dl") return [...found].sort((a, b) => byNumber(1)(deadlineRank(a), deadlineRank(b)));
  const price = new Map(found.map((complex) => [complex.id, matchingPriceUsd(complex, catalog, filter)]));
  const compare = byNumber(filter.sort === "cheap" ? 1 : -1);
  return [...found].sort((a, b) => compare(price.get(a.id) ?? null, price.get(b.id) ?? null));
}
