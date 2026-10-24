import { notFound } from "next/navigation";
import { type AbstractIntlMessages, NextIntlClientProvider } from "next-intl";
import { createTranslator } from "next-intl";
import { CalcHero, type CalcHeroExample } from "@/components/CalcHero";
import { Container } from "@/components/Container";
import { SiteCalculator } from "@/components/SiteCalculator";
import { SiteHeader } from "@/components/SiteHeader";
import { demoSiteCalc } from "@/lib/admin/calc/siteDemo";
import { CALC_EXAMPLES, exampleSearch, exampleYears } from "@/lib/calc/examples";
import { CALC_HINT_DRAFTS } from "@/lib/calc/hints";
import { readCalcParams } from "@/lib/calc/params";
import { siteCalcFrom } from "@/lib/calc/siteScreen";
import { CALC_MESSAGES, pickMessages, siteMessages } from "@/lib/i18n/clientMessages";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";

// Стенд /kalkulyator на DEMO мокапа (шаг 2.6): тот же экран, что у страницы сайта, тот же
// преобразователь ответа базы; «Получить точный расчёт» виден (на сайте — после заявок фазы 3).
// /dev/kalkulyator — по-русски, /dev/kalkulyator/uz — по-узбекски.

type Search = Record<string, string | string[] | undefined>;
type StandLocale = "ru" | "uz";

function examplesOf(locale: StandLocale, base: string): CalcHeroExample[] {
  const t = createTranslator({ locale, messages: locale === "uz" ? uz : ru, namespace: "calc" });
  return CALC_EXAMPLES.flatMap((example) => {
    const current = siteCalcFrom(demoSiteCalc(example.developer)).current!;
    const search = exampleSearch(example, current.data.options);
    if (!search) return [];
    const term = t("years", { count: exampleYears(example) });
    return [
      {
        href: `${base}?${search}`,
        title: t("page.example", { area: example.areaM2, term }),
        note: `${current.name} · ${example.bank}`,
      },
    ];
  });
}

export function CalculatorStand({ search, locale }: { search: Search; locale: StandLocale }) {
  if (process.env.NODE_ENV === "production") notFound();
  const messages = (locale === "uz" ? uz : ru) as unknown as AbstractIntlMessages;
  const t = createTranslator({
    locale,
    messages: locale === "uz" ? uz : ru,
    namespace: "calc.page",
  });
  const params = readCalcParams(search);
  const screen = siteCalcFrom(demoSiteCalc(params.developer));
  const base = locale === "uz" ? "/dev/kalkulyator/uz" : "/dev/kalkulyator";
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ ...siteMessages(messages), ...pickMessages(messages, CALC_MESSAGES) }}
    >
      <SiteHeader />
      <Container as="main">
        <CalcHero
          eyebrow={t("eyebrow")}
          title={t("title")}
          accent={t("titleAccent")}
          lead={t("lead")}
          examplesLabel={t("examples")}
          examples={examplesOf(locale, base)}
        />
        <SiteCalculator
          screen={screen}
          initialParams={{ ...params, developer: screen.current?.slug ?? null }}
          leadEnabled
          hints={CALC_HINT_DRAFTS}
        />
      </Container>
    </NextIntlClientProvider>
  );
}
