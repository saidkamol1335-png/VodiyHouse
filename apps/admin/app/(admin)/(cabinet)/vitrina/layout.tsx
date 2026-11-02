import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { SHOWCASE_TABS } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const instant = false;

/** «Витрина» (3.16а): вкладки-адреса Спецпредложения · Подборки · Реклама; только руководителю. */
export default async function ShowcaseLayout({ children }: { children: ReactNode }) {
  const { viewer, allowed } = await requireSection("showcase");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const topbar = <AdminTopbar title={t("showcase.title")} subtitle={t("showcase.subtitle")} person={person} />;
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.showcase")} />
      </AdminPage>
    );
  }
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPage topbar={topbar}>
        <AdminPanel title={t("showcase.title")}>{t("developers.errors.notConfigured")}</AdminPanel>
      </AdminPage>
    );
  }
  const tabs = SHOWCASE_TABS.map((tab) => ({
    segment: tab.segment,
    href: tab.href,
    label: t(`showcase.tabs.${tab.key}`),
  }));
  return (
    <AdminPage topbar={topbar}>
      <AdminTabs label={t("showcase.tabsLabel")} tabs={tabs} />
      {children}
    </AdminPage>
  );
}
