"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type RefObject, useEffect, useRef, useState } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import type { LocalizedText } from "@/lib/contacts";
import type { Locale } from "@/lib/i18n/routing";
import { getMotionTier } from "@/lib/motion";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import { flipFrom } from "./geometry";
import { type DetailLens, useDetailLens } from "./useDetailLens";

export type ComplexDetail = {
  slug: string;
  name: LocalizedText;
  text: LocalizedText;
  photo: CatalogPhoto | null;
};

/** Колонок на наклонной плоскости и копий тем в колонке: образец — 4 × 3; стена шире образца — 6 колонок. */
const COLUMNS = 6;
const REPEAT = 3;
/** Начало текста на маленькой карточке стены (полный — в крупной карточке и окне). */
const QUOTE_CHARS = 90;
const FLIP_MS = 460;

type Reading = { detail: ComplexDetail; origin: DOMRect | null };
type Read = (detail: ComplexDetail, origin: Element | null) => void;

/**
 * «Детали проекта» (Ф4, ТЗ 7.7) — 3D Testimonials (@sean0205, MIT): рамка с перспективой 300px, колонки
 * карточек тем на наклонной плоскости бегут вверх и вниз (40 с, как в образце; слово исполнителя 04.11:
 * «шире и анимируй»), колонка под мышью встаёт; края стены тают маской, без рамки. Под мышью над карточкой вырастает крупная ровная карточка с полным
 * текстом — удобно читать (useDetailLens); нажатие — весь текст в окне. Темы — справочник кабинета.
 */
export function ComplexDetails({ details, complexName }: { details: readonly ComplexDetail[]; complexName: string }) {
  const locale = useLocale() as Locale;
  const root = useRef<HTMLDivElement>(null);
  const lensLayer = useRef<HTMLDivElement>(null);
  const lens = useDetailLens(root, lensLayer);
  const [reading, setReading] = useState<Reading | null>(null);
  const read: Read = (detail, origin) => {
    lens.close();
    setReading({ detail, origin: origin?.getBoundingClientRect() ?? null });
  };
  const lensed = lens.index === null ? null : details[lens.index];
  return (
    <div ref={root} className="complex-details" data-lens={lensed ? "open" : undefined} data-float={lensed ? "" : undefined}>
      <div className="complex-details__frame">
        <div className="complex-details__plane">
          {Array.from({ length: COLUMNS }, (_, column) => (
            <DetailColumn key={column} column={column} details={details} locale={locale} complexName={complexName} lens={lens} onRead={read} />
          ))}
        </div>
      </div>
      <DetailKeys details={details} locale={locale} onRead={read} />
      {lens.enabled ? <DetailLensLayer layer={lensLayer} detail={lensed} locale={locale} complexName={complexName} lens={lens} onRead={read} /> : null}
      {reading ? <DetailDialog reading={reading} locale={locale} onClose={() => setReading(null)} /> : null}
    </div>
  );
}

type ColumnProps = { column: number; details: readonly ComplexDetail[]; locale: Locale; complexName: string; lens: DetailLens; onRead: Read };

/**
 * Колонка образца (Marquee vertical, repeat 3): чётные бегут вниз (reverse), под мышью — стоп. Порядок тем сдвинут на номер колонки —
 * рядом не одна и та же. Стена — для мыши: на наклонной плоскости видна только середина колонок, поэтому
 * клавиатура и диктор читают темы ровным списком DetailKeys.
 */
function DetailColumn({ column, details, locale, complexName, lens, onRead }: ColumnProps) {
  const order = details.map((_, index) => (index + column) % details.length);
  return (
    <div className="complex-details__column">
      {Array.from({ length: REPEAT }, (_, copy) => (
        <div key={copy} className="complex-details__copy">
          {order.map((index) => {
            const detail = details[index];
            if (!detail) return null;
            return <DetailCard key={detail.slug} detail={detail} index={index} locale={locale} complexName={complexName} lens={lens} onRead={onRead} />;
          })}
        </div>
      ))}
    </div>
  );
}

type DetailCardProps = { detail: ComplexDetail; index: number; locale: Locale; complexName: string; lens: DetailLens; onRead: Read };

