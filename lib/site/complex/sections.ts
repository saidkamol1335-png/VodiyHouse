import { layoutCards } from "./layouts";
import type { ComplexPage } from "./model";
import { stockRows } from "./stock";

// Разделы страницы ЖК и навигатор (ТЗ 7.2, мокап .jknav): порядок мокапа плюс разделы Ф4 на местах
// ТЗ («Видеообзор» — после планировок, «Детали» — перед застройщиком). Раздел без данных скрыт
// вместе со своим пунктом (PLAN 3а); «Выбрать квартиру» — фаза 4, «Ход строительства» — фаза 5.

export const COMPLEX_ANCHORS = {
  about: "o-zhk",
  location: "raspolozhenie",
  stock: "nalichie",
  layouts: "planirovki",
  video: "video",
  details: "detali",
  developer: "zastroyshchik",
  documents: "dokumenty",
} as const;

export type ComplexSectionKey = keyof typeof COMPLEX_ANCHORS;

const hasLocation = (page: ComplexPage) => Boolean(page.address || page.point || page.landmark || page.nearby.length > 0);

/** Разделы, которые есть у этого ЖК, по порядку страницы. */
export function complexSections(page: ComplexPage): ComplexSectionKey[] {
  const present: Record<ComplexSectionKey, boolean> = {
    about: page.blocks.length > 0,
    location: hasLocation(page),
    stock: stockRows(page).length > 0,
    layouts: layoutCards(page).length > 0,
    video: page.videos.length > 0,
    details: page.details.length > 0,
    developer: true,
    documents: page.documents.length > 0,
  };
  return (Object.keys(COMPLEX_ANCHORS) as ComplexSectionKey[]).filter((key) => present[key]);
}
