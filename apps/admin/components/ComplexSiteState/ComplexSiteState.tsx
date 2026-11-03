import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { ComplexStateBadge, complexBadgeLook } from "@/components/ComplexStateBadge";
import type { ComplexCompleteness, ComplexSiteState as SiteState } from "@/lib/admin/complexes/completeness";
import type { PublicationStatus } from "@/lib/admin/publication";

type ComplexSiteStateProps = {
  status: PublicationStatus;
  state: SiteState;
  developerPublished: boolean;
  /** Страница ЖК на сайте — ссылка, когда ЖК там виден. */
  siteHref: string;
  completeness: ComplexCompleteness | null;
};

/** «Состояние на сайте» во вкладке «Публикация»: значок, что видит посетитель, ссылка на страницу. */
export function ComplexSiteState({ status, state, developerPublished, siteHref, completeness }: ComplexSiteStateProps) {
  const t = useTranslations("admin.complexes.publication");
  const tState = useTranslations("admin.complexes.siteState");
  const look = complexBadgeLook(status, state, developerPublished);
  const text =
    status === "published" && !developerPublished
      ? t("state.developerHidden")
      : look.key === "onSite"
        ? t("state.full")
        : t(`state.${look.key}`);
  const done = completeness?.requirements.filter((item) => item.ok).length ?? 0;
  const total = completeness?.requirements.length ?? 6;
  const onSite = look.key === "onSite" || look.key === "soon";
  return (
    <div className="complex-site-state">
      <ComplexStateBadge
        status={status}
        siteState={{ state, done, total }}
        developerPublished={developerPublished}
        size="md"
      />
      <p className="complex-site-state__text">{text}</p>
      {completeness && status !== "archived" ? (
        <p className="complex-site-state__layouts">
          {tState("layouts", { done: completeness.completeLayouts, total: completeness.layouts.length })}
        </p>
      ) : null}
      {onSite ? (
        <a className="complex-site-state__link" href={siteHref} target="_blank" rel="noopener noreferrer">
          {t("openOnSite")}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}
