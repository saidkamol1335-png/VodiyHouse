import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Reveal } from "@/components/Reveal";
import { Spotlight } from "@/components/Spotlight";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/routes";

/** «Вы застройщик?» (мокап .ptband) — на страницу «Застройщикам» (шаг 3.11). */
export async function HomePartner() {
  const t = await getTranslations("home.partner");
  return (
    <section className="home-partner" aria-labelledby="home-partner-title">
      <Container>
        <Reveal>
          <Spotlight className="home-partner__band">
            <div>
              <Eyebrow>{t("eyebrow")}</Eyebrow>
              <h2 id="home-partner-title" className="home-partner__title">
                {t("title")}
              </h2>
              <p className="home-partner__text">{t("text")}</p>
            </div>
            <Link href={ROUTES.forDevelopers} className="home-partner__cta">
              {t("cta")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Spotlight>
        </Reveal>
      </Container>
    </section>
  );
}
