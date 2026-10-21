import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ComplexStatus } from "@/components/ComplexStatus";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { setComplexStatusAction } from "@/lib/admin/actions/complexes";
import { tabsNeedingAttention } from "@/lib/admin/complexes/readiness";
import { complexTabs } from "@/lib/admin/complexes/tabs";
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

/** Страница ЖК (в. 6): шапка со статусом и готовностью (И8, И9), вкладки-адреса — дочерние страницы. */
export default async function ComplexLayout({ children, params }: ComplexLayoutProps) {
  const { viewer, allowed } = await requireSection("complexes");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    const topbar = (
      <AdminTopbar
        title={t("complexes.title")}
        subtitle={t("complexes.subtitle")}
        person={person}
      />
    );
    return (
      <AdminPage topbar={topbar}>
        {allowed ? (
          <AdminPanel title={t("complexes.title")}>
            {t("developers.errors.notConfigured")}
          </AdminPanel>
        ) : (
          <AdminDenied section={t("nav.complexes")} />
        )}
      </AdminPage>
    );
  }
  const { id } = await params;
  const complex = await getComplex(id);
  if (!complex) notFound();
  const [readiness, files] = await Promise.all([
    getComplexReadiness(complex.id),
    readComplexFiles(await createSupabaseServerClient(), complex.id),
  ]);
  const base = `${ADMIN_ROUTES.complexes}/${complex.id}`;
  const unpublished = complex.status === "draft" || complex.status === "hidden";
  const tabs = complexTabs(
    base,
    (key) => t(`complexes.tabs.${key}`),
    unpublished ? tabsNeedingAttention(readiness) : undefined,
  );
  const name = t("complexes.namePrefixed", { name: complex.name.ru });
  return (
    <AdminPage
      topbar={
        <AdminTopbar
          title={name}
          subtitle={t("complexes.entitySubtitle", {
            developer: complex.developerName,
            address: `${ROUTES.catalog}/${complex.slug}`,
          })}
          person={person}
        />
      }
    >
      <AdminEntityHead
        status={complex.status}
        tabsLabel={t("complexes.tabs.label")}
        tabs={tabs}
        attentionLabel={t("complexes.attention")}
        statusControls={
          <ComplexStatus
            complex={{ ...complex, name: complex.name.ru }}
            action={setComplexStatusAction}
            readiness={readiness}
            files={files.map((file) => ({
              id: file.id,
              kind: file.kind,
              src: mediaSrc(file.path),
            }))}
            base={base}
            developer={{
              name: complex.developerName,
              published: complex.developerStatus === "published",
              href: `${ADMIN_ROUTES.developers}/${complex.developerId}`,
            }}
          />
        }
      />
      {children}
    </AdminPage>
  );
}
