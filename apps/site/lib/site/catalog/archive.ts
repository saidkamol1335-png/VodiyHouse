import type {
  FilterOptionSection,
  FilterSection,
  FilterVisibility,
} from "@vh/shared/filterArchive";
import type { CatalogFilter } from "./filter";

// Архив кнопок фильтра (06.11.2026). Архив прячет кнопку, но не трогает выдачу: ссылки рекламы
// застройщика, вкладок «Выберите квартиру», квиза и подборок ведут ровно на то, что обещают. Кнопка
// из архива, которая сейчас выбрана, видна — посетитель видит, чем сужена выдача, и может её снять.

function activeValues(filter: CatalogFilter, section: FilterOptionSection): string[] {
  switch (section) {
    case "rooms":
      return filter.rooms.map(String);
    case "location":
      return filter.locations;
    case "payment":
      return filter.payments;
    case "deadline":
      return filter.deadline === "any" ? [] : [String(filter.deadline)];
    case "developer":
      return filter.developers;
    case "finishing":
      return filter.finishings;
  }
}

function sectionActive(filter: CatalogFilter, section: FilterSection): boolean {
  if (section === "price") return filter.priceMin !== null || filter.priceMax !== null;
  return activeValues(filter, section).length > 0;
}

/** Видимость с учётом выбора: архив — кроме того, что посетитель уже выбрал. */
export function withActive(visibility: FilterVisibility, filter: CatalogFilter): FilterVisibility {
  return {
    section: (section) => visibility.section(section) || sectionActive(filter, section),
    option: (section, value) =>
      visibility.option(section, value) || activeValues(filter, section).includes(String(value)),
  };
}
