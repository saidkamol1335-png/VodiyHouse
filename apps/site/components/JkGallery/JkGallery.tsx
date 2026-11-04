import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import { cardDeadline, cardPrice } from "@/lib/site/catalog/card";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { projectComplexes, projectWidth } from "@/lib/site/home/projects";
import { formatPrice } from "@vh/shared/format";
import { JkGalleryTrack, type JkGalleryCard } from "./JkGalleryTrack";

/**
 * «Проекты Vodiy House» (PLAN §10, п. 47; Motion Kit №17): по карточке на опубликованный ЖК — обложка,
 * огромное название, в углах район, застройщик, цена от и сдача; последняя — «Все ЖК →». Меньше трёх
 * ЖК — блока нет. Движение — JkGalleryTrack (full: pin и горизонтальный трек; иначе — лента).
 */
export async function JkGallery({ catalog }: { catalog: SiteCatalog }) {
  const complexes = projectComplexes(catalog.complexes);
  if (complexes.length === 0) return null;
  const [t, card, locale] = await Promise.all([
    getTranslations("home.projects"),
    getTranslations("catalog.card"),
    getLocale() as Promise<Locale>,
  ]);
  const cards = complexes.map((complex, index) => cardOf(complex, index, catalog, card, locale));
  return (
    <JkGalleryTrack
      cards={cards}
      text={{
        eyebrow: t("eyebrow"),
        title: t("title"),
        titleAccent: t("titleAccent"),
        all: t("all"),
        allNote: t("allNote", { n: complexes.length }),
        hint: t("hint"),
      }}
    />
  );
}

type CardText = Awaited<ReturnType<typeof getTranslations<"catalog.card">>>;

/** Карточка: обложка, название, в углах район, застройщик, цена от и сдача (тексты каталога). */
function cardOf(
  complex: CatalogComplex,
  index: number,
  catalog: SiteCatalog,
  card: CardText,
  locale: Locale,
): JkGalleryCard {
  const developer = catalog.developers.find((entry) => entry.id === complex.developerId);
  const price = cardPrice(complex, catalog);
  const deadline = cardDeadline(complex);
  const quarter =
    deadline?.kind === "until"
      ? card("quarter", { q: deadline.quarter, year: deadline.year })
      : null;
  const label = card("name", { name: complex.name[locale] });
  return {
    slug: complex.slug,
    name: complex.name[locale],
    label,
    photo: complex.photos[0]!,
    alt: complex.photos[0]?.alt?.[locale] || label,
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
