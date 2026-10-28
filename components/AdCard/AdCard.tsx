"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { LeadButton } from "@/components/LeadDialog";
import { SitePhoto } from "@/components/SitePhoto";
import { formatPrice } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import type { AdView, ShowcaseComplexRef } from "@/lib/site/showcase/model";
import { useAdView } from "./useAdView";

const SIZES = "(max-width: 980px) 100vw, 640px";
/** Чипов ЖК в карточке, дальше «ещё N» (в мокапе — два). */
const CHIPS_MAX = 4;

/**
 * Карточка рекламы на главной (3.16б, мокап .adb, Г1 A): фото или обложка первого ЖК с пометкой
 * «Реклама», застройщик, заголовок и текст, «В продаже · Цена от · Платёж от» из каталога, чипы ЖК,
 * «Показать N квартир» и «Хочу это условие» → заявка promo. Показ и клики — события ad_view / ad_click.
 */
export function AdCard({ view }: { view: AdView }) {
  const t = useTranslations("showcase");
  const locale = useLocale() as Locale;
  const card = useRef<HTMLElement>(null);
  useAdView(card, view.ad.id);
  const title = view.ad.title[locale];
  const text = view.ad.text?.[locale];
  return (
    <article ref={card} className="ad-card" data-track-entity={`ad:${view.ad.id}`} aria-label={t("ad.label", { title })}>
      <div className="ad-card__media">
        {view.cover ? <SitePhoto photo={view.cover} alt="" frame="card" sizes={SIZES} className="ad-card__photo" /> : null}
        <span className="ad-card__tag">{t("ad.tag")}</span>
      </div>
      <div className="ad-card__body">
        <p className="ad-card__developer">{view.ad.developer.name}</p>
        <h3 className="ad-card__title">{title}</h3>
        {text ? <p className="ad-card__text">{text}</p> : null}
        <AdFacts view={view} />
        <AdChips complexes={view.complexes} />
        <div className="ad-card__buttons">
          <Link href={view.href} className="button button--primary ad-card__show" data-track="ad_click">
            {view.count.flats > 0 ? t("ad.show", { n: view.count.flats }) : t("ad.showComplexes", { n: view.count.complexes })}
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Link>
          <LeadButton intent={{ type: "promo", object: { developer: view.ad.developer.slug }, context: title, promo: { title } }} variant="outline" />
        </div>
      </div>
    </article>
  );
}

/** «В продаже · Цена от · Платёж от» (мокап .adb__facts) — по ЖК рекламы, как на карточках каталога. */
function AdFacts({ view }: { view: AdView }) {
  const t = useTranslations("showcase");
  const locale = useLocale() as Locale;
  const { count, price, payment } = view;
  const flats = count.flats > 0 ? t(count.partial ? "ad.flatsMin" : "ad.flats", { n: count.flats }) : t("ad.complexes", { n: count.complexes });
  return (
    <dl className="ad-card__facts">
      <div className="ad-card__fact">
        <dt>{t("ad.inSale")}</dt>
        <dd>{flats}</dd>
      </div>
      <div className="ad-card__fact">
        <dt>{t("ad.price")}</dt>
        <dd>{price ? t("ad.from", { price: formatPrice(price.amount, price.currency, locale) }) : t("ad.onRequest")}</dd>
      </div>
      {payment ? (
        <div className="ad-card__fact">
          <dt>{t("ad.payment")}</dt>
          <dd className="ad-card__fact-value--accent">{t("ad.monthly", { price: formatPrice(payment.amount, payment.currency, locale) })}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/** Чипы «ЖК Shodlik · Фергана →» (мокап .adb__jks): ведут на страницу ЖК, считаются кликом по рекламе. */
function AdChips({ complexes }: { complexes: readonly ShowcaseComplexRef[] }) {
  const t = useTranslations("showcase");
  const locale = useLocale() as Locale;
  if (complexes.length === 0) return null;
  const shown = complexes.slice(0, CHIPS_MAX);
  return (
    <ul className="ad-card__complexes">
      {shown.map((complex) => (
        <li key={complex.id}>
          <Link href={complexRoute(complex.slug)} className="ad-card__chip" data-track="ad_click">
            {[t("complex", { name: complex.name[locale] }), complex.location?.[locale]].filter(Boolean).join(" · ")}
            <ArrowRight size={12} strokeWidth={2} aria-hidden />
          </Link>
        </li>
      ))}
      {complexes.length > shown.length ? <li className="ad-card__chip ad-card__chip--more">{t("ad.more", { n: complexes.length - shown.length })}</li> : null}
    </ul>
  );
}
