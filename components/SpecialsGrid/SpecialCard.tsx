"use client";

import { ArrowRight, Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LeadButton } from "@/components/LeadDialog";
import { SitePhoto } from "@/components/SitePhoto";
import { formatDate, formatPrice } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import type { SpecialView } from "@/lib/site/showcase/model";

const SIZES = "(max-width: 760px) 300px, (max-width: 1180px) 50vw, 420px";
/** «ещё N дней» подсвечивается, когда осталось три дня и меньше. */
const HOT_DAYS = 3;

/**
 * Карточка спецпредложения (мокап .spc, MobSpecials): бейдж из базы на фото, «ещё N дней»,
 * застройщик, заголовок, текст, «ЖК · город →» (несколько — «N ЖК» → подборка), «от $…» по самому
 * дешёвому ЖК, «Хочу это условие» → заявка promo, «до дд.мм.гггг». Без скидок (PLAN §3.13).
 */
export function SpecialCard({ view }: { view: SpecialView }) {
  const t = useTranslations("showcase");
  const locale = useLocale() as Locale;
  const { special, complexes, price } = view;
  const title = special.title[locale];
  const text = special.text?.[locale];
  const [first] = complexes;
  const complexLabel =
    complexes.length === 1 && first
      ? [t("complex", { name: first.name[locale] }), first.location?.[locale]].filter(Boolean).join(" · ")
      : t("special.complexes", { n: complexes.length });
  return (
    <article className="special-card" data-special={special.id}>
      {/* Фото ведёт туда же, куда ссылка «ЖК · город →» ниже: диктору и клавиатуре — одна ссылка, не две. */}
      <Link href={view.href} className="special-card__media" aria-hidden="true" tabIndex={-1}>
        {view.cover ? <SitePhoto photo={view.cover} alt="" frame="card" sizes={SIZES} className="special-card__photo" /> : null}
        <span className="special-card__badge">{special.badge[locale]}</span>
        <span className={view.daysLeft <= HOT_DAYS ? "special-card__left special-card__left--hot" : "special-card__left"}>
          <Clock size={12} strokeWidth={2} aria-hidden />
          {view.daysLeft > 0 ? t("special.daysLeft", { n: view.daysLeft }) : t("special.lastDay")}
        </span>
      </Link>
      <div className="special-card__body">
        <p className="special-card__developer">{special.developer.name}</p>
        <h3 className="special-card__title">{title}</h3>
        {text ? <p className="special-card__text">{text}</p> : null}
        <div className="special-card__foot">
          <div className="special-card__offer">
            <Link href={view.href} className="special-card__complex">
              {complexLabel}
              <ArrowRight size={12} strokeWidth={2} aria-hidden />
            </Link>
            {price ? <p className="special-card__price">{t("special.priceFrom", { price: formatPrice(price.amount, price.currency, locale) })}</p> : null}
          </div>
          <LeadButton intent={{ type: "promo", object: { developer: special.developer.slug }, context: title, promo: { title } }} size="sm" className="special-card__want" />
        </div>
        <p className="special-card__until">{t("special.until", { date: formatDate(new Date(special.validTo)) })}</p>
      </div>
    </article>
  );
}
