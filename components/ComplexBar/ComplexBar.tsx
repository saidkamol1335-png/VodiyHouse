"use client";

import { Phone, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useLeadOpener } from "@/components/LeadDialog";
import { useSiteContacts } from "@/components/SiteContacts";
import { phoneHref, telegramHref } from "@/lib/contacts";

/** Панель появляется, когда первый экран (фото и цена) ушёл наверх. */
const SHOW_AFTER_SCREENS = 0.9;

function useScrolledPastFirstScreen() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setShown(window.scrollY > window.innerHeight * SHOW_AFTER_SCREENS);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return shown;
}

type ComplexBarProps = { slug: string; name: string };

/**
 * Нижняя панель телефона (ТЗ 7.12, мокап .bb): «Позвонить» и Telegram Vodiy House кружками,
 * «Записаться на просмотр» — главной кнопкой. Контакты — только Vodiy House (правило 1.2).
 */
export function ComplexBar({ slug, name }: ComplexBarProps) {
  const t = useTranslations("complex.offer");
  const tLead = useTranslations("lead.buttons");
  const { phone, telegram } = useSiteContacts();
  const openLead = useLeadOpener();
  const shown = useScrolledPastFirstScreen();
  if (!phone && !telegram && !openLead) return null;
  return (
    <>
      {/* Место под панелью внизу страницы: подвал не прячется под ней. */}
      <div className="complex-bar__spacer" aria-hidden="true" />
      <div className={shown ? "complex-bar complex-bar--shown" : "complex-bar"} aria-hidden={!shown}>
        {phone ? (
          <a className="complex-bar__icon" href={phoneHref(phone)} aria-label={t("call")} tabIndex={shown ? 0 : -1}>
            <Phone size={20} strokeWidth={1.8} aria-hidden />
          </a>
        ) : null}
        {telegram ? (
          <a className="complex-bar__icon" href={telegramHref(telegram)} target="_blank" rel="noopener" aria-label={t("telegram")} tabIndex={shown ? 0 : -1}>
            <Send size={20} strokeWidth={1.8} aria-hidden />
          </a>
        ) : null}
        {openLead ? (
          <button
            type="button"
            className="complex-bar__book"
            tabIndex={shown ? 0 : -1}
            onClick={() => openLead({ type: "view", object: { complex: slug }, context: name })}
          >
            {tLead("view")}
          </button>
        ) : null}
      </div>
    </>
  );
}
