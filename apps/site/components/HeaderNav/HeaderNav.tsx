"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { RollText } from "@/components/RollText";
import { useNavItems } from "@/components/HiddenNav";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { HEADER_NAV } from "@/lib/routes";
import { useLiquidDrop } from "./useLiquidDrop";

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Пункты шапки на десктопе (≥ 1280 px): перекат букв и затухание соседей — решение Ш1; стеклянная
 * капсула с «каплей» под текущим разделом и пунктом под курсором (liquid-glass.css, useLiquidDrop).
 */
export function HeaderNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const items = useNavItems(HEADER_NAV);
  const navRef = useRef<HTMLElement>(null);
  const dropRef = useRef<HTMLSpanElement>(null);
  useLiquidDrop(navRef, dropRef);
  return (
    <nav ref={navRef} className="header-nav" aria-label={t("header.navLabel")}>
      <span ref={dropRef} className="header-nav__drop" aria-hidden />
      <RefractFilter />
      {items.map(({ key, href }) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            className={
              active
                ? "header-nav__link header-nav__link--active roll-trigger"
                : "header-nav__link roll-trigger"
            }
            aria-current={active ? "page" : undefined}
          >
            <RollText text={t(`nav.${key}`)} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Преломление фона капсулы (как у Liquid Glass Navbar): шум сдвигает фон — стекло «плывёт». */
function RefractFilter() {
  return (
    <svg className="header-nav__defs" width="0" height="0" aria-hidden focusable="false">
      <filter
        id="vh-refract"
        x="0"
        y="0"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.006 0.02"
          numOctaves="2"
          seed="7"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="soft"
          scale="48"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
