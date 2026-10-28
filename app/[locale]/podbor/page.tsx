import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { QuizSection } from "@/components/Quiz";
import { SiteHeader } from "@/components/SiteHeader";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { QUIZ_ANCHOR, ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { pageMetadata } from "@/lib/site/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("quiz")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.quiz,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/**
 * «Подбор за 1 минуту» страницей (3.17): та же анкета, что в разделе главной, — посадочная для
 * рекламы и пункт меню телефона и подвала; индексируется. На телефоне — экран MobQuiz.
 */
export default async function QuizPage() {
  const catalog = await readSiteCatalog();
  return (
    <>
      <SiteHeader />
      <main>
        <QuizSection id={QUIZ_ANCHOR} catalog={catalog} variant="page" />
      </main>
    </>
  );
}
