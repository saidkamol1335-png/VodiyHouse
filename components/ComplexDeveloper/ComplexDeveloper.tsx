import { Check, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LeadButton } from "@/components/LeadDialog";
import type { LeadIntent } from "@/components/LeadForm";
import { SitePhoto } from "@/components/SitePhoto";
import { formatPrice, initialsOf } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import { cheapest } from "@/lib/site/catalog/card";
import type { ComplexPage } from "@/lib/site/complex/model";

type VerifiedCheck = { key: "permit" | "land" | "delivered" | "visit"; date: string };

/** «Проверено Vodiy House» (мокап .checks): только проверенное — с датой проверки. */
function checksOf(page: ComplexPage): VerifiedCheck[] {
  const all: [VerifiedCheck["key"], string | null][] = [
    ["permit", page.checked.permit],
    ["land", page.checked.land],
    ["delivered", page.developer.deliveredCheckedAt],
    ["visit", page.checked.visit],
  ];
  return all.flatMap(([key, date]) => (date ? [{ key, date }] : []));
}

const dotted = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/**
 * «О застройщике» (мокап .devc, ТЗ 7.9): знак, название, «с N года», «Сдано · Строится» по ЖК на
 * сайте, о компании, другие ЖК застройщика; справа — проверки Vodiy House с датами. Контактов
 * застройщика нет (правило ТЗ 1.2) — «Получить консультацию» ведёт к Vodiy House; «Подробнее о
 * застройщике» — со страницами застройщиков (3б).
 */
export async function ComplexDeveloper({ page, consult }: { page: ComplexPage; consult: LeadIntent }) {
  const [t, tLead] = await Promise.all([getTranslations("complex.developer"), getTranslations("lead.buttons")]);
  const locale = (await getLocale()) as Locale;
  const { developer } = page;
  const checks = checksOf(page);
  return (
    <div className={checks.length > 0 ? "complex-developer" : "complex-developer complex-developer--single"}>
      <div className="complex-developer__card">
        <div className="complex-developer__head">
          {developer.logo ? (
            <SitePhoto photo={developer.logo} alt="" frame="card" sizes="56px" className="complex-developer__logo" />
          ) : (
            <span className="complex-developer__mark" aria-hidden="true">
              {initialsOf(developer.name.replace(/[‘’']/g, ""))}
            </span>
          )}
          <div>
            <p className="complex-developer__name">{developer.name}</p>
            <p className="complex-developer__since">{developer.foundedYear ? t("since", { year: developer.foundedYear }) : t("role")}</p>
          </div>
        </div>
        {developer.built + developer.building > 0 ? (
          <p className="complex-developer__counts">
            {/* «Сдано 0 ЖК» не пишем: счётчики — только по ЖК на сайте (ТЗ 7.9), ноль там не новость. */}
            {[
              developer.built > 0 ? t("countBuilt", { n: t("complexes", { n: developer.built }) }) : null,
              developer.building > 0 ? t("countBuilding", { n: t("complexes", { n: developer.building }) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {developer.about ? <p className="complex-developer__about">{developer.about[locale]}</p> : null}
        <div className="complex-developer__actions">
          <LeadButton intent={consult} variant="ghost" size="sm">
            <Phone size={16} aria-hidden="true" />
            {tLead("consult")}
          </LeadButton>
        </div>
        <OtherComplexes page={page} locale={locale} />
      </div>
      <DeveloperChecks checks={checks} />
    </div>
  );
}

async function DeveloperChecks({ checks }: { checks: readonly VerifiedCheck[] }) {
  const t = await getTranslations("complex.developer");
  if (checks.length === 0) return null;
  return (
    <div className="complex-developer__checks">
      <p className="complex-developer__label">{t("checks")}</p>
      <ul>
        {checks.map((check) => (
          <li key={check.key}>
            <span className="complex-developer__check" aria-hidden="true">
              <Check size={13} strokeWidth={2.6} />
            </span>
            <span>
              {t(check.key)}
              <small>{t("checkedOn", { date: dotted(check.date) })}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Другие ЖК застройщика на сайте (ТЗ 7.9): обложка, название, город и цена «от». */
async function OtherComplexes({ page, locale }: { page: ComplexPage; locale: Locale }) {
  const [t, tComplex] = await Promise.all([getTranslations("complex.developer"), getTranslations("complex")]);
  if (page.others.length === 0) return null;
  return (
    <div className="complex-developer__others">
      <p className="complex-developer__label">{t("others")}</p>
      <ul>
        {page.others.map((other) => {
          const price = cheapest(other.prices, page.catalog.rate);
          const place = [other.location?.[locale], price ? t("otherPrice", { price: formatPrice(price.amount, price.currency, locale) }) : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={other.slug}>
              <Link className="complex-developer__other" href={complexRoute(other.slug)}>
                {other.photo ? <SitePhoto photo={other.photo} alt="" frame="card" sizes="250px" className="complex-developer__other-photo" /> : null}
                <b>{tComplex("name", { name: other.name[locale] })}</b>
                {place ? <small>{place}</small> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
