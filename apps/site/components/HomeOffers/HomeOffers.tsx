import { Megaphone } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { AdCard } from "@/components/AdCard";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { Reveal } from "@/components/Reveal";
import { SpecialsGrid } from "@/components/SpecialsGrid";
import { pickMessages, SHOWCASE_MESSAGES } from "@/lib/i18n/clientMessages";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { adView, visibleSpecials } from "@/lib/site/showcase/model";
import type { SiteShowcase } from "@/lib/site/showcase/records";

type HomeOffersProps = {
  /** Якорь раздела — пункт «Спецпредложения» в шапке и подвале (OFFERS_ANCHOR). */
  id: string;
  catalog: SiteCatalog;
  showcase: SiteShowcase;
};

/**
 * «Предложения от застройщиков» (3.16б, мокап .sec--spec): одна карточка рекламы по порядку
 * руководителя (Г1 A), ниже — спецпредложения: сетка на 1440, лента с точками на 390 (MobSpecials).
 * Справа — «Разместить рекламу» → «Застройщикам». Нет ни рекламы, ни предложений — раздела нет.
 */
export async function HomeOffers({ id, catalog, showcase }: HomeOffersProps) {
  const ad = adView(catalog, showcase);
  const specials = visibleSpecials(catalog, showcase);
  if (!ad && specials.length === 0) return null;
  const [t, messages] = await Promise.all([getTranslations("showcase.offers"), getMessages()]);
  return (
    <section id={id} className="home-offers" aria-labelledby={`${id}-title`}>
      <Container>
        <Reveal variant="words" className="home-offers__head">
          <div>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <div id={`${id}-title`} className="home-offers__title">
              <Heading level={2} accent={t("titleAccent")}>
                {t("title")}
              </Heading>
            </div>
            <p className="home-offers__lead">{t("lead")}</p>
          </div>
          <Link href={ROUTES.forDevelopers} className="home-offers__place">
            <Megaphone size={16} strokeWidth={1.9} aria-hidden />
            {t("place")}
          </Link>
        </Reveal>
        <NextIntlClientProvider messages={pickMessages(messages, SHOWCASE_MESSAGES)}>
          {ad ? (
            <Reveal>
              <AdCard view={ad} />
            </Reveal>
          ) : null}
          {specials.length > 0 ? (
            <Reveal variant="group">
              <SpecialsGrid specials={specials} />
            </Reveal>
          ) : null}
        </NextIntlClientProvider>
      </Container>
    </section>
  );
}
