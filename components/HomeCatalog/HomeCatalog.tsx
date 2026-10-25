import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { CatalogResults } from "@/components/CatalogResults";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { CATALOG_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import type { SiteCatalog } from "@/lib/site/catalog/records";

type HomeCatalogProps = { id: string; catalog: SiteCatalog; pageSize: number };

/**
 * Каталог на главной (Ф3 A, мокап: .sec--flt и .sec--res): тот же компонент, что /novostroyki —
 * фильтр, «Найдено N ЖК», карточки порциями. Якорь — для «Подобрать квартиру» первого экрана.
 */
export async function HomeCatalog({ id, catalog, pageSize }: HomeCatalogProps) {
  const [t, messages] = await Promise.all([getTranslations("home.catalog"), getMessages()]);
  return (
    <section id={id} className="home-catalog" aria-labelledby={`${id}-title`}>
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id={`${id}-title`} className="home-catalog__title">
          <Heading level={2} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
        </div>
        <NextIntlClientProvider messages={pickMessages(messages, CATALOG_MESSAGES)}>
          <CatalogResults catalog={catalog} pageSize={pageSize} preloadFirst={false} />
        </NextIntlClientProvider>
      </Container>
    </section>
  );
}
