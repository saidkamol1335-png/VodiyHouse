import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/Badge";
import { Reveal } from "@/components/Reveal";
import type { Locale } from "@/lib/i18n/routing";
import { deliveryStatus, quarterOf } from "@/lib/quarters";
import type { PastProject } from "@/lib/site/developers/records";

type DeveloperDeliveredProps = { projects: readonly PastProject[]; locale: Locale };

/**
 * «Сданные объекты» (мокап SiteDev, ТЗ 8.6): объект, план и факт кварталами, «Сдан в срок» или
 * «Перенос на N мес.» (lib/quarters). Объекты, которых нет на сайте, — вводит руководитель.
 */
export async function DeveloperDelivered({ projects, locale }: DeveloperDeliveredProps) {
  const t = await getTranslations("developers.page");
  if (projects.length === 0) return null;
  const quarter = (iso: string | null) => {
    const value = iso ? quarterOf(iso) : null;
    return value ? t("quarter", { quarter: value.quarter, year: value.year }) : "—";
  };
  return (
    <Reveal as="section" className="developer-delivered" aria-labelledby="developer-delivered-title">
      <h2 id="developer-delivered-title" className="heading heading--h2">
        {t("projects")}
      </h2>
      <div className="developer-delivered__card">
        <table className="developer-delivered__table">
          <thead>
            <tr>
              <th scope="col">{t("project")}</th>
              <th scope="col">{t("planned")}</th>
              <th scope="col">{t("deliveredOn")}</th>
              <th scope="col">
                <span className="sr-only">{t("deliveredOn")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, index) => {
              const status = deliveryStatus(project.plannedOn, project.deliveredOn);
              return (
                <tr key={`${project.name.ru}-${index}`}>
                  <th scope="row">{project.name[locale]}</th>
                  <td>{quarter(project.plannedOn)}</td>
                  <td>{quarter(project.deliveredOn)}</td>
                  <td className="developer-delivered__status">
                    {status?.kind === "onTime" ? <Badge tone="ok">{t("onTime")}</Badge> : null}
                    {status?.kind === "delayed" ? <Badge tone="amber">{t("delayed", { months: status.months })}</Badge> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}
