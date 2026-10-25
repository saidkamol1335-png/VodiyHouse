"use client";

import { ChevronLeft, Heart, Menu, Phone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Ref } from "react";
import { HeaderNav } from "@/components/HeaderNav";
import { IconButton } from "@/components/IconButton";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/Logo";
import { PhoneButton } from "@/components/PhoneButton";
import { PhoneMenu } from "@/components/PhoneMenu";
import { useSiteContacts } from "@/components/SiteContacts";
import { TabletMenu } from "@/components/TabletMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { phoneHref } from "@/lib/contacts";
import { ROUTES } from "@/lib/routes";
import { useMenu, useScrolledPast } from "./useHeaderState";

type SiteHeaderProps = {
  /** Над обложкой шапка прозрачна и лежит поверх неё, после прокрутки — стекло (решение Э2). */
  transparentAtTop?: boolean;
  /** Телефон: шапка поверх фото — белые иконки на тёмных кружках (решение Ш6). */
  overPhoto?: boolean;
  /** Прозрачна только на телефоне (страница ЖК: фото под шапкой); на 1440 — сразу стекло. */
  transparentOnPhoneOnly?: boolean;
  /** Телефон: после прокрутки вместо «Vodiy House» — название страницы. */
  pageTitle?: string;
  /** Телефон: «назад» на внутренних страницах. */
  backHref?: string;
};

const ICON = { size: 20, strokeWidth: 1.7 } as const;
const MENU_ID = "site-menu";

function headerClasses(solid: boolean, transparentAtTop: boolean, overPhoto: boolean, phoneOnly: boolean): string {
  const classes = ["site-header"];
  if (solid) classes.push("site-header--solid");
  if (transparentAtTop) classes.push("site-header--transparent");
  if (transparentAtTop && phoneOnly) classes.push("site-header--phone-only");
  if (overPhoto && !solid) classes.push("site-header--over-photo");
  return classes.join(" ");
}

export function SiteHeader({ transparentAtTop = false, overPhoto = false, transparentOnPhoneOnly = false, pageTitle, backHref }: SiteHeaderProps) {
  const { sentinel, scrolled } = useScrolledPast();
  const { open: menuOpen, close: closeMenu, toggle: toggleMenu, toggleButton } = useMenu();
  const solid = scrolled || !transparentAtTop || menuOpen;
  return (
    <>
      <div ref={sentinel} className="site-header__sentinel" aria-hidden="true" />
      <header className={headerClasses(solid, transparentAtTop, overPhoto, transparentOnPhoneOnly)}>
        <div className="site-header__inner">
          <HeaderBrand backHref={backHref} pageTitle={pageTitle} showTitle={Boolean(pageTitle) && scrolled} />
          <HeaderNav />
          <HeaderTools ref={toggleButton} menuOpen={menuOpen} onToggleMenu={toggleMenu} />
        </div>
        {menuOpen ? <TabletMenu id={MENU_ID} onNavigate={closeMenu} /> : null}
      </header>
      {menuOpen ? <PhoneMenu id={`${MENU_ID}-phone`} onClose={closeMenu} /> : null}
    </>
  );
}

type HeaderBrandProps = { backHref?: string; pageTitle?: string; showTitle: boolean };

/** «Назад», логотип и название страницы (телефон после прокрутки) — без обёртки: порядок в строке шапки. */
function HeaderBrand({ backHref, pageTitle, showTitle }: HeaderBrandProps) {
  const t = useTranslations("header");
  return (
    <>
      {backHref ? (
        <IconButton className="site-header__icon site-header__back" label={t("back")} href={backHref}>
          <ChevronLeft {...ICON} aria-hidden />
        </IconButton>
      ) : null}
      <Logo hideText={showTitle} className="site-header__logo" />
      {pageTitle ? (
        <span className={showTitle ? "site-header__title site-header__title--visible" : "site-header__title"} aria-hidden={!showTitle}>
          {pageTitle}
        </span>
      ) : null}
    </>
  );
}

type HeaderToolsProps = {
  menuOpen: boolean;
  onToggleMenu: () => void;
  /** Кнопка меню: на неё возвращается фокус после Escape (useMenu). */
  ref: Ref<HTMLButtonElement>;
};

function HeaderTools({ menuOpen, onToggleMenu, ref }: HeaderToolsProps) {
  const t = useTranslations("header");
  return (
    <div className="site-header__tools">
      <div className="site-header__wide-only">
        <LanguageSwitch />
        <ThemeToggle />
      </div>
      <IconButton className="site-header__icon" label={t("favorites")} href={ROUTES.favorites}>
        <Heart {...ICON} aria-hidden />
      </IconButton>
      <HeaderPhone />
      <IconButton
        ref={ref}
        className="site-header__icon site-header__menu-button"
        label={menuOpen ? t("closeMenu") : t("openMenu")}
        onClick={onToggleMenu}
        expanded={menuOpen}
        controls={MENU_ID}
      >
        {menuOpen ? <X {...ICON} aria-hidden /> : <Menu {...ICON} aria-hidden />}
      </IconButton>
    </div>
  );
}

/** Телефон Vodiy House (правило ТЗ 1.2) — только когда он введён в «Настройки → Контакты». */
function HeaderPhone() {
  const t = useTranslations("header");
  const { phone } = useSiteContacts();
  if (!phone) return null;
  return (
    <>
      <PhoneButton phone={phone} className="site-header__phone" />
      <IconButton className="site-header__icon site-header__call" label={t("call")} href={phoneHref(phone)} external>
        <Phone {...ICON} aria-hidden />
      </IconButton>
    </>
  );
}
