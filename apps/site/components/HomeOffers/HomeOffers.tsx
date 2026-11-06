import { Megaphone } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { AdCard } from "@/components/AdCard";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { Reveal } from "@/components/Reveal";
import { pickMessages, SHOWCASE_MESSAGES } from "@/lib/i18n/clientMessages";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { NO_FILTER } from "@/lib/site/catalog/filter";
import { adView, houseAd, type AdView } from "@/lib/site/showcase/model";
import type { SiteShowcase } from "@/lib/site/showcase/records";

type HomeOffersProps = {
  /** Якорь раздела рекламы (AD_ANCHOR); «Спецпредложения» в шапке с 06.11.2026 ведут в ленту «Проекты». */
  id: string;
  catalog: SiteCatalog;
  showcase: SiteShowcase;
};

/**
 * «Предложения от застройщиков» (3.16б, мокап .sec--spec; ТЗ 5.4 «Рекламный баннер»): одна карточка
 * рекламы по порядку руководителя (Г1 A); пока застройщик не купил место — своя реклама Vodiy House из
 * каталога (мокап vmAd). Справа — «Разместить рекламу» → «Застройщикам». Спецпредложения с 06.11.2026 —
 * в ленте «Проекты» (JkGallery), здесь их нет. Нет каталога для карточки — раздела нет.
 */
export async function HomeOffers({ id, catalog, showcase }: HomeOffersProps) {
  const [t, house, messages] = await Promise.all([
    getTranslations("showcase.offers"),
    getTranslations("showcase.house"),
    getMessages(),
  ]);
  const ad = adView(catalog, showcase) ?? houseAdView(catalog, house);
  if (!ad) return null;
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
          <Reveal>
            <AdCard view={ad} />
          </Reveal>
        </NextIntlClientProvider>
      </Container>
    </section>
  );
}

type HouseText = Awaited<ReturnType<typeof getTranslations<"showcase.house">>>;

/** Своя реклама Vodiy House: цифры — houseAd, тексты — на языке страницы (страница статична по языку). */
function houseAdView(catalog: SiteCatalog, t: HouseText): AdView | null {
  const house = houseAd(catalog);
  if (!house) return null;
  const title = t(`${house.kind}.title`);
  const text = house.months && house.kind !== "all" ? t(`${house.kind}.text`, { m: house.months }) : t("all.text");
  const same = (value: string) => ({ ru: value, uz: value });
  return {
    ...house.view,
    house: true,
    ad: {
      id: "vodiy-house",
      title: same(title),
      text: same(text),
      developer: { id: "", slug: house.developer?.slug ?? "", name: house.developer?.name ?? t("developers") },
      complexIds: [],
      filter: NO_FILTER,
      validTo: "",
      cover: null,
    },
  };
}
