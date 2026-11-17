"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import type { LocalizedText } from "@/lib/contacts";
import type { Locale } from "@/lib/i18n/routing";
import { getMotionTier } from "@/lib/motion";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import { DetailViewer } from "./DetailViewer";

export type ComplexDetail = {
  id: string;
  slug: string;
  name: LocalizedText;
  text: LocalizedText;
  photo: CatalogPhoto | null;
};

const CARD_SIZES = "(max-width: 760px) 78vw, 360px";

/**
 * «Детали проекта» (ТЗ 7.7; правки 15.11, п. 22 — как «Особенности комплекса» на Cian): лента карточек
 * «фото + подпись» в порядке кабинета, свайп и стрелки; пункт без фото — карточка с текстом. Нажатие —
 * окно с большим фото и полным текстом, стрелки и счётчик «1 / N» (DetailViewer). Плавно листает
 * только full.
 */
export function ComplexDetails({ details, complexName }: { details: readonly ComplexDetail[]; complexName: string }) {
  const t = useTranslations("complex.details");
  const locale = useLocale() as Locale;
  const track = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const step = (by: -1 | 1) => {
    const node = track.current;
    const card = node?.querySelector<HTMLElement>(".complex-details__item");
    // Шаг — карточка и зазор ленты (column-gap из CSS, не числом здесь).
    const gap = node ? Number.parseFloat(getComputedStyle(node).columnGap) || 0 : 0;
    if (node && card) node.scrollBy({ left: by * (card.offsetWidth + gap), behavior: getMotionTier() === "full" ? "smooth" : "auto" });
  };
  return (
    <div className="complex-details">
      <ul ref={track} className="complex-details__track">
        {details.map((detail, index) => (
          <li key={detail.id} className="complex-details__item">
            <button type="button" className="complex-details__card" aria-label={t("open", { name: detail.name[locale] })} onClick={() => setOpen(index)}>
              {detail.photo ? (
                <SitePhoto photo={detail.photo} alt={detail.photo.alt?.[locale] || `${complexName} · ${detail.name[locale]}`} frame="card" sizes={CARD_SIZES} className="complex-details__photo" />
              ) : null}
              <span className="complex-details__caption">
                <b className="complex-details__name">{detail.name[locale]}</b>
                <span className={detail.photo ? "complex-details__text" : "complex-details__text complex-details__text--long"}>{detail.text[locale]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {details.length > 1 ? (
        <div className="complex-details__arrows">
          <button type="button" className="complex-details__arrow" aria-label={t("prev")} onClick={() => step(-1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className="complex-details__arrow" aria-label={t("next")} onClick={() => step(1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {open !== null ? <DetailViewer details={details} start={open} locale={locale} complexName={complexName} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
