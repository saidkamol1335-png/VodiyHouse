import type { LocalizedText } from "@/lib/contacts";

// Отзывы покупателей на главной (PLAN §10, п. 47; ТЗ 5.11): только опубликованные с согласием (это
// решает site_reviews()), меньше трёх — блока нет; число и средняя оценка — из этих же отзывов.

export const REVIEWS_MIN = 3;

export type ReviewPhoto = { src: string; width: number; height: number; blur: string | null };

export type SiteReview = {
  id: string;
  name: string;
  role: LocalizedText;
  /** 1–5, шаг 0,5. */
  rating: number;
  quote: LocalizedText;
  /** Выделенная фраза — кусок цитаты на том же языке. */
  accent: LocalizedText | null;
  photo: ReviewPhoto | null;
  youtubeId: string | null;
  complex: { slug: string; name: LocalizedText } | null;
};

/** Блок показывает отзывы, только когда их не меньше трёх (повтор правила базы — на всякий случай). */
export function visibleReviews(reviews: readonly SiteReview[]): SiteReview[] {
  return reviews.length >= REVIEWS_MIN ? [...reviews] : [];
}

/** «Отзывы N ★★★★★ X/5»: среднее — с точностью до десятых. */
export function reviewStats(reviews: readonly SiteReview[]): { count: number; average: number } {
  if (reviews.length === 0) return { count: 0, average: 0 };
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return { count: reviews.length, average: Math.round((sum / reviews.length) * 10) / 10 };
}

export type Star = "full" | "half" | "empty";

/** Пять звёзд с половинками: 4,5 → ★★★★½, 4,3 → ★★★★½ (до ближайшей половинки). */
export function starsOf(rating: number): Star[] {
  const halves = Math.round(Math.min(5, Math.max(0, rating)) * 2);
  return Array.from({ length: 5 }, (_, index) => {
    const left = halves - index * 2;
    return left >= 2 ? "full" : left === 1 ? "half" : "empty";
  });
}

export type QuoteWord = { text: string; accent: boolean };

/**
 * Цитата по словам (пробелы — границы); слово — accent, если пересекается с выделенной фразой (первое
 * вхождение). Знаки препинания остаются при своём слове: «давления.», а не «давления .».
 */
export function quoteWords(quote: string, accent: string | null): QuoteWord[] {
  const at = accent ? quote.indexOf(accent) : -1;
  const end = at >= 0 && accent ? at + accent.length : -1;
  return [...quote.matchAll(/\S+/g)].map((match) => {
    const start = match.index;
    const stop = start + match[0].length;
    return { text: match[0], accent: at >= 0 && start < end && stop > at };
  });
}
