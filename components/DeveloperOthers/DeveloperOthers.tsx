import { getTranslations } from "next-intl/server";
import { DeveloperMark } from "@/components/DevelopersList";
import { Link } from "@/lib/i18n/navigation";
import { developerRoute } from "@/lib/routes";
import type { DeveloperSummary } from "@/lib/site/developers/records";

export type OtherDeveloper = DeveloperSummary & { complexes: number };

/**
 * «Другие застройщики» (мокап SiteDev, ТЗ 8.8): знак, название, «N ЖК»; порядок руководителя.
 * Посетитель, которому этот застройщик не подошёл, остаётся на сайте.
 */
export async function DeveloperOthers({ others }: { others: readonly OtherDeveloper[] }) {
  const t = await getTranslations("developers.page");
  if (others.length === 0) return null;
  return (
    <section className="developer-others" aria-labelledby="developer-others-title">
      <h2 id="developer-others-title" className="developer-others__title">
        {t("others")}
      </h2>
      <ul className="developer-others__row">
        {others.map((other) => (
          <li key={other.slug}>
            <Link className="developer-others__card" href={developerRoute(other.slug)}>
              <DeveloperMark name={other.name} logo={other.logo} className="developer-others__logo" />
              <span>
                <b>{other.name}</b>
                <small>{t("complexesN", { n: other.complexes })}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
