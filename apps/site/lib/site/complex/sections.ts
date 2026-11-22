import { layoutCards } from "./layouts";
import type { ComplexPage } from "./model";
import { stockRows } from "./stock";

// Разделы страницы ЖК и навигатор (ТЗ 7.2, мокап .jknav). Порядок — правки 15.11, п. 17 («пусть сначала
// узнает адрес, потом — данные дома»): о ЖК → расположение → блоки и условия покупки → «Выбрать квартиру»
// (п. 19, 20.11: на месте таблицы «Наличие»; таблица — только пока выбора с квартирами нет) → планировки → ход строительства → детали (описание, видео, особенности) → застройщик → документы →
// вопросы. Раздел без данных скрыт вместе со своим пунктом (PLAN 3а); тот же порядок — в «Разделах».

export const COMPLEX_ANCHORS = {
  about: "o-zhk",
  location: "raspolozhenie",
  // Правки 15.11, п. 17: «Блоки и условия покупки» — свой раздел после расположения (был внутри «О ЖК»).
  blocks: "bloki",
  pick: "vybrat-kvartiru",
  stock: "nalichie",
  soon: "skoro",
  layouts: "planirovki",
  progress: "hod-stroitelstva",
  // Правки 15.11, п. 22 (20.11): описание и видео застройщика — над каруселью «Деталей», своего раздела нет.
  details: "detali",
  developer: "zastroyshchik",
  documents: "dokumenty",
  // PLAN §10, п. 21: вопросы покупателей — последним разделом, перед заявкой.
  faq: "voprosy",
} as const;

export type ComplexSectionKey = keyof typeof COMPLEX_ANCHORS;

const hasLocation = (page: ComplexPage) => Boolean(page.address || page.point || page.landmark || page.nearby.length > 0);

/**
 * Выбор квартиры показывает всё наличие: каждый блок, где что-то продаётся, есть на фасаде с квартирами
 * (контур нарисован не у всех блоков — таблица остаётся, иначе наличие блока без контура пропало бы).
 */
function pickShowsStock(page: ComplexPage): boolean {
  if (page.picker === null || page.state === "soon") return false;
  const open = new Set(page.picker.blocks.filter((block) => block.state === "open").map((block) => block.id));
  const selling = page.blocks.filter((block) => block.offers.some((offer) => offer.available));
  return open.size > 0 && selling.every((block) => open.has(block.id));
}

/** Разделы, которые есть у этого ЖК, по порядку страницы. */
export function complexSections(page: ComplexPage): ComplexSectionKey[] {
  const present: Record<ComplexSectionKey, boolean> = {
    about: page.blocks.length > 0,
    location: hasLocation(page),
    blocks: page.blocks.length > 0,
    // Правки 15.11, п. 19 (20.11): выбор блок → этаж → квартира стоит на месте таблицы «Наличие».
    stock: stockRows(page).length > 0 && !pickShowsStock(page),
    // ЖК «Скоро»: вместо фасада, планировок и расчёта — блок с номером Vodiy House.
    pick: page.picker !== null && page.state !== "soon",
    soon: page.state === "soon",
    layouts: layoutCards(page).length > 0,
    progress: page.progress.length > 0,
    details: page.details.length > 0 || page.videos.length > 0 || Boolean(page.shortDescription?.ru || page.shortDescription?.uz),
    developer: true,
    documents: page.documents.length > 0,
    faq: page.faq.length > 0,
  };
  return (Object.keys(COMPLEX_ANCHORS) as ComplexSectionKey[]).filter((key) => present[key]);
}
