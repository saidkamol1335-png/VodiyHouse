"use client";

import { ArrowRight, AtSign, ChevronRight, Clock, MapPin, Phone, Send, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import NextLink from "next/link";
import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LogoMark } from "@/components/Logo";
import { ThemeSegmented } from "@/components/ThemeToggle";
import { useSiteContacts } from "@/components/SiteContacts";
import { formatPhone, instagramHref, phoneHref, telegramHref } from "@/lib/contacts";
import { isActivePath } from "@/components/HeaderNav";
import { useNavItems } from "@/components/HiddenNav";
import { Link, usePathname } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { ADMIN_ROUTE, MENU_NAV, ROUTES } from "@/lib/routes";

type PhoneMenuProps = {
  id: string;
  onClose: () => void;
};

const ICON = { size: 20, strokeWidth: 1.8 } as const;

type ContactRowProps = { icon: ReactNode; label: string; value: string; href?: string };

function ContactRow({ icon, label, value, href }: ContactRowProps) {
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

/** Меню телефона на весь экран (решение Ш5): пункты 01–0N, контакты Vodiy House, язык, тема. */
export function PhoneMenu({ id, onClose }: PhoneMenuProps) {
  const t = useTranslations();
  // Любая ссылка внутри меню уводит со страницы — меню закрываем.
  const closeOnLink = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a")) onClose();
  };
  return (
    <div id={id} className="phone-menu" role="dialog" aria-modal="true" aria-label={t("header.menu")} onClick={closeOnLink}>
      <PhoneMenuHead onClose={onClose} />
      <div className="phone-menu__body">
        <PhoneMenuNav />
        <PhoneMenuContacts />
        <div className="phone-menu__settings">
          <LanguageSwitch variant="full" />
          <ThemeSegmented />
        </div>
        <div className="phone-menu__footer">
          {/* Кабинет — без префикса языка, поэтому обычный Link Next.js. */}
          <NextLink href={ADMIN_ROUTE} prefetch={false}>{t("contacts.staffLogin")}</NextLink>
          <Link href={ROUTES.privacy}>{t("contacts.privacy")}</Link>
        </div>
      </div>
    </div>
  );
}

/** Логотип и «Закрыть»: при открытии фокус — на «Закрыть» (диалог на весь экран). */
function PhoneMenuHead({ onClose }: { onClose: () => void }) {
  const t = useTranslations("header");
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButton.current?.focus(), []);
  return (
    <div className="phone-menu__head">
      <Link href={ROUTES.home} className="logo" aria-label={t("home")}>
        <LogoMark />
        <span className="logo__text">Vodiy House</span>
      </Link>
      <button ref={closeButton} type="button" className="icon-button phone-menu__close" aria-label={t("closeMenu")} onClick={onClose}>
        <X {...ICON} aria-hidden />
      </button>
    </div>
  );
}

function PhoneMenuNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const items = useNavItems(MENU_NAV);
  return (
    <nav aria-label={t("header.navLabel")}>
      {items.map(({ key, href }, index) => (
        <Link
          key={key}
          href={href}
          className="phone-menu__item"
          style={{ "--d": index } as CSSProperties}
          aria-current={isActivePath(pathname, href) ? "page" : undefined}
        >
          <span className="phone-menu__number">{String(index + 1).padStart(2, "0")}</span>
          <span className="phone-menu__title">{t(`nav.${key}`)}</span>
          <ArrowRight {...ICON} aria-hidden />
        </Link>
      ))}
    </nav>
  );
}

/** Только контакты Vodiy House (правило ТЗ 1.2); не введённых в «Настройки → Контакты» — строк нет. */
function PhoneMenuContacts() {
  const t = useTranslations("contacts");
  const locale = useLocale() as Locale;
  const { phone, telegram, instagram, hours } = useSiteContacts();
  return (
    <div className="phone-menu__contacts">
      {phone ? <ContactRow icon={<Phone {...ICON} aria-hidden />} label={t("phone")} value={formatPhone(phone)} href={phoneHref(phone)} /> : null}
      {telegram ? <ContactRow icon={<Send {...ICON} aria-hidden />} label={t("telegram")} value={`@${telegram}`} href={telegramHref(telegram)} /> : null}
      {instagram ? <ContactRow icon={<AtSign {...ICON} aria-hidden />} label={t("instagram")} value={`@${instagram}`} href={instagramHref(instagram)} /> : null}
      {hours ? <ContactRow icon={<Clock {...ICON} aria-hidden />} label={t("hours")} value={hours[locale]} /> : null}
      <ContactRow icon={<MapPin {...ICON} aria-hidden />} label={t("officeLabel")} value={t("office")} />
    </div>
  );
}
