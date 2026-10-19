"use client";

import {
  BriefcaseBusiness,
  BuildingComplex,
  ChartColumn,
  Globe,
  House,
  Inbox,
  Landmark,
  Settings,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { isNavItemActive, type AdminNavKey } from "@/lib/admin/nav";
import { useStripScroll } from "./useStripScroll";

export type AdminNavEntry = {
  key: AdminNavKey;
  href: string;
  /** Счётчик: новые заявки, черновики видео — с фаз 3 и 5. */
  badge?: number;
};

type AdminNavProps = {
  items: readonly AdminNavEntry[];
  /** side — боковая панель (≥ 981 px), strip — лента пилюль сверху (≤ 980 px), решения К2 и К3. */
  variant: "side" | "strip";
};

const ICONS: Record<AdminNavKey, LucideIcon> = {
  home: House,
  leads: Inbox,
  complexes: BuildingComplex,
  developers: BriefcaseBusiness,
  programs: Landmark,
  video: Video,
  stats: ChartColumn,
  settings: Settings,
};

const SITE_HREF = "/";

export function AdminNav({ items, variant }: AdminNavProps) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const track = useRef<HTMLDivElement>(null);
  const edges = useStripScroll(track, variant === "strip", pathname);
  const iconSize = variant === "strip" ? 16 : 20;

  return (
    <nav className={`admin-nav admin-nav--${variant}`} aria-label={t("label")}>
      <div ref={track} className="admin-nav__track" data-fade-start={edges.start || undefined} data-fade-end={edges.end || undefined}>
        {items.map(({ key, href, badge }) => {
          const Icon = ICONS[key];
          const active = isNavItemActive(href, pathname);
          return (
            <Link key={key} href={href} className={active ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"} aria-current={active ? "page" : undefined}>
              <Icon className="admin-nav__icon" size={iconSize} strokeWidth={1.7} aria-hidden />
              <span className="admin-nav__label">{t(key)}</span>
              {badge ? <span className="admin-nav__badge">{badge}</span> : null}
            </Link>
          );
        })}
        <p className="admin-nav__section">{t("siteSection")}</p>
        <a className="admin-nav__link" href={SITE_HREF} target="_blank" rel="noopener">
          <Globe className="admin-nav__icon" size={iconSize} strokeWidth={1.7} aria-hidden />
          <span className="admin-nav__label">{variant === "strip" ? t("site") : t("openSite")}</span>
        </a>
      </div>
    </nav>
  );
}
