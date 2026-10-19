"use client";

import { useTranslations } from "next-intl";
import { RollText } from "@/components/RollText";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { HEADER_NAV } from "@/lib/routes";

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Пункты шапки на десктопе (≥ 1280 px): перекат букв и затухание соседей — решение Ш1. */
export function HeaderNav() {
  const t = useTranslations();
  const pathname = usePathname();
  return (
    <nav className="header-nav" aria-label={t("header.navLabel")}>
      {HEADER_NAV.map(({ key, href }) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            className={active ? "header-nav__link header-nav__link--active roll-trigger" : "header-nav__link roll-trigger"}
            aria-current={active ? "page" : undefined}
          >
            <RollText text={t(`nav.${key}`)} />
          </Link>
        );
      })}
    </nav>
  );
}
