import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { programsTabs } from "@/lib/admin/programs/tabs";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const instant = false;

/** «Программы оплаты» (шаги 2.4–2.5): шапка, вкладки «Программы · Расчёт для клиента» (Р1). */
export default async function ProgramsLayout({ children }: { children: ReactNode }) {
  const { viewer, allowed } = await requireSection("programs");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const topbar = (
    <AdminTopbar title={t("programs.title")} subtitle={t("programs.subtitle")} person={person} />
  );
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.programs")} />
      </AdminPage>
    );
  }
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPage topbar={topbar}>
        <AdminPanel title={t("programs.title")}>{t("developers.errors.notConfigured")}</AdminPanel>
      </AdminPage>
    );
  }
  const tabs = programsTabs(ADMIN_ROUTES.programs, {
    list: t("calc.tabs.list"),
    calc: t("calc.tabs.calc"),
  });
  return (
    <AdminPage topbar={topbar}>
      <AdminTabs label={t("calc.tabsLabel")} tabs={tabs} />
      {children}
    </AdminPage>
  );
}
