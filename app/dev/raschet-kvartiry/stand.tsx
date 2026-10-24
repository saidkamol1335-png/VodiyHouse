import { notFound } from "next/navigation";
import { type AbstractIntlMessages, NextIntlClientProvider } from "next-intl";
import { Container } from "@/components/Container";
import { DevFlatStand } from "@/components/DevFlatStand";
import { SiteHeader } from "@/components/SiteHeader";
import { demoFlatCalc, demoFlatLayouts } from "@/lib/admin/calc/flatDemo";
import { flatCalcFrom } from "@/lib/calc/flatScreen";
import { readCalcParams } from "@/lib/calc/params";
import { CALC_MESSAGES, pickMessages, siteMessages } from "@/lib/i18n/clientMessages";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";

// Стенд «Расчёта для этой квартиры» (шаг 2.7) на DEMO мокапа: карточки планировок ЖК Shodlik
// с «Рассчитать оплату», как раздел «Планировки» страницы ЖК (фаза 3). Открытая планировка — в
// адресе (?plan=id), расчёт — тем же преобразователем, что ответ site_layout_calc().
// /dev/raschet-kvartiry — по-русски, /dev/raschet-kvartiry/uz — по-узбекски.

type Search = Record<string, string | string[] | undefined>;
type StandLocale = "ru" | "uz";

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? null;

export function FlatStand({ search, locale }: { search: Search; locale: StandLocale }) {
  if (process.env.NODE_ENV === "production") notFound();
  const messages = (locale === "uz" ? uz : ru) as unknown as AbstractIntlMessages;
  const record = demoFlatCalc(first(search.plan));
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ ...siteMessages(messages), ...pickMessages(messages, CALC_MESSAGES) }}
    >
      <SiteHeader />
      <Container as="main">
        <DevFlatStand
          layouts={demoFlatLayouts()}
          open={record ? { screen: flatCalcFrom(record), params: readCalcParams(search) } : null}
        />
      </Container>
    </NextIntlClientProvider>
  );
}
