"use client";

import { Camera, FolderOpen, Images, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

const ITEMS = [
  { key: "tasks", href: ADMIN_ROUTES.video, icon: ListChecks },
  { key: "new", href: ADMIN_ROUTES.videoNew, icon: Camera },
  { key: "mine", href: ADMIN_ROUTES.videoMine, icon: FolderOpen },
  { key: "media", href: ADMIN_ROUTES.videoMedia, icon: Images },
] as const;

/**
 * Нижняя панель мобилографа на телефоне (фаза E, п. 37): «Задания · Новый · Мои · Медиа» под большим
 * пальцем. Высоту панели знает страница (--video-dock-h): липкие кнопки формы и тосты встают над ней.
 */
export function VideoDock() {
  const t = useTranslations("admin.video.dock");
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const measure = () => {
      const visible = nav.current && getComputedStyle(nav.current).display !== "none";
      root.style.setProperty("--video-dock-h", visible ? `${nav.current!.offsetHeight}px` : "0px");
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--video-dock-h");
    };
  }, []);
  return (
    <nav ref={nav} className="video-dock" aria-label={t("label")}>
      {ITEMS.map(({ key, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            className={active ? "video-dock__item video-dock__item--active" : "video-dock__item"}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={22} aria-hidden="true" />
            <span>{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
