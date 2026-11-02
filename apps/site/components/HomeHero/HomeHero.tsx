import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import type { HeroFound, HomeStats } from "@/lib/site/home/stats";
import { HeroQuickPick } from "./HeroQuickPick";
import { HeroQuizLink } from "./HeroQuizLink";
import { HeroScreen } from "./HeroScreen";
import type { HeroStat, HeroText } from "./types";

type HomeHeroProps = {
  /** null — каталог не прочитался: экран без цифр и «Найдено сейчас», но с заголовком и кнопками. */
  stats: HomeStats | null;
  found: HeroFound | null;
  /** Якорь ленты каталога ниже на странице: «Подобрать квартиру» ведёт к ней. */
  catalogId: string;
};

type HeroTranslator = Awaited<ReturnType<typeof getTranslations<"home.hero">>>;

const PERK_KEYS = ["price", "service", "docs"] as const;

/** Первый экран главной: тексты home.hero и цифры каталога — серверу, экран с роликом и лентой — клиенту. */
export async function HomeHero({ stats, found, catalogId }: HomeHeroProps) {
  const [t, video, locale] = await Promise.all([
    getTranslations("home.hero"),
    getTranslations("timelapse"),
    getLocale(),
  ]);
  const text: HeroText = {
    eyebrow: t("eyebrow"),
    titleLead: t("titleLead"),
    titleAccent: t("titleAccent"),
    lead: t("lead"),
    cta: t("cta"),
    perks: PERK_KEYS.map((key) => t(`free.${key}`)),
    statsLabel: t("stats.label"),
    scrollCue: t("scrollCue"),
    finaleTitle: t("finaleTitle"),
    finaleText: t("finaleText"),
    finaleCta: t("finaleCta"),
  };
  return (
    <HeroScreen
      text={text}
      stats={stats ? heroStats(t, stats, locale) : []}
      ctaHref={`#${catalogId}`}
      quiz={<HeroQuizLink />}
      found={found ? <HeroQuickPick found={found} locale={locale as Locale} /> : null}
      toggleLabels={{ pause: video("pause"), play: video("play") }}
    />
  );
}

/** Цифры каталога: ЖК, застройщики, квартиры в продаже («+», если у части типов числа нет). */
function heroStats(t: HeroTranslator, stats: HomeStats, locale: string): HeroStat[] {
  const number = new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : "ru-RU");
  const flats = number.format(stats.flats);
  return [
    {
      key: "complexes",
      label: t("stats.complexes", { count: stats.complexes }),
      value: number.format(stats.complexes),
    },
    {
      key: "developers",
      label: t("stats.developers", { count: stats.developers }),
      value: number.format(stats.developers),
    },
    {
      key: "flats",
      label: t("stats.flats", { count: stats.flats }),
      value: stats.partial ? `${flats}+` : flats,
    },
  ];
}
