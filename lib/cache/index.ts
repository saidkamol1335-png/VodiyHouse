import "server-only";
import { revalidateTag, updateTag } from "next/cache";

// Теги кэша публичных страниц (PLAN §3а: правка в кабинете видна на сайте за секунды, без
// пересборки). Страниц сайта ещё нет — договор для фазы 3:
// - страница ЖК: 'use cache' + cacheTag(complexTag(id), developerTag(developerId));
// - каталог, главная, поиск ЖК по адресу и ЖК на странице застройщика — тег CATALOG_TAG
//   (публикация нового адреса сбрасывает и «не найден»);
// - страница и список застройщиков — developerTag(id) и DEVELOPERS_TAG; всё, что считает или
//   перечисляет ЖК («N новостроек на сайте», «Другие застройщики · N ЖК»), — ещё и CATALOG_TAG;
// - справочники (города и районы, документы, темы деталей, отделка) — чтение в 'use cache' с
//   cacheTag(DICTIONARIES_TAG): теги вложенного кэша поднимаются в страницу ЖК и каталог.
// Сбрасывает только Server Action и сразу (updateTag): «продана» не должна достаться первому
// посетителю из старого кэша; updateTag заодно перерисовывает текущую страницу кабинета.

export const CATALOG_TAG = "complexes";
export const DEVELOPERS_TAG = "developers";
export const DICTIONARIES_TAG = "dictionaries";

export const complexTag = (id: string) => `complex:${id}`;
export const developerTag = (id: string) => `developer:${id}`;

/** ЖК поменялся. null — менять было нечего (пустой список у функций квартир). */
export function expireComplex(id: string | null | undefined): void {
  if (!id) return;
  updateTag(complexTag(id));
  updateTag(CATALOG_TAG);
}

/** Порядок каталога поменялся (шаг 3.6): каталог и «Другие ЖК застройщика» — под CATALOG_TAG. */
export function expireCatalog(): void {
  updateTag(CATALOG_TAG);
}

/** Застройщик поменялся: его страница, список, а от его статуса — видимость его ЖК в каталоге. */
export function expireDeveloper(id: string | null | undefined): void {
  if (!id) return;
  updateTag(developerTag(id));
  updateTag(DEVELOPERS_TAG);
  updateTag(CATALOG_TAG);
}

// Косметика — точка фокуса фото: один показ старого кадра допустим, а перерисовка страницы
// кабинета помешала бы (фокус сохраняется и после ухода со вкладки).
export function markComplexStale(id: string | null | undefined): void {
  if (!id) return;
  revalidateTag(complexTag(id), "max");
  // Обложка каталога кадрируется по той же точке.
  revalidateTag(CATALOG_TAG, "max");
}

export function markDeveloperStale(id: string | null | undefined): void {
  if (!id) return;
  revalidateTag(developerTag(id), "max");
  revalidateTag(DEVELOPERS_TAG, "max");
}

/** Справочник поменялся: названия районов, отделок и т. п. на страницах ЖК и в каталоге. */
export function expireDictionaries(): void {
  updateTag(DICTIONARIES_TAG);
}

/** Настройки сайта (контакты Vodiy House, Ф9) — в оболочке каждой страницы, поэтому свой узкий тег. */
export const SITE_SETTINGS_TAG = "site-settings";

export function expireSiteSettings(): void {
  updateTag(SITE_SETTINGS_TAG);
}

/**
 * Программы оплаты и курс (фаза 2): калькулятор сайта — 'use cache' + cacheTag(PROGRAMS_TAG);
 * «Платёж от» на карточках ЖК — ещё CATALOG_TAG; программы на странице застройщика — его тег.
 */
export const PROGRAMS_TAG = "payment-programs";

export function expirePrograms(developerId?: string | null): void {
  updateTag(PROGRAMS_TAG);
  updateTag(CATALOG_TAG);
  if (developerId) updateTag(developerTag(developerId));
}

/** Курс ЦБ по расписанию: не Server Action, updateTag там нельзя — те же теги истекают сразу. */
export function expireRateNow(): void {
  revalidateTag(PROGRAMS_TAG, { expire: 0 });
  revalidateTag(CATALOG_TAG, { expire: 0 });
}

/** id ЖК из ответа функции базы {complex_id, …}. */
export function complexIdFrom(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const id = (data as { complex_id?: unknown }).complex_id;
  return typeof id === "string" && id !== "" ? id : null;
}
