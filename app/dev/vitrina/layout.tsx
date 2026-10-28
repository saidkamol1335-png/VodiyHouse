import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { DEV_VIEWER } from "@/lib/admin/access";
import { ADMIN_ROUTES, SHOWCASE_TABS } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { DEV_SHOWCASE_BASE } from "./base";

// Меню и вкладки (usePathname, useSelectedLayoutSegment) вне <Suspense> — страницы ждут адрес на
// сервере, как разделы кабинета (docs: instant-navigation).
export const instant = false;

/**
 * Стенд «Витрины» (3.16а): шапка кабинета и вкладки-адреса, как у /admin/vitrina. Вкладки — в
 * layout, чтобы активная читалась из сегмента адреса (и на странице записи тоже). В продакшене нет.
 */
export default async function DevShowcaseLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  const person = await cabinetPerson(DEV_VIEWER);
  const t = await getTranslations("admin");
  const tabs = SHOWCASE_TABS.map((tab) => ({
    segment: tab.segment,
    href: tab.href.replace(ADMIN_ROUTES.showcase, DEV_SHOWCASE_BASE),
    label: t(`showcase.tabs.${tab.key}`),
  }));
  return (
    <AdminShell viewer={DEV_VIEWER}>
      <AdminPage
        topbar={
          <AdminTopbar
            title={t("showcase.title")}
            subtitle={t("dev.subtitleSection", { section: t("showcase.subtitle") })}
            person={person}
          />
        }
      >
        <AdminTabs label={t("showcase.tabsLabel")} tabs={tabs} />
        {children}
      </AdminPage>
    </AdminShell>
  );
}