const quoteOf = (text: string) => (text.length > QUOTE_CHARS ? `${text.slice(0, QUOTE_CHARS).trimEnd()}…` : text);

/** Голова карточки образца: аватар (фото темы или буква), имя — тема, @username — ЖК. */
function CardHead({ detail, locale, complexName, size }: { detail: ComplexDetail; locale: Locale; complexName: string; size: number }) {
  const name = detail.name[locale];
  return (
    <span className="complex-details__head">
      <span className="complex-details__avatar">
        {detail.photo ? <SitePhoto photo={detail.photo} alt="" frame="card" sizes={`${size}px`} className="complex-details__avatar-photo" /> : name.slice(0, 1)}
      </span>
      <span className="complex-details__who">
        <span className="complex-details__name">{name}</span>
        <span className="complex-details__user">{complexName}</span>
      </span>
    </span>
  );
}

/** Карточка образца (shadcn Card w-50): голова и начало текста; нажатие — весь текст в окне. */
function DetailCard({ detail, index, locale, complexName, lens, onRead }: DetailCardProps) {
  return (
    <button
      type="button"
      className="complex-details__card"
      aria-hidden="true"
      tabIndex={-1}
      data-lensed={lens.index === index ? "" : undefined}
      onPointerMove={(event) => lens.hover(index, event)}
      onPointerLeave={lens.leave}
      onClick={(event) => onRead(detail, event.currentTarget)}
    >
      <CardHead detail={detail} locale={locale} complexName={complexName} size={36} />
      <span className="complex-details__quote">{quoteOf(detail.text[locale])}</span>
    </button>
  );
}

/**
 * Темы для клавиатуры и диктора: скрытый ровный список кнопок; при фокусе с клавиатуры показывается
 * под стеной (видимое кольцо фокуса), Enter — весь текст в окне.
 */
function DetailKeys({ details, locale, onRead }: { details: readonly ComplexDetail[]; locale: Locale; onRead: Read }) {
  return (
    <ul className="complex-details__keys">
      {details.map((detail) => (
        <li key={detail.slug}>
          <button type="button" className="complex-details__key" onClick={(event) => onRead(detail, event.currentTarget)}>
            {detail.name[locale]}
          </button>
        </li>
      ))}
    </ul>
  );
}

type DetailLensLayerProps = {
  layer: RefObject<HTMLDivElement | null>;
  detail: ComplexDetail | null | undefined;
  locale: Locale;
  complexName: string;
  lens: DetailLens;
  onRead: Read;
};

/**
 * Крупная ровная карточка над наклонной: та же карточка образца, но с полным текстом — для мыши,
 * скрыта от диктора (тот же текст — в окне), клик открывает окно.
 */
function DetailLensLayer({ layer, detail, locale, complexName, lens, onRead }: DetailLensLayerProps) {
  return (
    <div
      ref={layer}
      className="complex-details__lens"
      aria-hidden="true"
      data-open={detail ? "" : undefined}
      onPointerEnter={lens.keep}
      onPointerLeave={lens.leave}
      onClick={(event) => (detail ? onRead(detail, event.currentTarget) : undefined)}
    >
      {detail ? (
        <div key={detail.slug} className="complex-details__lens-in">
          <CardHead detail={detail} locale={locale} complexName={complexName} size={48} />
          <p className="complex-details__lens-text">{detail.text[locale]}</p>
        </div>
      ) : null}
    </div>
  );
}

function DetailDialog({ reading, locale, onClose }: { reading: Reading; locale: Locale; onClose: () => void }) {
  const t = useTranslations("complex.details");
  const dialog = useRef<HTMLDialogElement>(null);
  const { detail, origin } = reading;
  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    element.showModal();
    const tier = getMotionTier();
    if (tier === "none") return;
    const keyframes =
      tier === "full" && origin
        ? [{ transform: flipFrom(origin, element.getBoundingClientRect()), opacity: 0.4 }, { transform: "none", opacity: 1 }]
        : [{ opacity: 0 }, { opacity: 1 }];
    element.animate(keyframes, { duration: tier === "full" ? FLIP_MS : 180, easing: "cubic-bezier(0.19, 1, 0.22, 1)" });
  }, [origin]);
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
