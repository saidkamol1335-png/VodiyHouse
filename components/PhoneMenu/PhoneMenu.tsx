"use client";

import { ArrowRight, ChevronRight, MapPin, Phone, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LogoMark } from "@/components/Logo";
import { ThemeSegmented } from "@/components/ThemeToggle";
import { phoneHref, telegramHref, VODIY_HOUSE_PHONE, VODIY_HOUSE_TELEGRAM } from "@/lib/contacts";
import { Link } from "@/lib/i18n/navigation";
import { ADMIN_ROUTE, MENU_NAV, ROUTES } from "@/lib/routes";

type PhoneMenuProps = {
  id: string;
  onClose: () => void;
};

const ICON = { size: 20, strokeWidth: 1.8 } as const;

function ContactRow({ icon, label, value, href }: { icon: ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <>
      {icon}
      <span className="phone-menu__contact-text">
        <small>{label}</small>
        {value}
      </span>
      {href ? <ChevronRight size={16} strokeWidth={1.8} aria-hidden /> : null}
    </>
  );
  return href ? <a className="phone-menu__contact" href={href}>{content}</a> : <div className="phone-menu__contact">{content}</div>;
}

/** Меню телефона на весь экран (решение Ш5): 01–07, контакты Vodiy House, язык, тема. */
export function PhoneMenu({ id, onClose }: PhoneMenuProps) {
  const t = useTranslations();
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButton.current?.focus(), []);
  // Любая ссылка внутри меню уводит со страницы — меню закрываем.
  const closeOnLink = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a")) onClose();
  };
  return (
    <div id={id} className="phone-menu" role="dialog" aria-modal="true" aria-label={t("header.menu")} onClick={closeOnLink}>
      <div className="phone-menu__head">
        <Link href={ROUTES.home} className="logo" aria-label={t("header.home")}>
          <LogoMark />
          <span className="logo__text">Vodiy House</span>
        </Link>
        <button ref={closeButton} type="button" className="icon-button phone-menu__close" aria-label={t("header.closeMenu")} onClick={onClose}>
          <X {...ICON} aria-hidden />
        </button>
      </div>
      <div className="phone-menu__body">
        <nav aria-label={t("header.navLabel")}>
          {MENU_NAV.map(({ key, href }, index) => (
            <Link key={key} href={href} className="phone-menu__item" style={{ "--d": index } as CSSProperties}>
              <span className="phone-menu__number">{String(index + 1).padStart(2, "0")}</span>
              <span className="phone-menu__title">{t(`nav.${key}`)}</span>
              <ArrowRight {...ICON} aria-hidden />
            </Link>
          ))}
        </nav>
        <div className="phone-menu__contacts">
          {VODIY_HOUSE_PHONE ? <ContactRow icon={<Phone {...ICON} aria-hidden />} label={t("contacts.phone")} value={VODIY_HOUSE_PHONE} href={phoneHref(VODIY_HOUSE_PHONE)} /> : null}
          {VODIY_HOUSE_TELEGRAM ? <ContactRow icon={<Send {...ICON} aria-hidden />} label={t("contacts.telegram")} value={`@${VODIY_HOUSE_TELEGRAM}`} href={telegramHref(VODIY_HOUSE_TELEGRAM)} /> : null}
          <ContactRow icon={<MapPin {...ICON} aria-hidden />} label={t("contacts.officeLabel")} value={t("contacts.office")} />
        </div>
        <div className="phone-menu__settings">
          <LanguageSwitch variant="full" />
          <ThemeSegmented />
        </div>
        <div className="phone-menu__footer">
          {/* Кабинет — без префикса языка, поэтому обычный Link Next.js. */}
          <NextLink href={ADMIN_ROUTE}>{t("contacts.staffLogin")}</NextLink>
          <Link href={ROUTES.privacy}>{t("contacts.privacy")}</Link>
        </div>
      </div>
    </div>
  );
}
