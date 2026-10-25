// Ссылка на каталог с фильтром (Ф3): пока браузер его не применил, выдача скрыта — чтобы не мелькнул
// весь список. Ставит скрипт <head> (lib/boot/headScript.ts) при полной загрузке страницы, снимает
// CatalogResults; не дождались за 4 с (ошибка скрипта) — выдача показывается как есть.

export const CATALOG_PENDING_ATTRIBUTE = "data-catalog-pending";
export const CATALOG_PENDING_TIMEOUT_MS = 4000;
export const CATALOG_FILTER_PARAMS = ["komnat", "gorod", "ot", "do", "srok", "oplata", "zastr", "otdelka", "sort"] as const;
