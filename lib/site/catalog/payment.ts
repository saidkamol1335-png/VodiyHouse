import { paymentFrom } from "@/lib/calc/compare";
import type { CatalogBlock, SiteCatalog } from "./records";

// «Платёж от … /мес» на карточке ЖК (ТЗ 6.2, Ф6 — в валюте блока): рассрочка застройщика и через
// банк блока, минимальный взнос, самый длинный срок, без скидок — paymentFrom из lib/calc от самой
// низкой цены свободной квартиры блока. null — посчитать не из чего (нет программ или цены).

export function blockPaymentFrom(catalog: SiteCatalog, developerId: string, block: CatalogBlock): number | null {
  const developer = catalog.developers.find((entry) => entry.id === developerId);
  const programs = (developer?.programs ?? [])
    .filter((entry) => entry.blocksScope === "all" || entry.blockIds.includes(block.id))
    .map((entry) => entry.program);
  const prices = block.offers.flatMap((offer) => (offer.available && offer.priceFrom !== null ? [offer.priceFrom] : []));
  if (programs.length === 0 || prices.length === 0) return null;
  return paymentFrom(programs, Math.min(...prices), block.currency, catalog.rate);
}
