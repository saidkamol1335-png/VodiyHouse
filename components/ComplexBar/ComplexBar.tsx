"use client";

import { Phone, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useLeadOpener } from "@/components/LeadDialog";
import { useSiteContacts } from "@/components/SiteContacts";
import { TelegramButton } from "@/components/TelegramButton";
import { phoneHref } from "@/lib/contacts";

/** Запасной порог, если карточки цены на странице нет: первый экран ушёл наверх. */
const SHOW_AFTER_SCREENS = 0.9;
/** Высота шапки (токен --header-h): кнопки карточки цены «ушли», когда скрылись под ней (мокап .bb). */
const headerHeight = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;

/** Панель появляется, когда кнопки карточки цены ушли под шапку (мокап MobJk), — не раньше. */
function useScrolledPastOffer() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const cta = document.querySelector(".complex-offer__cta");
    if (!cta) {
      const check = () => setShown(window.scrollY > window.innerHeight * SHOW_AFTER_SCREENS);
      window.addEventListener("scroll", check, { passive: true });
      check();
      return () => window.removeEventListener("scroll", check);
    }
    const header = headerHeight();
    const observer = new IntersectionObserver(
      ([entry]) => setShown(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.bottom <= header)),
      { rootMargin: `-${header}px 0px 0px 0px` },
    );
    observer.observe(cta);
    return () => observer.disconnect();
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
  const { phone, telegram, bot } = useSiteContacts();
  const openLead = useLeadOpener();
  const shown = useScrolledPastOffer();
  if (!phone && !telegram && !bot && !openLead) return null;
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
        <TelegramButton object={{ complex: slug }} className="complex-bar__icon" aria-label={t("telegram")} tabIndex={shown ? 0 : -1}>
          <Send size={20} strokeWidth={1.8} aria-hidden />
        </TelegramButton>
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
