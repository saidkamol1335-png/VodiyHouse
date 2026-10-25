"use client";

import { Share } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { CatalogGrid } from "@/components/CatalogGrid";
import { ShareButton } from "@/components/ShareButton";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { useFavorites } from "@/lib/site/favorites";
import { podborkaPath } from "@/lib/site/podborka";

/**
 * /izbrannoe (Ф7 A, мокап MobFav): ЖК из избранного этого браузера в порядке добавления и
 * «Поделиться подборкой» — ссылка /podborka?zhk=… для получателя. Снятые с сайта ЖК не показываются.
 */
export function FavoritesView({ catalog }: { catalog: SiteCatalog }) {
  const t = useTranslations("favorites");
  const locale = useLocale() as Locale;
  const slugs = useFavorites();
  const complexes = slugs.flatMap((slug) => catalog.complexes.filter((complex) => complex.slug === slug));
  const first = complexes[0];
  return (
    <div className="favorites-view">
      <div className="favorites-view__head">
        <h1 className="favorites-view__title">{t("title", { count: complexes.length })}</h1>
        <p className="favorites-view__lead">{complexes.length > 0 ? t("lead") : t("empty")}</p>
        {first ? (
          <ShareButton
            className="favorites-view__share"
            share={{
              path: podborkaPath(locale, complexes.map((complex) => complex.slug)),
              title: t("shareTitle", { count: complexes.length }),
              text: complexes.map((complex) => complex.name[locale]).join(", "),
              photo: first.photos[0] ?? null,
            }}
          >
            <Share size={16} aria-hidden="true" />
            {t("share")}
          </ShareButton>
        ) : (
          <Button href={`/${locale}${ROUTES.catalog}`} className="favorites-view__catalog">
            {t("toCatalog")}
          </Button>
        )}
      </div>
      {complexes.length > 0 ? <CatalogGrid catalog={catalog} complexes={complexes} /> : null}
    </div>
  );
}
