import { withoutSoon } from "@/lib/site/catalog/sort";
import type { CatalogComplex } from "@/lib/site/catalog/records";

/** Меньше — ленту не показываем: три карточки — минимум, чтобы было что листать (PLAN §10, п. 47). */
export const PROJECTS_MIN = 3;

/**
 * Ширины карточек по кругу: ≈60vw и 70vw. Узкой (32vw, Motion Kit №17) нет — портретный кадр
 * резал рендер ЖК (слово исполнителя 03.11: «как у Shodlik и Chinor»).
 */
export const PROJECT_WIDTHS = ["base", "wide"] as const;
export type ProjectWidth = (typeof PROJECT_WIDTHS)[number];

/**
 * ЖК ленты «Проекты Vodiy House»: опубликованные и не «скоро» (тот же site_catalog, что каталог, в его
 * порядке), с обложкой — фон карточки. Меньше PROJECTS_MIN — пусто, блок скрыт.
 */
export function projectComplexes(complexes: readonly CatalogComplex[]): CatalogComplex[] {
  const list = withoutSoon(complexes).filter((complex) => complex.photos[0]);
  return list.length >= PROJECTS_MIN ? list : [];
}

export const projectWidth = (index: number): ProjectWidth =>
  PROJECT_WIDTHS[index % PROJECT_WIDTHS.length] as ProjectWidth;
