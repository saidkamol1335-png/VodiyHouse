import { filterFromSearch, searchFromFilter } from "@/lib/site/catalog/params";
import type { FilterSearch } from "./types";

// Фильтр каталога у подборки и рекламы (3.16а): в базе — параметры адреса как есть
// ({"komnat": "1,2", "do": "45000"}), на сайте — /novostroyki?podborka=slug с ними. Разбор и
// нормализация — те же, что у адреса каталога: чужое значение отпадает, порядок и вид — единые.

/** Имена параметров — как в адресе каталога (мокап filterQuery); поля формы — `filter.<имя>`. */
export const FILTER_PARAMS = ["komnat", "gorod", "ot", "do", "srok", "oplata", "zastr", "otdelka"] as const;
export type FilterParam = (typeof FILTER_PARAMS)[number];

export const FILTER_FIELD_PREFIX = "filter.";

/** Через разбор каталога и обратно: только известные значения, в едином виде. */
export function normalizeFilterSearch(raw: Record<string, string | string[] | undefined>): FilterSearch {
  const query = searchFromFilter(filterFromSearch(raw));
  return Object.fromEntries(new URLSearchParams(query.replace(/^\?/, "")));
}

/** Из формы: чипы и списки с несколькими значениями — через запятую, пустое не пишется. */
export function readFilterSearch(formData: FormData): FilterSearch {
  const raw: Record<string, string> = {};
  for (const param of FILTER_PARAMS) {
    const values = formData
      .getAll(`${FILTER_FIELD_PREFIX}${param}`)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length > 0) raw[param] = values.join(",");
  }
  return normalizeFilterSearch(raw);
}

/** Из базы (jsonb): объект со строками; чужое — пропускается. */
export function filterSearchFrom(raw: unknown): FilterSearch {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const strings = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  return normalizeFilterSearch(strings);
}

export function isEmptyFilter(search: FilterSearch): boolean {
  return Object.keys(search).length === 0;
}

/** «?komnat=2&srok=built» — хвост адреса каталога; пустой фильтр — пустая строка. */
export function filterQuery(search: FilterSearch): string {
  return searchFromFilter(filterFromSearch(search));
}

/** Значения параметра для формы: «1,2» → ["1", "2"]. */
export function filterValues(search: FilterSearch, param: FilterParam): string[] {
  return (search[param] ?? "").split(",").filter(Boolean);
}
