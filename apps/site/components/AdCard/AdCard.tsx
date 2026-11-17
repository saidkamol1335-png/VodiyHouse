"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LeadButton } from "@/components/LeadDialog";
import { SitePhoto } from "@/components/SitePhoto";
import { formatPrice } from "@vh/shared/format";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import type { AdView, ShowcaseComplexRef } from "@/lib/site/showcase/model";
import { useSpotlight } from "@/components/Spotlight";

const SIZES = "(max-width: 980px) 100vw, 640px";
/** Чипов ЖК в карточке, дальше «ещё N» (в мокапе — два). */
const CHIPS_MAX = 4;

/**
 * Своя реклама Vodiy House на главной (3.16б, мокап .adb; с правок 15.11 реклама застройщика — баннер,
 * AdBanner): обложка первого ЖК с пометкой «Реклама», заголовок и текст, «В продаже · Цена от · Платёж
 * от» из каталога, чипы ЖК, «Показать N квартир» и «Хочу это условие» → заявка promo. Без событий
 * ad_view / ad_click: у своей рекламы нет записи в ads.
 */
export function AdCard({ view }: { view: AdView }) {
  const spotlight = useSpotlight();
  const t = useTranslations("showcase");
  const locale = useLocale() as Locale;
  const title = view.ad.title[locale];
  const text = view.ad.text?.[locale];
  return (
    // Подсветка за курсором (мокап .adb.spot): только full и только мышь — решает CSS .spotlight.
    <article className="ad-card spotlight" onPointerMove={spotlight} aria-label={t("ad.label", { title })}>
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
          <Link href={view.href} className="button button--primary ad-card__show">
            {view.count.flats > 0 ? t("ad.show", { n: view.count.flats }) : t("ad.showComplexes", { n: view.count.complexes })}
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Link>
          <LeadButton intent={{ type: "promo", object: view.ad.developer.slug ? { developer: view.ad.developer.slug } : {}, context: title, promo: { title } }} variant="outline" />
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

/** Чипы «ЖК Shodlik · Фергана →» (мокап .adb__jks): ведут на страницу ЖК. */
function AdChips({ complexes }: { complexes: readonly ShowcaseComplexRef[] }) {
  const t = useTranslations("showcase");
  const locale = useLocale() as Locale;
  if (complexes.length === 0) return null;
  const shown = complexes.slice(0, CHIPS_MAX);
  return (
    <ul className="ad-card__complexes">
      {shown.map((complex) => (
        <li key={complex.id}>
          <Link href={complexRoute(complex.slug)} className="ad-card__chip">
            {[t("complex", { name: complex.name[locale] }), complex.location?.[locale]].filter(Boolean).join(" · ")}
            <ArrowRight size={12} strokeWidth={2} aria-hidden />
          </Link>
        </li>
      ))}
      {complexes.length > shown.length ? <li className="ad-card__chip ad-card__chip--more">{t("ad.more", { n: complexes.length - shown.length })}</li> : null}
    </ul>
  );
}
