import { Check, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DeveloperMark } from "@/components/DevelopersList";
import { LeadButton } from "@/components/LeadDialog";
import type { LeadIntent } from "@/components/LeadForm";
import { SitePhoto } from "@/components/SitePhoto";
import { formatAmount } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import type { DeveloperCounts } from "@/lib/site/developers/model";
import type { DeveloperPage } from "@/lib/site/developers/records";

type DeveloperHeroProps = {
  page: DeveloperPage;
  /** Фон — свой или обложка первого ЖК (ТЗ 8.2); null — тёмная карточка без фото. */
  cover: CatalogPhoto | null;
  counts: DeveloperCounts;
  verified: boolean;
  consult: LeadIntent;
};

/**
 * Первый экран страницы застройщика (мокап SiteDev / MobDev, ТЗ 8.2): крошки, фото объектов фоном,
 * поверх — карточка: знак, название, год, «Сдано N ЖК · Строится M ЖК» по ЖК на сайте, «Сдано
 * квартир», «Проверено Vodiy House», напоминание о правиле 1.2 и «Получить консультацию».
 */
export async function DeveloperHero({ page, cover, counts, verified, consult }: DeveloperHeroProps) {
  const [t, tList, tLead] = await Promise.all([
    getTranslations("developers.page"),
    getTranslations("developers"),
    getTranslations("lead.buttons"),
  ]);
  const countParts = [
    counts.built > 0 ? t("countBuilt", { n: t("complexesN", { n: counts.built }) }) : null,
    counts.building > 0 ? t("countBuilding", { n: t("complexesN", { n: counts.building }) }) : null,
  ].filter(Boolean);
  return (
    <section className="developer-hero">
      <nav className="developer-hero__crumbs" aria-label={t("crumbs")}>
        <Link href={ROUTES.developers}>{tList("eyebrow")}</Link>
        <span aria-hidden="true">/</span>
        <span>{page.name}</span>
      </nav>
      <div className={cover ? "developer-hero__stage" : "developer-hero__stage developer-hero__stage--plain"}>
        {cover ? <SitePhoto photo={cover} alt="" frame="cover" sizes="(max-width: 760px) 100vw, 1320px" preload className="developer-hero__cover" /> : null}
        <div className="developer-hero__card">
          <DeveloperMark name={page.name} logo={page.logo} className="developer-hero__logo" />
          <h1 className="developer-hero__name">{page.name}</h1>
          {page.foundedYear ? <p className="developer-hero__founded">{t("founded", { year: page.foundedYear })}</p> : null}
          {countParts.length > 0 ? <p className="developer-hero__counts">{countParts.join(" · ")}</p> : null}
          {page.flatsDelivered ? <p className="developer-hero__flats">{t("flats", { n: formatAmount(page.flatsDelivered) })}</p> : null}
          {verified ? (
            <p className="developer-hero__verified">
              <Check size={14} strokeWidth={2.6} aria-hidden="true" />
              {t("checks")}
            </p>
          ) : null}
          <p className="developer-hero__note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{t("note")}</span>
          </p>
          <LeadButton intent={consult} className="developer-hero__consult">
            {tLead("consult")}
          </LeadButton>
        </div>
      </div>
    </section>
  );
}
