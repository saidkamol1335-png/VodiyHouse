import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { CATALOG_TAG, REVIEWS_TAG } from "@/lib/cache";
import type { LocalizedText } from "@/lib/contacts";
import { mediaPublicUrl } from "@/lib/media";
import { demoSections } from "@/lib/site/home/flatFrames";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { DEMO_REVIEWS } from "./demo";
import type { SiteReview } from "./model";

// Отзывы для главной: site_reviews() ролью посетителя, в кэше страницы (REVIEWS_TAG — правка отзыва,
// CATALOG_TAG — снятый ЖК пропадает из ссылки). Функции ещё нет в базе (миграция не применена) или
// база не ответила — пусто: блок скрыт, страница живёт.

type ReviewRecord = {
  id: string;
  author_name: string;
  author_role: LocalizedText;
  rating: number | string;
  quote: LocalizedText;
  accent: LocalizedText | null;
  photo: { path: string; width: number; height: number; blur: string | null } | null;
  youtube_id: string | null;
  complex: { slug: string; name: LocalizedText } | null;
};

function reviewFrom(record: ReviewRecord): SiteReview {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return {
    id: record.id,
    name: record.author_name,
    role: record.author_role,
    rating: Number(record.rating),
    quote: record.quote,
    accent: record.accent,
    photo: record.photo
      ? {
          src: mediaPublicUrl(base, record.photo.path),
          width: record.photo.width,
          height: record.photo.height,
          blur: record.photo.blur,
        }
      : null,
    youtubeId: record.youtube_id,
    complex: record.complex,
  };
}

async function fetchReviews(): Promise<SiteReview[]> {
  "use cache";
  cacheTag(REVIEWS_TAG, CATALOG_TAG);
  // Минуты, а не часы: снятый отзыв или отозванное согласие уходят с сайта быстро, даже пока форма
  // кабинета не сбрасывает REVIEWS_TAG сама (expireReviews).
  cacheLife("minutes");
  const { data, error } = await createSupabasePublicClient().rpc("site_reviews");
  // PGRST202 — функции нет: миграция 20261103210000 ещё не применена. Это не сбой — блока просто нет.
  if (error?.code === "PGRST202") return [];
  if (error) throw new Error("site-reviews-unavailable", { cause: error });
  return ((data ?? []) as ReviewRecord[]).map(reviewFrom);
}

/** Отзывы сайта; в разработке с VH_DEMO_SECTIONS=1, пока настоящих меньше трёх, — DEMO. */
export async function readSiteReviews(): Promise<SiteReview[]> {
  let reviews: SiteReview[] = [];
  if (hasSupabaseEnv()) {
    try {
      reviews = await fetchReviews();
    } catch (error) {
      unstable_rethrow(error);
      console.error("[otzyvy] отзывы недоступны", error);
    }
  }
  return reviews.length === 0 && demoSections() ? DEMO_REVIEWS : reviews;
}
