import { notFound } from "next/navigation";
import { type AbstractIntlMessages, NextIntlClientProvider } from "next-intl";
import { createTranslator } from "next-intl";
import { CalcHero, type CalcHeroExample } from "@/components/CalcHero";
import { Container } from "@/components/Container";
import { HiddenNavProvider } from "@/components/HiddenNav";
import { SiteCalculator } from "@/components/SiteCalculator";
import { SiteHeader } from "@/components/SiteHeader";
import { demoSiteCalc } from "@/lib/admin/calc/siteDemo";
import { CALC_EXAMPLES, exampleSearch, exampleYears } from "@/lib/calc/examples";
import { CALC_HINT_DRAFTS } from "@/lib/calc/hints";
import { readCalcParams } from "@/lib/calc/params";
import { siteCalcFrom, type SiteCalcRecord } from "@/lib/calc/siteScreen";
import { CALC_MESSAGES, pickMessages, siteMessages } from "@/lib/i18n/clientMessages";
import { hiddenNav } from "@/lib/routes";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";

// Стенд /kalkulyator на DEMO мокапа (шаг 2.6): тот же экран, что у страницы сайта, тот же
// преобразователь ответа базы; «Получить точный расчёт» виден (на сайте — после заявок фазы 3).
// /dev/kalkulyator — по-русски, /dev/kalkulyator/uz — по-узбекски. Пустые состояния для e2e:
// ?rate=none — курса нет (решение «Валюта»), ?developers=none — застройщиков с программами нет
// («Пустые состояния»: страница без калькулятора, пункта «Калькулятор» в меню нет).

type Search = Record<string, string | string[] | undefined>;
type StandLocale = "ru" | "uz";

function standRecord(slug: string | null, search: Search): SiteCalcRecord {
  const record = demoSiteCalc(slug);
  if (search.developers === "none") return { ...record, developers: [], current: null };
  return search.rate === "none" ? { ...record, rate: null } : record;
}

function examplesOf(locale: StandLocale, base: string, search: Search): CalcHeroExample[] {
  const t = createTranslator({ locale, messages: locale === "uz" ? uz : ru, namespace: "calc" });
  return CALC_EXAMPLES.flatMap((example) => {
    const current = siteCalcFrom(standRecord(example.developer, search)).current;
    const href = current ? exampleSearch(example, current.data.options) : null;
    if (!current || !href) return [];
    const term = t("years", { count: exampleYears(example) });
    return [
      {
        href: `${base}?${href}`,
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
  const screen = siteCalcFrom(standRecord(params.developer, search));
  const base = locale === "uz" ? "/dev/kalkulyator/uz" : "/dev/kalkulyator";
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ ...siteMessages(messages), ...pickMessages(messages, CALC_MESSAGES) }}
    >
      <HiddenNavProvider hidden={hiddenNav({ calculator: screen.developers.length > 0 })}>
        <SiteHeader />
      </HiddenNavProvider>
      <Container as="main">
        <CalcHero
          eyebrow={t("eyebrow")}
          title={t("title")}
          accent={t("titleAccent")}
          lead={t("lead")}
          examplesLabel={t("examples")}
          examples={examplesOf(locale, base, search)}
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
