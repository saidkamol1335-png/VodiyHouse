"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { phoneHref, VODIY_HOUSE_PHONE } from "@/lib/contacts";
import { Link } from "@/lib/i18n/navigation";
import { MENU_NAV } from "@/lib/routes";

type TabletMenuProps = {
  id: string;
  onNavigate: () => void;
};

/** Меню 761–1279 px: выпадающий список под шапкой (решение Ш4). */
export function TabletMenu({ id, onNavigate }: TabletMenuProps) {
  const t = useTranslations();
  return (
    <nav id={id} className="tablet-menu" aria-label={t("header.menu")}>
      {MENU_NAV.map(({ key, href }) => (
        <Link key={key} href={href} className="tablet-menu__link" onClick={onNavigate}>
          {t(`nav.${key}`)}
        </Link>
      ))}
      {VODIY_HOUSE_PHONE ? (
        <a className="tablet-menu__link" href={phoneHref(VODIY_HOUSE_PHONE)}>
          {VODIY_HOUSE_PHONE}
        </a>
      ) : null}
      <div className="tablet-menu__tools">
        <LanguageSwitch onNavigate={onNavigate} />
        <ThemeToggle />
      </div>
    </nav>
  );
}
