import { ADMIN_ROUTE } from "@/lib/routes";
import type { StaffRole } from "./access";

export type AdminNavKey =
  | "home"
  | "leads"
  | "complexes"
  | "developers"
  | "showcase"
  | "programs"
  | "video"
  | "stats"
  | "settings";

/** Адреса кабинета латиницей, как у публичных страниц (ТЗ 3). */
export const ADMIN_ROUTES = {
  home: ADMIN_ROUTE,
  login: `${ADMIN_ROUTE}/vhod`,
  password: `${ADMIN_ROUTE}/parol`,
  leads: `${ADMIN_ROUTE}/zayavki`,
  complexes: `${ADMIN_ROUTE}/zhk`,
  developers: `${ADMIN_ROUTE}/zastroyshchiki`,
  showcase: `${ADMIN_ROUTE}/vitrina`,
  showcaseSpecials: `${ADMIN_ROUTE}/vitrina/spetspredlozheniya`,
  showcaseCollections: `${ADMIN_ROUTE}/vitrina/podborki`,
  showcaseAds: `${ADMIN_ROUTE}/vitrina/reklama`,
  programs: `${ADMIN_ROUTE}/programmy`,
  programsCalc: `${ADMIN_ROUTE}/programmy/raschet`,
  video: `${ADMIN_ROUTE}/video`,
  stats: `${ADMIN_ROUTE}/statistika`,
  settings: `${ADMIN_ROUTE}/nastroyki`,
  dictionaries: `${ADMIN_ROUTE}/nastroyki/spravochniki`,
  contacts: `${ADMIN_ROUTE}/nastroyki/kontakty`,
  journal: `${ADMIN_ROUTE}/nastroyki/zhurnal`,
} as const;

export type AdminNavItem = {
  key: AdminNavKey;
  href: string;
  roles: readonly StaffRole[];
  /** Раздел уже есть в коде. Пустые разделы в меню не показываются (PLAN §7, фаза 0). */
  ready: boolean;
  /** Готов пока не для всех своих ролей: раздел делается по шагам плана. */
  readyFor?: readonly StaffRole[];
  /** Свой адрес для роли: менеджеру «Программы оплаты» открываются сразу «Расчётом для клиента». */
  hrefFor?: Partial<Record<StaffRole, string>>;
};

// Порядок и доступ — PLAN §7 и §3а: менеджер видит заявки, наличие квартир (ЖК) и расчёт
// (программы оплаты); видеограф — только видео; остальное — руководитель.
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { key: "home", href: ADMIN_ROUTES.home, roles: ["head", "manager"], ready: true },
  { key: "leads", href: ADMIN_ROUTES.leads, roles: ["head", "manager"], ready: true },
  { key: "complexes", href: ADMIN_ROUTES.complexes, roles: ["head", "manager"], ready: true },
  { key: "developers", href: ADMIN_ROUTES.developers, roles: ["head"], ready: true },
  // «Витрина» (3.16а): спецпредложения, подборки, реклама — только руководитель (PLAN п. 11).
  { key: "showcase", href: ADMIN_ROUTES.showcase, roles: ["head"], ready: true },
  {
    key: "programs",
    href: ADMIN_ROUTES.programs,
    roles: ["head", "manager"],
    ready: true,
    hrefFor: { manager: ADMIN_ROUTES.programsCalc },
  },
  // «Видео и ход стройки» (фаза 5): видеограф — свои отчёты, руководитель и менеджер — проверка и публикация.
  {
    key: "video",
    href: ADMIN_ROUTES.video,
    roles: ["head", "manager", "videographer"],
    ready: true,
  },
  // «Статистика сайта» (фаза 6): только руководитель (PLAN §7).
  { key: "stats", href: ADMIN_ROUTES.stats, roles: ["head"], ready: true },
  { key: "settings", href: ADMIN_ROUTES.settings, roles: ["head"], ready: true },
];

/** Раздел сделан для этой роли (готовность по шагам плана). */
export function isReadyFor(item: AdminNavItem, role: StaffRole): boolean {
  return item.ready && (item.readyFor?.includes(role) ?? true);
}

/** Пункты меню для роли: недоступное роли и ещё не сделанное не показываются (PLAN §3а). */
/** Пункт меню роли: href — куда ведёт ссылка, section — адрес раздела (пункт активен во всём нём). */
export type VisibleNavItem = AdminNavItem & { section: string };

