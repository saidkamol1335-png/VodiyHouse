"use client";

import { Phone, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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

/**
 * Нижняя панель телефона (ТЗ 7.12, мокап .bb): «Позвонить» — общий номер Vodiy House, Telegram —
 * кружком. «Записаться на просмотр» встанет главной кнопкой вместе с заявками (шаг 3.7). Контакты —
 * только Vodiy House (правило 1.2); нет контактов — нет панели.
 */
export function ComplexBar() {
  const t = useTranslations("complex.offer");
  const { phone, telegram } = useSiteContacts();
  const shown = useScrolledPastFirstScreen();
  if (!phone && !telegram) return null;
  return (
    <>
      {/* Место под панелью внизу страницы: подвал не прячется под ней. */}
      <div className="complex-bar__spacer" aria-hidden="true" />
      <div className={shown ? "complex-bar complex-bar--shown" : "complex-bar"} aria-hidden={!shown}>
        {telegram ? (
          <a className="complex-bar__icon" href={telegramHref(telegram)} target="_blank" rel="noopener" aria-label={t("telegram")} tabIndex={shown ? 0 : -1}>
            <Send size={20} strokeWidth={1.8} aria-hidden />
          </a>
        ) : null}
        {phone ? (
          <a className="complex-bar__call" href={phoneHref(phone)} tabIndex={shown ? 0 : -1}>
            <Phone size={18} strokeWidth={1.9} aria-hidden />
            {t("call")}
          </a>
        ) : null}
      </div>
    </>
  );
}
