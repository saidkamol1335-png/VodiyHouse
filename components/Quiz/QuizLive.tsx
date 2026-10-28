"use client";

import { useFormatter, useTranslations } from "next-intl";
import { SitePhoto } from "@/components/SitePhoto";
import { Link } from "@/lib/i18n/navigation";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import type { QuizMatch } from "@/lib/site/quiz/model";

type QuizLiveProps = {
  match: QuizMatch;
  locale: Locale;
  /** compact — полоса внизу экрана телефона (/podbor): только миниатюры и цифры. */
  compact?: boolean;
};

const THUMBS = 4;

/**
 * Живой счётчик (мокап .qz__live / .qi__live): «Подходит прямо сейчас», сколько ЖК и квартир,
 * до четырёх миниатюр ЖК с ценой «от» и «+N». Ничего не подошло — «менеджер подберёт вручную».
 */
export function QuizLive({ match, locale, compact = false }: QuizLiveProps) {
  const t = useTranslations("quiz");
  const format = useFormatter();
  const total = match.complexes.length;
  const flats = `${format.number(match.flats)}${match.partial ? "+" : ""}`;
  return (
    <div className={compact ? "quiz__live quiz__live--compact" : "quiz__live"} aria-live="polite">
      {compact ? null : (
        <span className="quiz__pulse">
          <i aria-hidden="true" />
          {t("live")}
        </span>
      )}
      <div className="quiz__count">
        <b>{format.number(total)}</b>
        <span>
          {t("fits", { count: total })}
          <small>{t("flats", { count: match.flats, n: flats })}</small>
        </span>
      </div>
      {total > 0 ? (
        <div className="quiz__thumbs">
          {match.complexes.slice(0, THUMBS).map((complex) => {
            const price = match.prices.get(complex.id) ?? null;
            return (
              <Link key={complex.id} href={complexRoute(complex.slug)} className="quiz__thumb">
                {complex.photos[0] ? <SitePhoto photo={complex.photos[0]} alt="" frame="card" sizes="(max-width: 760px) 48px, 34px" className="quiz__thumb-photo" /> : <span className="quiz__thumb-photo" />}
                <span>
                  <b>{complex.name[locale]}</b>
                  {price !== null ? <small>{t("priceFrom", { price: formatPrice(price, "USD") })}</small> : null}
                </span>
              </Link>
            );
          })}
          {total > THUMBS ? <span className="quiz__more">{t("more", { n: total - THUMBS })}</span> : null}
        </div>
      ) : (
        <p className="quiz__none">{t("none")}</p>
      )}
    </div>
  );
}
