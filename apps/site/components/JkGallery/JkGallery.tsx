import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import { cardDeadline, cardPays, cardPrice } from "@/lib/site/catalog/card";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { projectComplexes, projectWidth } from "@/lib/site/home/projects";
import { complexSpecials, daysLeft } from "@/lib/site/showcase/model";
import type { ShowcaseSpecial, SiteShowcase } from "@/lib/site/showcase/records";
import { formatDate, formatPrice } from "@vh/shared/format";
import { JkGalleryTrack, type JkGalleryCard, type JkGalleryOffer } from "./JkGalleryTrack";

/**
 * «Проекты Vodiy House» (PLAN §10, п. 47; Motion Kit №17) — с 06.11.2026 лента спецпредложений (ТЗ 5.6):
 * по карточке на опубликованный ЖК — обложка, огромное название и под ним предложение ЖК из «Витрины»
 * (бейдж, заголовок, текст, «до даты · ещё N дней»); у ЖК без предложения — его условия оплаты из
 * программ застройщика. В углах район, застройщик, цена от и сдача; последняя — «Все ЖК →». ЖК с
 * предложением — первыми. Меньше трёх ЖК — блока нет. Без скидок (PLAN §3.13): база их не пропускает.
 */
export async function JkGallery({
  id,
  catalog,
  showcase,
}: {
  id: string;
  catalog: SiteCatalog;
  showcase: SiteShowcase;
}) {
  const complexes = projectComplexes(catalog.complexes);
  if (complexes.length === 0) return null;
  const [t, card, special, locale] = await Promise.all([
    getTranslations("home.projects"),
    getTranslations("catalog.card"),
    getTranslations("showcase.special"),
    getLocale() as Promise<Locale>,
  ]);
  const specials = complexSpecials(showcase);
  // ЖК с предложением — первыми, остальные в прежнем порядке (sort устойчивый).
  const ordered = [...complexes].sort((a, b) => Number(!specials[a.id]) - Number(!specials[b.id]));
  const cards = ordered.map((complex, index) => {
    const offer = specials[complex.id]
      ? specialOffer(specials[complex.id]!, showcase.today, special, locale)
      : paysOffer(complex, catalog, card);
    return cardOf(complex, index, catalog, card, locale, offer);
  });
  const anyOffer = ordered.some((complex) => specials[complex.id]);
  return (
    <JkGalleryTrack
      id={id}
      cards={cards}
      text={{
        eyebrow: anyOffer ? special("label") : t("eyebrow"),
        title: t("title"),
        titleAccent: t("titleAccent"),
        all: t("all"),
        allNote: t("allNote", { n: complexes.length }),
        hint: t("hint"),
      }}
    />
  );
}

type SpecialText = Awaited<ReturnType<typeof getTranslations<"showcase.special">>>;

/** «ещё N дней» подсвечивается, когда осталось три дня и меньше (как в SpecialCard). */
const HOT_DAYS = 3;

/** Предложение из «Витрины»: бейдж, заголовок, текст и «до 30.11.2026 · ещё N дней». */
function specialOffer(
  item: ShowcaseSpecial,
  today: string,
  t: SpecialText,
  locale: Locale,
): JkGalleryOffer {
  const left = today ? daysLeft(item.validTo, today) : null;
  const until = t("until", { date: formatDate(new Date(item.validTo)) });
  const leftText = left === null ? null : left > 0 ? t("daysLeft", { n: left }) : t("lastDay");
  return {
    badge: item.badge[locale],
    title: item.title[locale],
    text: item.text?.[locale] ?? null,
    until: [until, leftText].filter(Boolean).join(" · "),
    hot: left !== null && left <= HOT_DAYS,
  };
}

/** ЖК без предложения: его условия из программ застройщика («Рассрочка до 30 мес.»), без бейджа. */
function paysOffer(complex: CatalogComplex, catalog: SiteCatalog, card: CardText): JkGalleryOffer | null {
  const developer = catalog.developers.find((entry) => entry.id === complex.developerId);
  const pays = cardPays(complex, developer);
  const title = pays.installmentMonths
    ? card("installmentUpTo", { n: pays.installmentMonths })
    : pays.full
      ? card("payFull")
      : null;
  return title ? { badge: null, title, text: null, until: null, hot: false } : null;
}

type CardText = Awaited<ReturnType<typeof getTranslations<"catalog.card">>>;

/** Карточка: обложка, название и предложение, в углах район, застройщик, цена от и сдача. */
function cardOf(
  complex: CatalogComplex,
  index: number,
  catalog: SiteCatalog,
  card: CardText,
  locale: Locale,
  offer: JkGalleryOffer | null,
): JkGalleryCard {
  const developer = catalog.developers.find((entry) => entry.id === complex.developerId);
  const price = cardPrice(complex, catalog);
  const deadline = cardDeadline(complex);
  const quarter =
    deadline?.kind === "until"
      ? card("quarter", { q: deadline.quarter, year: deadline.year })
      : null;
  const name = card("name", { name: complex.name[locale] });
  const label = [name, offer?.badge, offer?.title, offer?.until].filter(Boolean).join(" — ");
  return {
    slug: complex.slug,
    name: complex.name[locale],
    label,
    photo: complex.photos[0]!,
    alt: complex.photos[0]?.alt?.[locale] || name,
    offer,
    width: projectWidth(index),
    meta: {
      place: complex.location?.name[locale] ?? null,
      developer: developer?.name ?? null,
      price: price
        ? card("priceFrom", { price: formatPrice(price.amount, price.currency, locale) })
        : null,
      deadline:
        deadline?.kind === "built"
          ? card("built")
          : quarter
            ? `${card("deadline")} ${quarter}`
            : null,
    },
  };
}
