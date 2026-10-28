import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import type { HeroFound, HomeStats } from "@/lib/site/home/stats";
import { BlueprintHero } from "./BlueprintHero";
import { HeroQuickPick } from "./HeroQuickPick";
import { STAGE_KEYS } from "./stages";
import type { HeroStat, HeroText } from "./types";

type HomeBlueprintHeroProps = {
  /** null — каталог не прочитался: экран без цифр и быстрого подбора, но с заголовком и кнопками. */
  stats: HomeStats | null;
  found: HeroFound | null;
  /** Якорь ленты каталога ниже на странице: «Подобрать квартиру» и финал ведут к ней. */
  catalogId: string;
};

const PERK_KEYS = ["price", "service", "docs"] as const;

/** Первый экран главной: тексты home.hero и цифры каталога — серверу, экран — клиенту. */
export async function HomeBlueprintHero({ stats, found, catalogId }: HomeBlueprintHeroProps) {
  const [t, locale] = await Promise.all([getTranslations("home.hero"), getLocale()]);
  const text: HeroText = {
    eyebrow: t("eyebrow"),
    chip: t("chip"),
    titleLead: t("titleLead"),
    titleAccent: t("titleAccent"),
    lead: t("lead"),
    cta: t("cta"),
    secondaryCta: t("secondaryCta"),
    scrollCue: t("scrollCue"),
    finaleTitle: t("finaleTitle"),
    finaleText: t("finaleText"),
    finaleCta: t("finaleCta"),
    stageLabel: t("stageLabel"),
    elevationLabel: t("elevationLabel"),
    stages: STAGE_KEYS.map((key) => t(`stages.${key}`)),
    perks: PERK_KEYS.map((key) => t(`free.${key}`)),
    statsLabel: t("stats.label"),
  };
  const number = new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : "ru-RU");
  const items: HeroStat[] = stats
    ? [
        { key: "complexes", label: t("stats.complexes", { count: stats.complexes }), value: number.format(stats.complexes) },
        { key: "developers", label: t("stats.developers", { count: stats.developers }), value: number.format(stats.developers) },
        { key: "flats", label: t("stats.flats", { count: stats.flats }), value: stats.partial ? `${number.format(stats.flats)}+` : number.format(stats.flats) },
      ]
    : [];
  return (
    <BlueprintHero text={text} stats={items} ctaHref={`#${catalogId}`} secondaryHref={ROUTES.catalog} finaleHref={`#${catalogId}`}>
      {found ? <HeroQuickPick found={found} locale={locale as Locale} /> : null}
    </BlueprintHero>
  );
}
