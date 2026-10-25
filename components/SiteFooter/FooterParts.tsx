"use client";

import { Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useNavItems } from "@/components/HiddenNav";
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

/** Только контакты Vodiy House (правило ТЗ 1.2): не введённых в «Настройки → Контакты» — строк нет. */
export function FooterContacts() {
  const t = useTranslations("contacts");
  const locale = useLocale() as Locale;
  const { phone, telegram, instagram, hours } = useSiteContacts();
  return (
    <>
      {phone ? <a className="site-footer__link" href={phoneHref(phone)}>{formatPhone(phone)}</a> : null}
      {telegram ? <a className="site-footer__link" href={telegramHref(telegram)}>Telegram @{telegram}</a> : null}
      {instagram ? <a className="site-footer__link" href={instagramHref(instagram)}>Instagram @{instagram}</a> : null}
      <span>{t("office")}</span>
      {hours ? <span className="site-footer__muted">{hours[locale]}</span> : null}
    </>
  );
}

type CopyState = "idle" | "copied" | "failed";

const LABEL = { idle: "copyUrl", copied: "copied", failed: "copyFailed" } as const satisfies Record<CopyState, string>;
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
      <span id={URL_ID} className="site-footer__url">vodiyhouse.uz/{locale}</span>
      <button type="button" className="site-footer__copy-button" onClick={copy} aria-describedby={URL_ID}>
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
