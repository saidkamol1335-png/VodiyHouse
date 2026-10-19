import { ADMIN_ROUTE } from "@/lib/routes";
import type { StaffRole } from "./access";

export type AdminNavKey = "home" | "leads" | "complexes" | "developers" | "programs" | "video" | "stats" | "settings";

/** Адреса кабинета латиницей, как у публичных страниц (ТЗ 3). */
export const ADMIN_ROUTES = {
  home: ADMIN_ROUTE,
  login: `${ADMIN_ROUTE}/vhod`,
  leads: `${ADMIN_ROUTE}/zayavki`,
  complexes: `${ADMIN_ROUTE}/zhk`,
  developers: `${ADMIN_ROUTE}/zastroyshchiki`,
  programs: `${ADMIN_ROUTE}/programmy`,
  video: `${ADMIN_ROUTE}/video`,
  stats: `${ADMIN_ROUTE}/statistika`,
  settings: `${ADMIN_ROUTE}/nastroyki`,
} as const;

export type AdminNavItem = {
  key: AdminNavKey;
  href: string;
  roles: readonly StaffRole[];
  /** Раздел уже есть в коде. Пустые разделы в меню не показываются (PLAN §7, фаза 0). */
  ready: boolean;
};

// Порядок и доступ — PLAN §7 и §3а: менеджер видит заявки, наличие квартир (ЖК) и расчёт
// (программы оплаты); видеограф — только видео; остальное — руководитель.
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { key: "home", href: ADMIN_ROUTES.home, roles: ["head", "manager"], ready: true },
  { key: "leads", href: ADMIN_ROUTES.leads, roles: ["head", "manager"], ready: false },
  { key: "complexes", href: ADMIN_ROUTES.complexes, roles: ["head", "manager"], ready: false },
  { key: "developers", href: ADMIN_ROUTES.developers, roles: ["head"], ready: false },
  { key: "programs", href: ADMIN_ROUTES.programs, roles: ["head", "manager"], ready: false },
  { key: "video", href: ADMIN_ROUTES.video, roles: ["head", "manager", "videographer"], ready: false },
  { key: "stats", href: ADMIN_ROUTES.stats, roles: ["head"], ready: false },
  { key: "settings", href: ADMIN_ROUTES.settings, roles: ["head"], ready: false },
];

/** Пункты меню для роли: недоступное роли и ещё не сделанное не показываются (PLAN §3а). */
export function visibleNav(role: StaffRole, items: readonly AdminNavItem[] = ADMIN_NAV): AdminNavItem[] {
  return items.filter((item) => item.ready && item.roles.includes(role));
}

/** Главная активна только на своём адресе, остальные разделы — и на вложенных страницах. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === ADMIN_ROUTES.home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
