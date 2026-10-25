import { MapPin, Phone, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Beam } from "@/components/Beam";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { PartnerForm } from "@/components/LeadForm";
import { formatPhone, phoneHref, telegramHref } from "@/lib/contacts";
import { PARTNER_ANCHOR } from "@/lib/leads/partner";
import { readSiteContacts } from "@/lib/site/contacts";

/**
 * «Заявка на сотрудничество» (мокап SitePartners .preq): слева обещание и контакты Vodiy House (правило
 * ТЗ 1.2 — только наши; не введённых в «Контакты» строк нет), справа форма застройщика.
 */
export async function PartnersRequest() {
  const [t, tContacts, contacts] = await Promise.all([
    getTranslations("partners.request"),
    getTranslations("contacts"),
    readSiteContacts(),
  ]);
  return (
    <section id={PARTNER_ANCHOR} className="partners-request" aria-labelledby="partners-request-title">
      <Container>
        <div className="partners-request__card">
          <Beam />
          <div className="partners-request__text">
            <Eyebrow>Vodiy House</Eyebrow>
            <div id="partners-request-title" className="partners-request__title">
              <Heading level={2} accent={t("titleAccent")}>
                {t("title")}
              </Heading>
            </div>
            <p className="partners-request__lead">{t("lead")}</p>
            <ul className="partners-request__contacts">
              {contacts.phone ? (
                <li>
                  <Phone size={16} aria-hidden="true" />
                  <a href={phoneHref(contacts.phone)}>{formatPhone(contacts.phone)}</a>
                </li>
              ) : null}
              {contacts.telegram ? (
                <li>
                  <Send size={16} aria-hidden="true" />
                  <a href={telegramHref(contacts.telegram)}>Telegram @{contacts.telegram}</a>
                </li>
              ) : null}
              <li>
                <MapPin size={16} aria-hidden="true" />
                {tContacts("office")}
              </li>
            </ul>
          </div>
          <PartnerForm defaultCity={t("defaultCity")} />
        </div>
      </Container>
    </section>
  );
}
