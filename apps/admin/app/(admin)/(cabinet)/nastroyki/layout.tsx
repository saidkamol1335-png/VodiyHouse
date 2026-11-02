import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { readySettingsTabs } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { requireSection } from "@/lib/admin/session";

export const instant = false;

/** «Настройки» (Д6): вкладки-адреса Сотрудники · Справочники · Журнал; только руководителю. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { viewer, allowed } = await requireSection("settings");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const topbar = (
    <AdminTopbar title={t("settings.title")} subtitle={t("settings.subtitle")} person={person} />
  );
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.settings")} />
      </AdminPage>
    );
  }
  const tabs = readySettingsTabs().map((tab) => ({
    segment: tab.segment,
    href: tab.href,
    label: t(`settings.tabs.${tab.key}`),
  }));
  return (
    <AdminPage topbar={topbar}>
      <AdminTabs label={t("settings.tabsLabel")} tabs={tabs} />
      {children}
    </AdminPage>
  );
}
