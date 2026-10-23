import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import type { PublishFile } from "@/components/PublishCheck";
import { DeveloperStatus } from "@/components/DeveloperStatus";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { setDeveloperStatusAction } from "@/lib/admin/actions/developers";
import { developerTabs } from "@/lib/admin/developers/tabs";
import type { DeveloperRecord } from "@/lib/admin/developers/types";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson, type CabinetPerson } from "@/lib/admin/person";
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
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return <DeveloperUnavailable allowed={allowed} person={person} />;
  }
  const t = await getTranslations("admin.developers");
  const { id } = await params;
  const developer = await getDeveloper(id);
  if (!developer) notFound();
  const files = await getDeveloperPublishFiles(developer.id);
  const address = `${ROUTES.developers}/${developer.slug}`;
  return (
    <AdminPage
      topbar={
        <AdminTopbar
          title={developer.name}
          subtitle={t("entitySubtitle", { address })}
          person={person}
        />
      }
    >
      <DeveloperHead developer={developer} files={files} />
      {children}
    </AdminPage>
  );
}

/** Без облака — «база не подключена», без права на раздел — «раздел недоступен». */
async function DeveloperUnavailable({
  allowed,
  person,
}: {
  allowed: boolean;
  person: CabinetPerson;
}) {
  const t = await getTranslations("admin");
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

/** Статус застройщика и вкладки-адреса (Основное · Сданные объекты · Внутреннее · Журнал). */
async function DeveloperHead({
  developer,
  files,
}: {
  developer: DeveloperRecord;
  files: PublishFile[];
}) {
  const t = await getTranslations("admin.developers");
  const tabs = developerTabs(`${ADMIN_ROUTES.developers}/${developer.id}`, (key) =>
    t(`tabs.${key}`),
  );
  return (
    <AdminEntityHead
      status={developer.status}
      tabsLabel={t("tabs.label")}
      tabs={tabs}
      statusControls={
        <DeveloperStatus developer={developer} action={setDeveloperStatusAction} files={files} />
      }
    />
  );
}
