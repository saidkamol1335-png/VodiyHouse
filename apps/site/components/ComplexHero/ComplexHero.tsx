import { ArrowRight, Check } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import type { ComplexPage } from "@/lib/site/complex/model";
import { COMPLEX_ANCHORS } from "@/lib/site/complex/sections";

type ComplexHeroProps = {
  page: ComplexPage;
  /** Галерея — клиентская часть первого экрана. */
  gallery: ReactNode;
};

/**
 * Первый экран страницы ЖК (мокап .jkh--stack, ТЗ 7.1): крошки, название с «Проверено Vodiy House» и
 * застройщик; ниже — галерея (карточки цены нет — п. 16). Правки 15.11, п. 14: без адреса, ориентира, «до центра N мин» (всё это —
 * в «Расположении» сразу после «О ЖК») и без плашки класса («Бизнес» — в фактах «О ЖК»). На телефоне
 * (MobJk) — сначала фото во всю ширину под шапкой, потом плашка и название, крошек нет.
 */
export async function ComplexHero({ page, gallery }: ComplexHeroProps) {
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
          </div>
        </div>
        <HeroMeta page={page} />
      </div>
      <div className="complex-hero__gallery">{gallery}</div>
    </div>
  );
}

async function HeroMeta({ page }: { page: ComplexPage }) {
  return (
    <div className="complex-hero__meta">
      <a className="complex-hero__developer" href={`#${COMPLEX_ANCHORS.developer}`}>
        {page.developer.name}
        <ArrowRight size={16} strokeWidth={2} aria-hidden />
      </a>
    </div>
  );
}
