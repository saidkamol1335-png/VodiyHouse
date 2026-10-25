// Адреса публичных страниц (ТЗ 3, латиницей). Префикс языка добавляет Link из lib/i18n/navigation.
export const ROUTES = {
  home: "/",
  catalog: "/novostroyki",
  developers: "/zastroyshchiki",
  calculator: "/kalkulyator",
  about: "/o-nas",
  forDevelopers: "/dlya-zastroyshchikov",
  quiz: "/podbor",
  favorites: "/izbrannoe",
  privacy: "/privacy",
} as const;

/** Публичные страницы, которые уже есть в коде. Остальные адреса шапки — разделы фазы 3. */
const READY_ROUTES: ReadonlySet<string> = new Set([ROUTES.home, ROUTES.calculator]);

export function isRouteReady(pathname: string | null | undefined): boolean {
  return typeof pathname === "string" && READY_ROUTES.has(pathname);
}

/** Кабинет — без префикса языка. */
export const ADMIN_ROUTE = "/admin";

export type NavKey = "new" | "specials" | "developers" | "calculator" | "about" | "forDevelopers" | "quiz";

/**
 * Пункты шапки — порядок мокапа 09.10.2026 (PLAN §7, фаза 3). Запуск 3а — без «Спецпредложений»
 * (в 3б — якорь раздела главной, отдельной страницы нет) и «Застройщиков» (страницы — 3б).
 */
export const HEADER_NAV: readonly { key: NavKey; href: string }[] = [
  { key: "new", href: ROUTES.catalog },
  { key: "calculator", href: ROUTES.calculator },
  { key: "about", href: ROUTES.about },
  { key: "forDevelopers", href: ROUTES.forDevelopers },
];

/** Скрытые пункты (решение «Пустые состояния»): «Калькулятор» — без застройщиков с программами. */
export const hiddenNav = ({ calculator }: { calculator: boolean }): NavKey[] =>
  calculator ? [] : ["calculator"];

/** Меню планшета и телефона: пункты шапки; «Подбор за 1 минуту» (решение Ш5) — с квизом в 3б. */
export const MENU_NAV: readonly { key: NavKey; href: string }[] = [...HEADER_NAV];
