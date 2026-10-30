import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { CatalogResults } from "@/components/CatalogResults";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { Reveal } from "@/components/Reveal";
import { CATALOG_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { cardBadges, visibleCollections } from "@/lib/site/showcase/model";
import type { SiteShowcase } from "@/lib/site/showcase/records";

type HomeCatalogProps = { id: string; catalog: SiteCatalog; pageSize: number; showcase: SiteShowcase };

/**
 * Каталог на главной (Ф3 A, мокап: .sec--flt, подборки и .sec--res): тот же компонент, что
 * /novostroyki — фильтр, подборки витрины между фильтром и выдачей (3.16б), «Найдено N ЖК», карточки
 * порциями с бейджами спецпредложений. Якорь — для «Подобрать квартиру» первого экрана.
 */
export async function HomeCatalog({ id, catalog, pageSize, showcase }: HomeCatalogProps) {
  const [t, messages] = await Promise.all([getTranslations("home.catalog"), getMessages()]);
  return (
    <section id={id} className="home-catalog" aria-labelledby={`${id}-title`}>
      <Container>
        <Reveal variant="words">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <div id={`${id}-title`} className="home-catalog__title">
            <Heading level={2} accent={t("titleAccent")}>
              {t("title")}
            </Heading>
          </div>
        </Reveal>
        <NextIntlClientProvider messages={pickMessages(messages, CATALOG_MESSAGES)}>
          <CatalogResults
            catalog={catalog}
            pageSize={pageSize}
            preloadFirst={false}
            collections={visibleCollections(catalog, showcase)}
            collectionsRow
            badges={cardBadges(showcase)}
          />
        </NextIntlClientProvider>
      </Container>
    </section>
  );
}
