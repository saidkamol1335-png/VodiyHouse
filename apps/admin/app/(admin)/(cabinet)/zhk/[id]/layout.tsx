import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { Button } from "@/components/Button";
import { ComplexStateBadge, PendingRequestBadge } from "@/components/ComplexStateBadge";
import { ComplexWizardSteps } from "@/components/ComplexWizard";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { tabsNeedingAttention } from "@/lib/admin/complexes/readiness";
import type { ComplexRecord } from "@/lib/admin/complexes/record";
import { canOpenComplex, complexAccess, complexTabHref, complexTabs } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { getComplex, getComplexCompleteness, getComplexReadiness } from "@/lib/admin/server/complexPage";
import { readComplexRequests } from "@/lib/admin/server/requests";
import { requireSection } from "@/lib/admin/session";
import { ROUTES } from "@/lib/routes";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type ComplexLayoutProps = { children: ReactNode; params: Promise<{ id: string }> };

/**
 * Страница ЖК (экран 3, PLAN §10 п. 21): шапка со значком состояния и вкладки — дочерние страницы;
 * «Квартиры» — свой экран ЖК (п. 22). Руководитель и менеджер видят одно и то же; кнопки статуса —
 * во вкладке «Публикация».
 */
export default async function ComplexLayout({ children, params }: ComplexLayoutProps) {
  const { viewer, allowed } = await requireSection("complexes");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const access = complexAccess(viewer.role);
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    // Подпись наличия — только тому, кому раздел открыт (менеджеру); мобилографу — общая.
    const subtitle = t(
      allowed && !access.manage ? "complexes.subtitleStock" : "complexes.subtitle",
    );
    return (
      <AdminPage
        topbar={<AdminTopbar title={t("complexes.title")} subtitle={subtitle} person={person} />}
      >
        {allowed ? (
          <AdminPanel title={t("complexes.title")}>
            {t("developers.errors.notConfigured")}
          </AdminPanel>
        ) : (
          <AdminDenied section={t("nav.complexes")} sectionKey="complexes" />
        )}
      </AdminPage>
    );
  }
  const complex = await getComplex((await params).id);
  if (!complex || !canOpenComplex(access, complex.status)) notFound();
  const topbar = (
    <AdminTopbar
      title={t("complexes.namePrefixed", { name: complex.name.ru })}
      subtitle={t("complexes.entitySubtitle", {
        developer: complex.developerName || t("complexes.noDeveloper"),
        address: `${ROUTES.catalog}/${complex.slug}`,
      })}
      person={person}
    />
  );
  // Черновик — мастер «Новый ЖК»: шаги с номером и «Далее →» (решение фазы 3).
  const wizard = access.manage && complex.status === "draft";
  return (
    <AdminPage topbar={topbar}>
      {access.manage ? <ComplexHead complex={complex} wizard={wizard} /> : null}
      {children}
      {wizard ? <ComplexWizardSteps base={`${ADMIN_ROUTES.complexes}/${complex.id}`} /> : null}
    </AdminPage>
  );
}

/** Значок состояния, «Ожидает руководителя», «Квартиры» и вкладки с точками готовности (И9). */
async function ComplexHead({ complex, wizard }: { complex: ComplexRecord; wizard: boolean }) {
  const t = await getTranslations("admin.complexes");
  const [readiness, completeness, requests] = await Promise.all([
    getComplexReadiness(complex.id),
    getComplexCompleteness(complex.id),
    readComplexRequests(await createSupabaseServerClient(), complex.id),
  ]);
  const base = `${ADMIN_ROUTES.complexes}/${complex.id}`;
  const unpublished = complex.status === "draft" || complex.status === "hidden";
  const tabs = complexTabs(
    base,
    (key) => t(`tabs.${key}`),
    unpublished ? tabsNeedingAttention(readiness) : undefined,
    wizard,
  );
  const done = readiness.filter((item) => item.ok).length;
  return (
    <AdminEntityHead
      status={complex.status}
      tabsLabel={t("tabs.label")}
      tabs={tabs}
      attentionLabel={t("attention")}
      statusControls={
        <div className="admin-entity-head__state">
          <ComplexStateBadge
            status={complex.status}
            siteState={{ state: completeness?.state ?? "draft", done, total: readiness.length }}
            developerPublished={complex.developerStatus === "published"}
            size="md"
          />
          {requests.some((request) => request.status === "pending") ? <PendingRequestBadge size="md" /> : null}
          <Button size="sm" variant="outline" href={complexTabHref(base, "units")}>
            {t("tabs.units")}
          </Button>
        </div>
      }
    />
  );
}
