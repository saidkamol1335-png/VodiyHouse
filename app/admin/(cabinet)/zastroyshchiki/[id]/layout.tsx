import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { DeveloperStatus } from "@/components/DeveloperStatus";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { setDeveloperStatusAction } from "@/lib/admin/actions/developers";
import { developerTabs } from "@/lib/admin/developers/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { getDeveloper, getDeveloperPublishFiles } from "@/lib/admin/server/developerPage";
import { requireSection } from "@/lib/admin/session";
import { ROUTES } from "@/lib/routes";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const instant = false;

type DeveloperLayoutProps = { children: ReactNode; params: Promise<{ id: string }> };

/** Страница застройщика (Д2): шапка со статусом и вкладки-адреса; вкладки — дочерние страницы. */
export default async function DeveloperLayout({ children, params }: DeveloperLayoutProps) {
  const { viewer, allowed } = await requireSection("developers");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    const topbar = (
      <AdminTopbar
        title={t("developers.title")}
        subtitle={t("developers.subtitle")}
        person={person}
      />
    );
    return (
      <AdminPage topbar={topbar}>
        {allowed ? (
          <AdminPanel title={t("developers.title")}>
            {t("developers.errors.notConfigured")}
          </AdminPanel>
        ) : (
          <AdminDenied section={t("nav.developers")} />
        )}
      </AdminPage>
    );
  }
  const { id } = await params;
  const developer = await getDeveloper(id);
  if (!developer) notFound();
  const files = await getDeveloperPublishFiles(developer.id);
  const tabs = developerTabs(`${ADMIN_ROUTES.developers}/${developer.id}`, (key) =>
    t(`developers.tabs.${key}`),
  );
  return (
    <AdminPage
      topbar={
        <AdminTopbar
          title={developer.name}
          subtitle={t("developers.entitySubtitle", {
            address: `${ROUTES.developers}/${developer.slug}`,
          })}
          person={person}
        />
      }
    >
      <AdminEntityHead
        status={developer.status}
        tabsLabel={t("developers.tabs.label")}
        tabs={tabs}
        statusControls={
          <DeveloperStatus developer={developer} action={setDeveloperStatusAction} files={files} />
        }
      />
      {children}
    </AdminPage>
  );
}
