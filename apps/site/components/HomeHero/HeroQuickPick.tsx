import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import type { HeroFound } from "@/lib/site/home/stats";

type HeroQuickPickProps = { found: HeroFound; locale: Locale };

/**
 * «Найдено сейчас» компактной плашкой (мокап .vf__found и строка запроса видоискателя): сколько ЖК и
 * квартир отвечает примеру «2-комн. до $45 000» — ссылка на каталог с этим фильтром.
 */
export async function HeroQuickPick({ found, locale }: HeroQuickPickProps) {
  const t = await getTranslations("home.hero.found");
  const number = new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : "ru-RU");
  const values = { complexes: number.format(found.complexes), flats: number.format(found.flats) };
  const summary = found.partial
    ? found.flats > 0
      ? t("partial", values)
      : t("some", values)
    : t("value", values);
  return (
    <Link href={`${ROUTES.catalog}${found.search}`} className="home-hero__found">
      <span className="home-hero__found-label">{t("label")}</span>
      <span className="home-hero__found-value">{summary}</span>
      <span className="home-hero__found-query">«{t("query")}»</span>
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}
