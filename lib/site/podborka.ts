// Подборка для получателя ссылки (шаг 3.10, Ф7 A): /podborka?zhk=a,b,c — адреса ЖК из избранного
// отправителя. Чужие значения молча отбрасываются: битая ссылка даёт пустую подборку, а не ошибку.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PODBORKA_LIMIT = 30;

export function podborkaSlugs(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw[0] : raw;
  return [...new Set((text ?? "").split(",").filter((slug) => SLUG.test(slug)))].slice(0, PODBORKA_LIMIT);
}

/** Путь подборки — для «Поделиться избранным» (адрес сайта добавляет вызывающий). */
export function podborkaPath(locale: string, slugs: readonly string[]): string {
  return `/${locale}/podborka?zhk=${slugs.join(",")}`;
}