export function visibleNav(
  role: StaffRole,
  items: readonly AdminNavItem[] = ADMIN_NAV,
): VisibleNavItem[] {
  return items
    .filter((item) => isReadyFor(item, role) && item.roles.includes(role))
    .map((item) => ({ ...item, href: item.hrefFor?.[role] ?? item.href, section: item.href }));
}

/** Страница раздела открыта роли сейчас: по правам PLAN §7 и готовности для неё. */
export function isSectionOpen(
  role: StaffRole,
  key: AdminNavKey,
  items: readonly AdminNavItem[] = ADMIN_NAV,
): boolean {
  return items.some(
    (item) => item.key === key && item.roles.includes(role) && isReadyFor(item, role),
  );
}

/** Главная активна только на своём адресе, остальные разделы — и на вложенных страницах. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === ADMIN_ROUTES.home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Раздел открыт роли (готовность не важна): так страница решает, показать ли «доступно руководителю». */
export function canOpen(
  role: StaffRole,
  key: AdminNavKey,
  items: readonly AdminNavItem[] = ADMIN_NAV,
): boolean {
  return items.some((item) => item.key === key && item.roles.includes(role));
}

/** Куда вести после входа: первый пункт меню роли, а пока его нет — Главная с заглушкой роли. */
export function landingPath(role: StaffRole, items: readonly AdminNavItem[] = ADMIN_NAV): string {
  return visibleNav(role, items)[0]?.href ?? ADMIN_ROUTES.home;
}

export type SettingsTabKey = "staff" | "dictionaries" | "contacts" | "journal";

export type SettingsTab = {
  key: SettingsTabKey;
  segment: string | null;
  href: string;
  ready: boolean;
};

/** Вкладки «Настроек» (решение Д6) — отдельные адреса. */
export const SETTINGS_TABS: readonly SettingsTab[] = [
  { key: "staff", segment: null, href: ADMIN_ROUTES.settings, ready: true },
  { key: "dictionaries", segment: "spravochniki", href: ADMIN_ROUTES.dictionaries, ready: true },
  { key: "contacts", segment: "kontakty", href: ADMIN_ROUTES.contacts, ready: true },
  { key: "journal", segment: "zhurnal", href: ADMIN_ROUTES.journal, ready: true },
];

export function readySettingsTabs(tabs: readonly SettingsTab[] = SETTINGS_TABS): SettingsTab[] {
  return tabs.filter((tab) => tab.ready);
}

export type ShowcaseTabKey = "specials" | "collections" | "ads";

/**
 * Вкладки «Витрины» (3.16а) — отдельные адреса, как у «Настроек». У каждой свой сегмент, чтобы
 * вкладка оставалась активной и на странице записи; сам /admin/vitrina ведёт на первую.
 */
export const SHOWCASE_TABS: readonly { key: ShowcaseTabKey; segment: string; href: string }[] = [
  { key: "specials", segment: "spetspredlozheniya", href: ADMIN_ROUTES.showcaseSpecials },
  { key: "collections", segment: "podborki", href: ADMIN_ROUTES.showcaseCollections },
  { key: "ads", segment: "reklama", href: ADMIN_ROUTES.showcaseAds },
];

/** Адрес новой записи витрины: форма без id, после сохранения — переход на страницу записи. */
export const NEW_SHOWCASE_ID = "novoe";

const SHOWCASE_ITEM_BASE = {
  special: ADMIN_ROUTES.showcaseSpecials,
  collection: ADMIN_ROUTES.showcaseCollections,
  ad: ADMIN_ROUTES.showcaseAds,
} as const;

/** Страница записи витрины; base — корень раздела (по умолчанию — кабинет). */
export function showcaseItemHref(
  kind: keyof typeof SHOWCASE_ITEM_BASE,
  id: string,
  base: string = ADMIN_ROUTES.showcase,
): string {
  return `${SHOWCASE_ITEM_BASE[kind].replace(ADMIN_ROUTES.showcase, base)}/${id}`;
}

/** Список вкладки, к которой относится запись. */
export function showcaseListHref(
  kind: keyof typeof SHOWCASE_ITEM_BASE,
  base: string = ADMIN_ROUTES.showcase,
): string {
  return SHOWCASE_ITEM_BASE[kind].replace(ADMIN_ROUTES.showcase, base);
}
