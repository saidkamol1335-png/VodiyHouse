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

/** Первый экран главной: тексты home.hero и цифры каталога — серверу, арка с рендерами и движение — клиенту. */
export async function HomeHero({ stats, found, catalogId }: HomeHeroProps) {
  const [t, locale] = await Promise.all([getTranslations("home.hero"), getLocale()]);
  const text: HeroText = {
    eyebrow: t("eyebrow"),
    titleLead: t("titleLead"),
    titleAccent: t("titleAccent"),
    lead: t("lead"),
    cta: t("cta"),
    perks: PERK_KEYS.map((key) => t(`free.${key}`)),
    statsLabel: t("stats.label"),
    scrollCue: t("scrollCue"),
    slides: {
      label: t("slides.label"),
      note: t("slides.note"),
    },
  };
  return (
    <HeroScreen
      text={text}
      stats={stats ? heroStats(t, stats, locale) : []}
      ctaHref={`#${catalogId}`}
      quiz={<HeroQuizLink />}
      found={found ? <HeroQuickPick found={found} locale={locale as Locale} /> : null}
    />
  );
}

/**
 * Цифры каталога: ЖК, застройщики, квартиры в продаже («+», если у части типов числа нет). Нулевые не
 * показываем (решение 02.11.2026): пустой каталог — экран без цифр, а не «0 жилых комплексов».
 */
function heroStats(t: HeroTranslator, stats: HomeStats, locale: string): HeroStat[] {
  return allHeroStats(t, stats, locale).filter((item) => !/^0\+?$/.test(item.value));
}

function allHeroStats(t: HeroTranslator, stats: HomeStats, locale: string): HeroStat[] {
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
