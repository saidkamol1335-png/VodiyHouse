import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminEntityHead } from "@/components/AdminEntityHead";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTopbar } from "@/components/AdminTopbar";
import { DEV_VIEWER } from "@/lib/admin/access";
import { cabinetPerson } from "@/lib/admin/person";

const BASE = "/dev/admin-kit";

// Служебная страница шага 10: застройщик на общих компонентах кабинета, DEMO из мокапа.
// Вкладки — отдельные адреса, как будут у /admin/zastroyshchiki/<id>. В продакшене её нет.
export default async function DevAdminKitLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  const viewer = DEV_VIEWER;
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin.developers.tabs");
  const tabs = [
    { segment: null, href: BASE, label: t("main") },
    { segment: "obyekty", href: `${BASE}/obyekty`, label: t("projects") },
    { segment: "vnutrennee", href: `${BASE}/vnutrennee`, label: t("private") },
    { segment: "zhurnal", href: `${BASE}/zhurnal`, label: t("log") },
  ];
  return (
    <AdminShell viewer={viewer}>
      <AdminPage
        topbar={
          <AdminTopbar
            title="Farg‘ona Sifat Qurilish"
            subtitle="Застройщик · DEMO · служебная страница"
            person={person}
          />
        }
      >
        <AdminEntityHead status="published" tabsLabel={t("label")} tabs={tabs} />
        {children}
      </AdminPage>
    </AdminShell>
  );
}
