"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import type { LocalizedText } from "@/lib/contacts";
import type { Locale } from "@/lib/i18n/routing";
import { getMotionTier } from "@/lib/motion";
import type { CatalogPhoto } from "@/lib/site/catalog/records";

export type ComplexDetail = {
  slug: string;
  name: LocalizedText;
  text: LocalizedText;
  photo: CatalogPhoto | null;
};

/** Карточка показывает начало текста; длиннее — «Читать далее» (ТЗ 7.7: ~300 знаков). */
const PREVIEW_CHARS = 300;

/**
 * «Детали проекта» (Ф4, ТЗ 7.7): карусель карточек тем (заголовок, фото, начало текста) со стрелками
 * ‹ ›, «Читать далее» — весь текст в окне поверх страницы. Темы и порядок — справочник кабинета.
 */
export function ComplexDetails({ details }: { details: readonly ComplexDetail[] }) {
  const t = useTranslations("complex.details");
  const locale = useLocale() as Locale;
  const track = useRef<HTMLUListElement>(null);
  const [reading, setReading] = useState<ComplexDetail | null>(null);
  const scroll = (step: number) => {
    const node = track.current;
    const card = node?.firstElementChild as HTMLElement | null;
    if (node && card)
      node.scrollBy({
        left: step * (card.offsetWidth + 14),
        behavior: getMotionTier() === "full" ? "smooth" : "auto",
      });
  };
  return (
    <div className="complex-details">
      {details.length > 1 ? (
        <div className="complex-details__arrows">
          <button type="button" className="complex-details__arrow" aria-label={t("prev")} onClick={() => scroll(-1)}>
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button type="button" className="complex-details__arrow" aria-label={t("next")} onClick={() => scroll(1)}>
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      ) : null}
      <ul ref={track} className="complex-details__track">
        {details.map((detail) => (
          <DetailCard key={detail.slug} detail={detail} locale={locale} onRead={() => setReading(detail)} />
        ))}
      </ul>
      {reading ? <DetailDialog detail={reading} locale={locale} onClose={() => setReading(null)} /> : null}
    </div>
  );
}

/** Карточка темы: фото, заголовок, начало текста; длиннее ~300 знаков — «Читать далее». */
function DetailCard({ detail, locale, onRead }: { detail: ComplexDetail; locale: Locale; onRead: () => void }) {
  const t = useTranslations("complex.details");
  const text = detail.text[locale];
  const long = text.length > PREVIEW_CHARS;
  return (
    <li className="complex-details__card">
      {detail.photo ? <SitePhoto photo={detail.photo} alt="" frame="card" sizes="(max-width: 760px) 80vw, 360px" className="complex-details__photo" /> : null}
      <h3 className="complex-details__name">{detail.name[locale]}</h3>
      <p className="complex-details__text">{long ? `${text.slice(0, PREVIEW_CHARS).trimEnd()}…` : text}</p>
      {long ? (
        <button type="button" className="complex-details__more" onClick={onRead}>
          {t("readMore")}
        </button>
      ) : null}
    </li>
  );
}

function DetailDialog({ detail, locale, onClose }: { detail: ComplexDetail; locale: Locale; onClose: () => void }) {
  const t = useTranslations("complex.details");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="complex-details__dialog" aria-label={detail.name[locale]} onClose={onClose}>
      <button type="button" className="complex-details__close" aria-label={t("close")} onClick={() => dialog.current?.close()} autoFocus>
        <X size={20} aria-hidden />
      </button>
      {detail.photo ? (
        <SitePhoto photo={detail.photo} alt="" frame="cover" sizes="(max-width: 760px) 100vw, 720px" className="complex-details__dialog-photo" />
      ) : null}
      <h3 className="complex-details__dialog-title">{detail.name[locale]}</h3>
      <p className="complex-details__dialog-text">{detail.text[locale]}</p>
    </dialog>
  );
}
