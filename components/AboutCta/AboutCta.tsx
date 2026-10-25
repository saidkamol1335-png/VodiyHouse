import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { LeadButton } from "@/components/LeadDialog";

/** «Приезжайте в офис — покажем все проекты на одной встрече» (мокап .ctaY): заявка «Просмотр» — офис. */
export async function AboutCta() {
  const t = await getTranslations("about.cta");
  return (
    <section className="about-cta" aria-labelledby="about-cta-title">
      <Container>
        <div className="about-cta__band">
          <div>
            <h2 id="about-cta-title" className="about-cta__title">
              {t("title")}
            </h2>
            <p className="about-cta__text">{t("text")}</p>
          </div>
          <LeadButton intent={{ type: "view", viewTarget: "office", context: t("context") }} variant="outline" className="about-cta__button">
            <CalendarDays size={16} aria-hidden="true" />
            {t("button")}
          </LeadButton>
        </div>
      </Container>
    </section>
  );
}
