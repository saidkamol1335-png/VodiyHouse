"use client";

import { Share } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/Button";
import { CatalogGrid } from "@/components/CatalogGrid";
import { ShareButton } from "@/components/ShareButton";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { keepFavorites, useStoredFavorites } from "@/lib/site/favorites";
import { podborkaPath } from "@/lib/site/podborka";

/**
 * /izbrannoe (Ф7 A, мокап MobFav): ЖК из избранного этого браузера в порядке добавления и
 * «Поделиться подборкой» — ссылка /podborka?zhk=… для получателя. Снятые с сайта ЖК убираются из
 * избранного (счётчик в шапке — тот же). До чтения хранилища — пустое место той же высоты, а не «пусто».
 */
export function FavoritesView({ catalog }: { catalog: SiteCatalog }) {
  const t = useTranslations("favorites");
  const locale = useLocale() as Locale;
  const slugs = useStoredFavorites();
  const valid = useMemo(() => new Set(catalog.complexes.map((complex) => complex.slug)), [catalog]);
  useEffect(() => {
    if (slugs) keepFavorites(valid);
  }, [slugs, valid]);
  const view = useRef<HTMLDivElement>(null);
  const complexes = (slugs ?? []).flatMap((slug) => catalog.complexes.filter((complex) => complex.slug === slug));
  useFocusAfterRemove(view, complexes.length);
  if (slugs === null) return <div className="favorites-view favorites-view--loading" aria-busy="true" />;
  const first = complexes[0];
  return (
    <div ref={view} className="favorites-view">
      <div className="favorites-view__head">
        <h1 className="favorites-view__title" tabIndex={-1}>
          {t("title", { count: complexes.length })}
        </h1>
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

/**
 * Сердце сняли с клавиатуры — карточка пропала вместе с фокусом: фокус — на первое оставшееся
 * сердце, а без карточек — на заголовок («Избранное пока пусто»).
 */
function useFocusAfterRemove(view: RefObject<HTMLDivElement | null>, count: number) {
  const previous = useRef(count);
  useEffect(() => {
    const removed = count < previous.current;
    previous.current = count;
    if (!removed || (document.activeElement && document.activeElement !== document.body)) return;
    const target = view.current?.querySelector<HTMLElement>(".favorite-button") ?? view.current?.querySelector<HTMLElement>(".favorites-view__title");
    target?.focus();
  }, [count, view]);
}
