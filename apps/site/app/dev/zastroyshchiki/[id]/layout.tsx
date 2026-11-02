import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTopbar } from "@/components/AdminTopbar";
import { DeveloperStatus } from "@/components/DeveloperStatus";
import { DEV_VIEWER } from "@/lib/admin/access";
import { demoDeveloper } from "@/lib/admin/developers/demo";
import { developerTabs } from "@/lib/admin/developers/tabs";
import { cabinetPerson } from "@/lib/admin/person";
import { ROUTES } from "@/lib/routes";
import { demoSetStatusAction } from "../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

type DevDeveloperLayoutProps = { children: ReactNode; params: Promise<{ id: string }> };

// Стенд страницы застройщика: вкладки-адреса и статус, как у /admin/zastroyshchiki/<id>.
export default async function DevDeveloperLayout({ children, params }: DevDeveloperLayoutProps) {
  if (process.env.NODE_ENV === "production") notFound();
  const developer = demoDeveloper((await params).id);
  if (!developer) notFound();
  const person = await cabinetPerson(DEV_VIEWER);
  const t = await getTranslations("admin.developers");
  const tDev = await getTranslations("admin.dev");
  const tabs = developerTabs(`/dev/zastroyshchiki/${developer.id}`, (key) => t(`tabs.${key}`));
  const address = `${ROUTES.developers}/${developer.slug}`;
  return (
    <AdminShell viewer={DEV_VIEWER}>
      <AdminPage
        topbar={
          <AdminTopbar
            title={developer.name}
            subtitle={tDev("demoSuffix", { text: t("entitySubtitle", { address }) })}
            person={person}
          />
        }
      >
        <AdminEntityHead
          status={developer.status}
          tabsLabel={t("tabs.label")}
          tabs={tabs}
          statusControls={
            <DeveloperStatus developer={developer} action={demoSetStatusAction} files={[]} />
          }
        />
        {children}
      </AdminPage>
    </AdminShell>
  );
}
