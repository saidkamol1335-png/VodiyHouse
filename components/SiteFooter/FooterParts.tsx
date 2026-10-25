"use client";

import { Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useNavItems } from "@/components/HiddenNav";
import { useSiteContacts } from "@/components/SiteContacts";
import { formatPhone, instagramHref, phoneHref, telegramHref } from "@/lib/contacts";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { FOOTER_NAV } from "@/lib/routes";

/** «Каталог»: скрытые сейчас пункты (нет застройщиков с программами — «Калькулятор») — мимо. */
export function FooterCatalog() {
  const t = useTranslations("nav");
  const items = useNavItems(FOOTER_NAV);
  return items.map(({ key, href }) => (
    <Link key={key} href={href} className="site-footer__link">
      {t(key)}
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

/** «vodiyhouse.uz/ru · Скопировать»: адрес — домен сайта на языке страницы, где бы он ни был открыт. */
export function FooterCopyUrl() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const [state, setState] = useState<CopyState>("idle");
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
      <span className="site-footer__url">vodiyhouse.uz/{locale}</span>
      <button type="button" className="site-footer__copy-button" onClick={copy}>
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
