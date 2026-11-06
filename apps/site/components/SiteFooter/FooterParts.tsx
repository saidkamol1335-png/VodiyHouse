"use client";

import { Clock, Copy, MapPin, Phone, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useNavItems } from "@/components/HiddenNav";
import { LeadButton } from "@/components/LeadDialog";
import { RollText } from "@/components/RollText";
import { useSiteContacts } from "@/components/SiteContacts";
import { formatPhone, instagramHref, phoneHref, telegramHref } from "@/lib/contacts";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { FOOTER_NAV } from "@/lib/routes";

/** «Каталог» (мокап .ftr__l .rh — перекат букв, как в шапке): скрытые сейчас пункты — мимо. */
export function FooterCatalog() {
  const t = useTranslations("nav");
  const items = useNavItems(FOOTER_NAV);
  return items.map(({ key, href }) => (
    <Link key={key} href={href} className="site-footer__link roll-trigger">
      <RollText text={t(key)} />
    </Link>
  ));
}

/** Instagram — своим контуром: в lucide 1.x знаков брендов нет. */
function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

/**
 * «Контакты» с иконками (Hover Footer, ТЗ 4.2): только Vodiy House (правило ТЗ 1.2); не введённых в
 * «Настройки → Контакты» — строк нет. Telegram — аккаунт, а без него бот. «Перезвоните мне» есть
 * всегда (06.11.2026): связаться с Vodiy House можно и без введённых контактов.
 */
export function FooterContacts() {
  const t = useTranslations("contacts");
  const locale = useLocale() as Locale;
  const { phone, instagram, hours, ...rest } = useSiteContacts();
  const telegram = rest.telegram ?? rest.bot;
  return (
    <ul className="site-footer__contacts">
      {phone ? (
        <li>
          <Phone size={18} aria-hidden="true" />
          <a className="site-footer__link" href={phoneHref(phone)}>
            {formatPhone(phone)}
          </a>
        </li>
      ) : null}
      {telegram ? (
        <li>
          <Send size={18} aria-hidden="true" />
          <a className="site-footer__link" href={telegramHref(telegram)}>
            Telegram @{telegram}
          </a>
        </li>
      ) : null}
      {instagram ? (
        <li>
          <InstagramIcon />
          <a className="site-footer__link" href={instagramHref(instagram)}>
            Instagram @{instagram}
          </a>
        </li>
      ) : null}
      <li>
        <MapPin size={18} aria-hidden="true" />
        <span>{t("office")}</span>
      </li>
      {hours ? (
        <li>
          <Clock size={18} aria-hidden="true" />
          <span className="site-footer__muted">{hours[locale]}</span>
        </li>
      ) : null}
      <FooterCallback />
    </ul>
  );
}

/** «Перезвоните мне» — всегда, и без введённых контактов (ТЗ 1.2: кнопки связи ведут на Vodiy House). */
function FooterCallback() {
  const t = useTranslations("contacts");
  return (
    <li className="site-footer__callback">
      <LeadButton intent={{ type: "callback" }} variant="outline" size="sm">
        {t("callback")}
      </LeadButton>
    </li>
  );
}

/** Соцсети под чертой (Hover Footer): только введённые Telegram (или бот) и Instagram Vodiy House. */
export function FooterSocials() {
  const { instagram, ...rest } = useSiteContacts();
  const telegram = rest.telegram ?? rest.bot;
  if (!telegram && !instagram) return <span />;
  return (
    <div className="site-footer__socials">
      {telegram ? (
        <a className="site-footer__social" href={telegramHref(telegram)} aria-label="Telegram">
          <Send size={20} aria-hidden="true" />
        </a>
      ) : null}
      {instagram ? (
        <a className="site-footer__social" href={instagramHref(instagram)} aria-label="Instagram">
          <InstagramIcon size={20} />
        </a>
      ) : null}
    </div>
  );
}

type CopyState = "idle" | "copied" | "failed";

const LABEL = { idle: "copyUrl", copied: "copied", failed: "copyFailed" } as const satisfies Record<
  CopyState,
  string
>;
/** Через столько подпись кнопки возвращается к «Скопировать» — второе нажатие снова слышно диктору. */
const COPY_STATUS_MS = 2500;
const URL_ID = "site-footer-url";

/**
 * «vodiyhouse.uz/ru · Скопировать»: в буфер — адрес текущего домена на языке страницы (до запуска
 * vodiyhouse.uz не открывается, на тестовом деплое ссылка ведёт на него же).
 */
export function FooterCopyUrl() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), COPY_STATUS_MS);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    const url = `${window.location.origin}/${locale}`;
    const copied = await navigator.clipboard?.writeText(url).then(
      () => true,
      () => false,
    );
    setState(copied ? "copied" : "failed");
  };
  return (
    <div className="site-footer__copy">
      <span id={URL_ID} className="site-footer__url">
        vodiyhouse.uz/{locale}
      </span>
      <button
        type="button"
        className="site-footer__copy-button"
        onClick={copy}
        aria-describedby={URL_ID}
      >
        <Copy size={14} strokeWidth={1.9} aria-hidden />
        {t(LABEL[state])}
      </button>
      {/* Итог копирования — диктору; на экране его видно по подписи кнопки. */}
      <span className="sr-only" role="status">
        {state === "idle" ? null : t(LABEL[state])}
      </span>
    </div>
  );
}
