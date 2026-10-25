import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { SiteStats } from "@/components/SiteStats";

type PartnersHeroProps = {
  /** Цифры из каталога: ЖК на сайте, застройщики, квартиры в продаже (null — база не ответила). */
  stats: { key: string; value: string; caption: string }[];
  formId: string;
};

/**
 * Первый экран «Застройщикам» (мокап SitePartners): надзаголовок, «Продавайте квартиры вместе с Vodiy
 * House», обещание, «Оставить заявку» к форме внизу и цифры. Посетители и заявки за 30 дней — с
 * аналитикой (3.12), «риелторов в штате» — TODO-заказчик; «Застройщики» — со страницами застройщиков (3б).
 */
export async function PartnersHero({ stats, formId }: PartnersHeroProps) {
  const t = await getTranslations("partners.hero");
  return (
    <section className="partners-hero" aria-labelledby="partners-hero-title">
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id="partners-hero-title" className="partners-hero__title">
          <Heading level={1} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
        </div>
        <p className="partners-hero__lead">{t("lead")}</p>
        <Button href={`#${formId}`} className="partners-hero__cta">
          {t("cta")}
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
        <SiteStats label={t("statsLabel")} items={stats} className="partners-hero__stats" />
      </Container>
    </section>
  );
}
