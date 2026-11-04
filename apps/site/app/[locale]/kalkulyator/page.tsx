import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { CalcHero } from "@/components/CalcHero";
import { Container } from "@/components/Container";
import { RealtorCalculator, stateFrom } from "@/components/RealtorCalculator";
import { SiteHeader } from "@/components/SiteHeader";
import type { ExchangeRate } from "@vh/shared/calc/money";
import { readRealtorParams } from "@vh/shared/calc/realtorParams";
import { CALC_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { LEAD_FORM_ENABLED } from "@/lib/site/flags";
import { readSiteCalcHints } from "@/lib/site/hints";
import { pageMetadata } from "@/lib/site/metadata";

type Search = Record<string, string | string[] | undefined>;
type CalculatorPageProps = { searchParams: Promise<Search> };

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("calc.page")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.calculator,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/**
 * /kalkulyator — риелторский калькулятор (PLAN §10, п. 48, образец uysot.uz): ипотека, рассрочка и
 * «Сколько могу купить» по условиям, которые вводит посетитель. Программы застройщиков считает
 * калькулятор квартиры на странице ЖК. Шапка статичная, расчёт — по адресу (ссылкой можно поделиться).
 */
export default async function CalculatorPage({ searchParams }: CalculatorPageProps) {
  const t = await getTranslations("calc.page");
  const hero = (
    <CalcHero eyebrow={t("eyebrow")} title={t("title")} accent={t("titleAccent")} lead={t("lead")} />
  );
  return (
    <>
      <SiteHeader />
      <Container as="main">
        {hero}
        <Suspense fallback={<div className="realtor-calc__pending" aria-hidden="true" />}>
          <Calculator searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}

/**
 * Курс для $ | сум — из каталога (там он и для карточек). Облака нет или база не ответила —
 * калькулятор всё равно работает, только в валюте ввода: условия вводит сам посетитель.
 */
async function readRate(): Promise<ExchangeRate | null> {
  try {
    return (await readSiteCatalog())?.rate ?? null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

async function Calculator({ searchParams }: { searchParams: Promise<Search> }) {
  const [messages, rate, hints, search] = await Promise.all([
    getMessages(),
    readRate(),
    readSiteCalcHints(),
    searchParams,
  ]);
  return (
    // Тексты калькулятора — только этой странице: в HTML остальных страниц сайта их нет.
    <NextIntlClientProvider messages={pickMessages(messages, CALC_MESSAGES)}>
      <RealtorCalculator
        id="realtor-calc"
        initialState={stateFrom(readRealtorParams(search))}
        rate={rate}
        leadEnabled={LEAD_FORM_ENABLED}
        hints={hints}
      />
    </NextIntlClientProvider>
  );
}
