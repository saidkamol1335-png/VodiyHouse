import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CalcHero, type CalcHeroExample } from "@/components/CalcHero";
import { Container } from "@/components/Container";
import { SiteCalculator } from "@/components/SiteCalculator";
import { SiteHeader } from "@/components/SiteHeader";
import { CALC_EXAMPLES, exampleSearch, exampleYears } from "@/lib/calc/examples";
import { readCalcParams } from "@/lib/calc/params";
import { CALC_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { LEAD_FORM_ENABLED } from "@/lib/site/flags";
import { readSiteCalc } from "@/lib/site/calculator";
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

/** /kalkulyator (шаг 2.6): шапка страницы статичная, калькулятор — по адресу (?developer=…). */
export default async function CalculatorPage({ searchParams }: CalculatorPageProps) {
  const t = await getTranslations("calc.page");
  return (
    <>
      <SiteHeader />
      <Container as="main">
        <Suspense fallback={<CalcHero {...heroTexts(t)} examples={[]} />}>
          <Calculator searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}

type PageT = Awaited<ReturnType<typeof getTranslations<"calc.page">>>;

const heroTexts = (t: PageT) => ({
  eyebrow: t("eyebrow"),
  title: t("title"),
  accent: t("titleAccent"),
  lead: t("lead"),
  examplesLabel: t("examples"),
});

/** Примеры — только когда есть DEMO-застройщики с такими программами (решение фазы 2). */
async function examplesOf(t: PageT, tCalc: Awaited<ReturnType<typeof getTranslations<"calc">>>) {
  const examples: CalcHeroExample[] = [];
  for (const example of CALC_EXAMPLES) {
    const current = (await readSiteCalc(example.developer))?.current;
    if (current?.slug !== example.developer) continue;
    const search = exampleSearch(example, current.data.options);
    if (!search) continue;
    const term = tCalc("years", { count: exampleYears(example) });
    examples.push({
      href: `/${await getLocale()}${ROUTES.calculator}?${search}`,
      title: t("example", { area: example.areaM2, term }),
      note: `${current.name} · ${example.bank}`,
    });
  }
  return examples;
}

async function Calculator({ searchParams }: { searchParams: Promise<Search> }) {
  const [t, tCalc, messages] = await Promise.all([
    getTranslations("calc.page"),
    getTranslations("calc"),
    getMessages(),
  ]);
  const params = readCalcParams(await searchParams);
  const [screen, hints] = await Promise.all([readSiteCalc(params.developer), readSiteCalcHints()]);
  return (
    <>
      <CalcHero {...heroTexts(t)} examples={await examplesOf(t, tCalc)} />
      {/* Тексты калькулятора — только этой странице: в HTML остальных страниц сайта их нет. */}
      <NextIntlClientProvider messages={pickMessages(messages, CALC_MESSAGES)}>
        <SiteCalculator
          screen={screen ?? { developers: [], current: null }}
          initialParams={{ ...params, developer: screen?.current?.slug ?? null }}
          leadEnabled={LEAD_FORM_ENABLED}
          hints={hints}
        />
      </NextIntlClientProvider>
    </>
  );
}
