import { cardDeadline, cardPrice, type CardDeadline, type CardPrice } from "@/lib/site/catalog/card";
import type { CatalogComplex } from "@/lib/site/catalog/records";
import type { ComplexPage } from "./model";

// Главное за 10 секунд (ТЗ 7.1, мокап .jki): в продаже, цена «от», «Платёж от», срок сдачи,
// «N проверено»; и плашки «О ЖК» (мокап .facts, ТЗ 7.3б) — пустое поле не выводится.

/** ЖК для функций карточки каталога (card.ts): цена «от», срок, способы оплаты. */
export function asCatalogComplex(page: ComplexPage): CatalogComplex {
  return {
    id: page.id,
    slug: page.slug,
    name: page.name,
    class: page.class,
    sort: 0,
    developerId: page.developer.id,
    location: page.location,
    address: page.address,
    landmark: page.landmark,
    minutesToCenter: page.minutesToCenter,
    checked: page.checked,
    createdAt: "",
    photos: page.photos,
    blocks: page.blocks,
  };
}

export type ComplexSummary = {
  /** Свободных квартир; null — у части блоков нет списка квартир, число неизвестно. */
  free: number | null;
  price: CardPrice | null;
  deadline: CardDeadline;
  documents: number;
};

export function complexSummary(page: ComplexPage): ComplexSummary {
  const counts = page.blocks.map((block) => block.free);
  return {
    free: counts.length > 0 && counts.every((count) => count !== null) ? counts.reduce<number>((sum, count) => sum + (count ?? 0), 0) : null,
    price: cardPrice(asCatalogComplex(page), page.catalog),
    deadline: cardDeadline(asCatalogComplex(page)),
    documents: page.documents.length,
  };
}

/** Значение плашки: ключ перевода, число или готовый текст из базы. */
export type Fact =
  | { key: "class"; value: NonNullable<ComplexPage["class"]> }
  | { key: "floors"; value: number }
  | { key: "houseType"; value: NonNullable<ComplexPage["houseType"]> }
  | { key: "ceilings"; value: number }
  | { key: "finishing"; value: string[] }
  | { key: "parking"; value: NonNullable<ComplexPage["parking"]> }
  | { key: "toCenter"; value: number }
  | { key: "blocks"; value: string[] };

/** Плашки «О ЖК» в порядке мокапа; locale — для названий отделки из справочника. */
export function complexFacts(page: ComplexPage, locale: "ru" | "uz"): Fact[] {
  const floors = Math.max(0, ...page.blocks.map((block) => block.floorsTotal ?? 0));
  const finishings = [...new Set(page.blocks.flatMap((block) => (block.finishing ? [block.finishing.name[locale]] : [])))];
  const facts: (Fact | null)[] = [
    page.class ? { key: "class", value: page.class } : null,
    floors > 0 ? { key: "floors", value: floors } : null,
    page.houseType ? { key: "houseType", value: page.houseType } : null,
    page.ceilingHeight ? { key: "ceilings", value: page.ceilingHeight } : null,
    finishings.length > 0 ? { key: "finishing", value: finishings } : null,
    page.parking ? { key: "parking", value: page.parking } : null,
    page.minutesToCenter ? { key: "toCenter", value: page.minutesToCenter } : null,
    // Один блок — плашки «Блоки» нет: «A» без соседей ничего не говорит.
    page.blocks.length > 1 ? { key: "blocks", value: page.blocks.map((block) => block.name) } : null,
  ];
  return facts.filter((fact): fact is Fact => fact !== null);
}
