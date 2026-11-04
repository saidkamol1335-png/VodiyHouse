import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute, ROUTES } from "@/lib/routes";
import { quoteWords, reviewStats, starsOf, visibleReviews } from "@/lib/site/reviews/model";
import { readSiteReviews } from "@/lib/site/reviews/read";
import { ReviewsStage, type ReviewRow, type ReviewsText } from "./ReviewsStage";

/**
 * «Отзывы тех, кто уже получил ключи» (PLAN §10, п. 47; ТЗ 5.11; Motion Kit №16): строки отзывов
 * проходят сквозь липкую сцену с 3D-ключом. Только опубликованные с согласием, меньше трёх — блока нет;
 * число и средняя — из них же. Ни одного контакта застройщика (правило 1.2): CTA ведёт в каталог.
 */
export async function Reviews() {
  const reviews = visibleReviews(await readSiteReviews());
  if (reviews.length === 0) return null;
  const [t, locale] = await Promise.all([
    getTranslations("home.reviews"),
    getLocale() as Promise<Locale>,
  ]);
  const decimal = new Intl.NumberFormat(locale === "uz" ? "uz-Latn-UZ" : "ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const stats = reviewStats(reviews);
  const rows: ReviewRow[] = reviews.map((review) => ({
    id: review.id,
    name: review.name,
    role: review.role[locale],
    rating: decimal.format(review.rating),
    ratingLabel: t("ratingLabel", { value: decimal.format(review.rating) }),
    stars: starsOf(review.rating),
    words: quoteWords(review.quote[locale], review.accent?.[locale] ?? null),
    photo: review.photo,
    youtubeId: review.youtubeId,
    complex: review.complex
      ? { href: complexRoute(review.complex.slug), name: review.complex.name[locale] }
      : null,
  }));
  const text: ReviewsText = {
    title: t("title"),
    barLeft: t("barLeft"),
    count: t("count", { n: stats.count }),
    average: t("average", { value: decimal.format(stats.average) }),
    averageLabel: t("ratingLabel", { value: decimal.format(stats.average) }),
    averageStars: starsOf(stats.average),
    barRight: t("barRight"),
    cta: t("cta"),
    ctaHref: ROUTES.catalog,
    play: t("play"),
    photoAlt: t("photoAlt"),
    keyAlt: t("keyAlt"),
  };
  return <ReviewsStage rows={rows} text={text} />;
}
