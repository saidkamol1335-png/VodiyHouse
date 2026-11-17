import { Megaphone } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { AdCard } from "@/components/AdCard";
import { AdSlider } from "@/components/AdSlider";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { Reveal } from "@/components/Reveal";
import { pickMessages, SHOWCASE_MESSAGES } from "@/lib/i18n/clientMessages";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { readSiteContacts } from "@/lib/site/contacts";
import { readHouseAdSettings } from "@/lib/site/houseAd";
import { houseAd, type AdView } from "@/lib/site/showcase/model";
import type { SiteShowcase } from "@/lib/site/showcase/records";

type HomeOffersProps = {
  /** Якорь раздела рекламы (AD_ANCHOR); «Спецпредложения» в шапке с 06.11.2026 ведут в ленту «Проекты». */
  id: string;
  catalog: SiteCatalog;
  showcase: SiteShowcase;
};

/**
 * «Предложения от застройщиков» (3.16б, мокап .sec--spec; ТЗ 5.4 «Рекламный баннер»): с правок 15.11
 * (п. 4 + 13) — слайдер баннеров застройщиков по порядку руководителя; пока баннеров нет — своя реклама
 * Vodiy House из каталога (мокап vmAd), если её не выключили в «Витрина → Реклама». Справа — «Разместить
 * рекламу» → «Застройщикам». Спецпредложения с 06.11.2026 — в ленте «Проекты» (JkGallery). Показать
 * нечего — раздела нет.
 */
export async function HomeOffers({ id, catalog, showcase }: HomeOffersProps) {
  const [t, house, messages, houseSettings, contacts] = await Promise.all([
    getTranslations("showcase.offers"),
    getTranslations("showcase.house"),
    getMessages(),
    readHouseAdSettings(),
    readSiteContacts(),
  ]);
  const banners = showcase.ads;
  // Своя реклама — только без баннеров и если руководитель её не выключил («Витрина → Реклама», 06.11.2026).
  const ad = banners.length === 0 && houseSettings.enabled ? houseAdView(catalog, house) : null;
  if (banners.length === 0 && !ad) return null;
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
          <Reveal>{ad ? <AdCard view={ad} /> : <AdSlider ads={banners} phone={contacts.phone} />}</Reveal>
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
    },
  };
}
