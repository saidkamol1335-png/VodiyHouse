import { ArrowRight, Check, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import type { ComplexPage } from "@/lib/site/complex/model";
import { COMPLEX_ANCHORS } from "@/lib/site/complex/sections";

type ComplexHeroProps = {
  page: ComplexPage;
  /** Галерея и карточка цены — клиентские части первого экрана. */
  gallery: ReactNode;
  offer: ReactNode;
};

/**
 * Первый экран страницы ЖК (мокап .jkh--stack, ТЗ 7.1): крошки, название с «Проверено Vodiy House» и
 * классом, застройщик, адрес и ориентир; ниже — галерея и карточка цены. На телефоне (MobJk) —
 * сначала фото во всю ширину под шапкой, потом плашки и название, крошек нет.
 */
export async function ComplexHero({ page, gallery, offer }: ComplexHeroProps) {
  const [t, tNav] = await Promise.all([getTranslations("complex"), getTranslations("nav")]);
  const locale = (await getLocale()) as Locale;
  const name = t("name", { name: page.name[locale] });
  const verified = Boolean(page.checked.permit && page.checked.land);
  return (
    <div className="complex-hero">
      <nav className="complex-hero__crumbs" aria-label={t("crumbs")}>
        <Link href={ROUTES.catalog}>{tNav("new")}</Link>
        {page.location ? (
          <>
            <span aria-hidden="true">/</span>
            <span>{page.location.name[locale]}</span>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <b aria-current="page">{name}</b>
      </nav>
      <div className="complex-hero__head">
        <div className="complex-hero__title">
          <h1 className="complex-hero__name">{name}</h1>
          <div className="complex-hero__badges">
            {verified ? (
              <span className="complex-hero__badge complex-hero__badge--verified">
                <Check size={13} strokeWidth={2.4} aria-hidden />
                {t("verified")}
              </span>
            ) : null}
            {page.class ? <span className="complex-hero__badge">{t(`class.${page.class}`)}</span> : null}
          </div>
        </div>
        <HeroMeta page={page} />
      </div>
      <div className="complex-hero__gallery">{gallery}</div>
      {offer}
    </div>
  );
}

async function HeroMeta({ page }: { page: ComplexPage }) {
  const t = await getTranslations("complex");
  const locale = (await getLocale()) as Locale;
  const address = [page.address?.[locale], page.location?.name[locale]].filter(Boolean).join(", ");
  const landmark = page.landmark?.[locale];
  const mark = [landmark ? t("landmark", { mark: landmark }) : null, page.minutesToCenter ? t("toCenter", { n: page.minutesToCenter }) : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="complex-hero__meta">
      <a className="complex-hero__developer" href={`#${COMPLEX_ANCHORS.developer}`}>
        {page.developer.name}
        <ArrowRight size={16} strokeWidth={2} aria-hidden />
      </a>
      {address ? <span className="complex-hero__address">{address}</span> : null}
      {mark ? (
        <a className="complex-hero__mark" href={`#${COMPLEX_ANCHORS.location}`}>
          <MapPin size={16} strokeWidth={1.9} aria-hidden />
          <span>{mark}</span>
        </a>
      ) : null}
    </div>
  );
}
