"use client";

import { useTranslations } from "next-intl";
import { useNavItems } from "@/components/HiddenNav";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useSiteContacts } from "@/components/SiteContacts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatPhone, phoneHref } from "@/lib/contacts";
import { Link } from "@/lib/i18n/navigation";
import { MENU_NAV } from "@/lib/routes";

type TabletMenuProps = {
  id: string;
  onNavigate: () => void;
};

/** Меню 761–1279 px: выпадающий список под шапкой (решение Ш4). */
export function TabletMenu({ id, onNavigate }: TabletMenuProps) {
  const t = useTranslations();
  const items = useNavItems(MENU_NAV);
  const { phone } = useSiteContacts();
  return (
    <nav id={id} className="tablet-menu" aria-label={t("header.menu")}>
      {items.map(({ key, href }) => (
        <Link key={key} href={href} className="tablet-menu__link" onClick={onNavigate}>
          {t(`nav.${key}`)}
        </Link>
      ))}
      {phone ? (
        <a className="tablet-menu__link" href={phoneHref(phone)}>
          {formatPhone(phone)}
        </a>
      ) : null}
      <div className="tablet-menu__tools">
        <LanguageSwitch onNavigate={onNavigate} />
        <ThemeToggle />
      </div>
    </nav>
  );
}
