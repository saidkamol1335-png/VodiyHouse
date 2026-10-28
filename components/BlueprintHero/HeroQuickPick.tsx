import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import type { HeroFound } from "@/lib/site/home/stats";

type HeroQuickPickProps = { found: HeroFound; locale: Locale };

/**
 * Быстрый подбор под кнопками (мокап .vf, «Найдено сейчас»): пример запроса «2-комн. до $45 000» и
 * сколько ЖК и квартир ему отвечает — ссылка на каталог с этим фильтром. С 3.17 рядом встанет
 * «Подбор за 1 минуту».
 */
export async function HeroQuickPick({ found, locale }: HeroQuickPickProps) {
  const t = await getTranslations("home.hero.found");
  const number = new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : "ru-RU");
  const values = { complexes: number.format(found.complexes), flats: number.format(found.flats) };
  const summary = found.partial ? (found.flats > 0 ? t("partial", values) : t("some", values)) : t("value", values);
  return (
    <Link href={`${ROUTES.catalog}${found.search}`} className="blueprint-hero__pick">
      <span className="blueprint-hero__pick-label">{t("label")}</span>
      <span className="blueprint-hero__pick-value">
        {summary} · «{t("query")}»
      </span>
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}
