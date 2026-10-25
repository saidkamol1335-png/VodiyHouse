import { Building2, Check, TrendingUp, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { PARTNER_ANCHOR, PARTNER_FORMATS, type PartnerFormat } from "@/lib/leads/partner";

const ICONS = { sales: Users, ads: TrendingUp, listing: Building2 } as const;
const POINTS = { sales: 3, ads: 3, listing: 3 } as const;

/**
 * «Три способа работать вместе» (мокап SitePartners .fmt): совместные продажи, реклама на сайте,
 * размещение ЖК; «Выбрать» ведёт к форме с этим форматом. Без броней (решение 06.10.2026), цены
 * форматов — TODO-заказчик.
 */
export async function PartnersFormats() {
  const t = await getTranslations("partners.formats");
  return (
    <section className="partners-formats" aria-labelledby="partners-formats-title">
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id="partners-formats-title" className="partners-formats__title">
          <Heading level={2} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
        </div>
        <ul className="partners-formats__list">
          {PARTNER_FORMATS.map((format, index) => (
            <FormatCard key={format} format={format} index={index} />
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** Карточка формата: значок, номер, название, цена курсивом, что входит, «Выбрать» — к форме. */
async function FormatCard({ format, index }: { format: PartnerFormat; index: number }) {
  const t = await getTranslations("partners.formats");
  const Icon = ICONS[format];
  return (
    <li className="partners-formats__card">
      <span className="partners-formats__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="partners-formats__index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="partners-formats__name">{t(`${format}.name`)}</h3>
      <p className="partners-formats__price">{t(`${format}.price`)}</p>
      <p className="partners-formats__text">{t(`${format}.text`)}</p>
      <ul className="partners-formats__points">
        {Array.from({ length: POINTS[format] }, (_, point) => (
          <li key={point}>
            <Check size={14} aria-hidden="true" />
            {t(`${format}.points.p${point + 1}` as "sales.points.p1")}
          </li>
        ))}
      </ul>
      <a
        href={`#${PARTNER_ANCHOR}-${format}`}
        className="button button--outline button--sm partners-formats__pick"
        aria-label={`${t("pick")}: ${t(`${format}.name`)}`}
      >
        {t("pick")}
      </a>
    </li>
  );
}
