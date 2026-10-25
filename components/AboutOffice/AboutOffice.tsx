import { Building2, MapPin, Navigation } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";

const MAPS = "https://yandex.uz/maps/";

/**
 * «Ждём вас в офисе» (мокап SiteAbout .office): адрес, карта и «Проложить маршрут». Точки офиса в базе
 * нет (TODO-заказчик) — карта своей заглушкой с меткой, а ссылки Яндекса ищут по адресу: точку не
 * придумываем.
 */
export async function AboutOffice() {
  const [t, tContacts] = await Promise.all([getTranslations("about.office"), getTranslations("contacts")]);
  const address = tContacts("office");
  const search = `${MAPS}?${new URLSearchParams({ text: address })}`;
  const route = `${MAPS}?${new URLSearchParams({ rtext: `~${address}`, rtt: "auto" })}`;
  return (
    <section className="about-office" aria-labelledby="about-office-title">
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id="about-office-title" className="about-office__title">
          <Heading level={2} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
        </div>
        <p className="about-office__lead">{t("lead", { address })}</p>
        <div className="about-office__card">
          <div className="about-office__bar">
            <span>
              <MapPin size={16} aria-hidden="true" />
              {t("check")}
            </span>
            <a className="button button--outline button--sm" href={route} target="_blank" rel="noopener">
              <Navigation size={14} aria-hidden="true" />
              {t("route")}
            </a>
          </div>
          <a className="about-office__map" href={search} target="_blank" rel="noopener" aria-label={t("open")}>
            <span className="about-office__pin" aria-hidden="true">
              <span className="about-office__drop">
                <Building2 size={18} strokeWidth={1.9} />
              </span>
              <span className="about-office__pin-label">
                <b>Vodiy House</b>
                <small>{address}</small>
              </span>
            </span>
            <span className="about-office__open">{t("open")}</span>
          </a>
        </div>
      </Container>
    </section>
  );
}
