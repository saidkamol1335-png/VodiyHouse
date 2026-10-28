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
  howToBuy: "/kak-kupit",
  privacy: "/privacy",
  podborka: "/podborka",
} as const;

/** Страница ЖК — внутри каталога: адрес ЖК не столкнётся с адресами разделов (реши сам, фаза 3). */
export const complexRoute = (slug: string) => `${ROUTES.catalog}/${slug}`;

/** Страница застройщика (шаг 3.15) — внутри списка застройщиков. */
export const developerRoute = (slug: string) => `${ROUTES.developers}/${slug}`;

/** Публичные страницы, которые уже есть в коде. Остальные адреса шапки — разделы фазы 3. */
const READY_ROUTES: ReadonlySet<string> = new Set([
  ROUTES.home,
  ROUTES.calculator,
  ROUTES.catalog,
  ROUTES.developers,
  ROUTES.favorites,
  ROUTES.about,
  ROUTES.forDevelopers,
  ROUTES.howToBuy,
  ROUTES.privacy,
]);

/** Страницы ЖК (шаг 3.5) и застройщика (3.15): адрес — slug. */
const SLUG_PAGE = /^\/(?:novostroyki|zastroyshchiki)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isRouteReady(pathname: string | null | undefined): boolean {
  return typeof pathname === "string" && (READY_ROUTES.has(pathname) || SLUG_PAGE.test(pathname));
}

/** Кабинет — без префикса языка. */
export const ADMIN_ROUTE = "/admin";

export type NavKey =
  "new" | "specials" | "developers" | "calculator" | "about" | "forDevelopers" | "quiz" | "howToBuy";

/**
 * Пункты шапки — порядок мокапа 09.10.2026 (PLAN §7, фаза 3): «Застройщики» — с 3.15;
 * «Спецпредложения» (якорь раздела главной, отдельной страницы нет) — с 3.16.
 */
export const HEADER_NAV: readonly { key: NavKey; href: string }[] = [
  { key: "new", href: ROUTES.catalog },
  { key: "developers", href: ROUTES.developers },
  { key: "calculator", href: ROUTES.calculator },
  { key: "about", href: ROUTES.about },
  { key: "forDevelopers", href: ROUTES.forDevelopers },
];

/** Скрытые пункты (решение «Пустые состояния»): «Калькулятор» — без застройщиков с программами. */
export const hiddenNav = ({ calculator }: { calculator: boolean }): NavKey[] =>
  calculator ? [] : ["calculator"];

/**
 * Подвал, «Каталог» (порядок мокапа): новостройки, калькулятор, застройщики (3.15), «О нас» и
 * «Как купить» (блока о покупке на главной нет — решение фазы 3); спецпредложения и подбор — 3.16, 3.17.
 */
export const FOOTER_NAV: readonly { key: NavKey; href: string }[] = [
  { key: "new", href: ROUTES.catalog },
  { key: "calculator", href: ROUTES.calculator },
  { key: "developers", href: ROUTES.developers },
  { key: "about", href: ROUTES.about },
  { key: "howToBuy", href: ROUTES.howToBuy },
];

/** Меню планшета и телефона: пункты шапки; «Подбор за 1 минуту» (решение Ш5) — с квизом в 3б. */
export const MENU_NAV: readonly { key: NavKey; href: string }[] = [...HEADER_NAV];
