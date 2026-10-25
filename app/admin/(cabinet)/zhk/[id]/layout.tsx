import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ComplexStatus } from "@/components/ComplexStatus";
import { ComplexWizardSteps } from "@/components/ComplexWizard";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { setComplexStatusAction } from "@/lib/admin/actions/complexes";
import { tabsNeedingAttention } from "@/lib/admin/complexes/readiness";
import type { ComplexRecord } from "@/lib/admin/complexes/record";
import { canOpenComplex, complexAccess, complexTabs } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { getComplex, getComplexReadiness } from "@/lib/admin/server/complexPage";
import { readComplexFiles } from "@/lib/admin/server/complexes";
import { mediaSrc } from "@/lib/admin/server/developerPage";
import { requireSection } from "@/lib/admin/session";
import { ROUTES } from "@/lib/routes";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type ComplexLayoutProps = { children: ReactNode; params: Promise<{ id: string }> };

/**
 * Страница ЖК (в. 6): шапка со статусом и готовностью (И8, И9), вкладки-адреса — дочерние
 * страницы; у менеджера — только «Квартиры» без шапки (Н2).
 */
export default async function ComplexLayout({ children, params }: ComplexLayoutProps) {
  const { viewer, allowed } = await requireSection("complexes");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const access = complexAccess(viewer.role);
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    // Подпись наличия — только тому, кому раздел открыт (менеджеру); видеографу — общая.
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
        developer: complex.developerName,
        address: `${ROUTES.catalog}/${complex.slug}`,
      })}
      person={person}
    />
  );
  // Черновик — мастер «Новый ЖК»: шаги с номером и «Далее →» (решение фазы 3).
  const wizard = access.manage && complex.status === "draft";
  return (
    <AdminPage topbar={topbar}>
      {/* Менеджер (Н2): без статуса публикации и готовности, вкладка одна — ленты нет. */}
      {access.manage ? <ComplexHead complex={complex} wizard={wizard} /> : null}
      {children}
      {wizard ? <ComplexWizardSteps base={`${ADMIN_ROUTES.complexes}/${complex.id}`} /> : null}
    </AdminPage>
  );
}

/** Статус публикации с готовностью (И8, И9) и вкладки — руководителю. */
async function ComplexHead({ complex, wizard }: { complex: ComplexRecord; wizard: boolean }) {
  const t = await getTranslations("admin.complexes");
  const [readiness, files] = await Promise.all([
    getComplexReadiness(complex.id),
    readComplexFiles(await createSupabaseServerClient(), complex.id),
  ]);
  const base = `${ADMIN_ROUTES.complexes}/${complex.id}`;
  const unpublished = complex.status === "draft" || complex.status === "hidden";
  const tabs = complexTabs(
    base,
    (key) => t(`tabs.${key}`),
    unpublished ? tabsNeedingAttention(readiness) : undefined,
    wizard,
  );
  return (
    <AdminEntityHead
      status={complex.status}
      tabsLabel={t("tabs.label")}
      tabs={tabs}
      attentionLabel={t("attention")}
      statusControls={
        <ComplexStatus
          complex={{ ...complex, name: complex.name.ru }}
          action={setComplexStatusAction}
          readiness={readiness}
          files={files.map((file) => ({ id: file.id, kind: file.kind, src: mediaSrc(file.path) }))}
          base={base}
          developer={{
            name: complex.developerName,
            published: complex.developerStatus === "published",
            href: `${ADMIN_ROUTES.developers}/${complex.developerId}`,
          }}
        />
      }
    />
  );
}
