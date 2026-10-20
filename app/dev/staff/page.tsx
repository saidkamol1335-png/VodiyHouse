import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { StaffList } from "@/components/StaffList";
import { DEV_VIEWER } from "@/lib/admin/access";
import { cabinetPerson } from "@/lib/admin/person";
import { DEMO_STAFF, DEMO_VIEWER_ID } from "@/lib/admin/staff/demoStaff";

// Стенд «Настройки → Сотрудники» (шаг 8) на DEMO мокапа: те же компоненты, что у
// /admin/nastroyki, без базы. В продакшене страницы нет.
export default async function DevStaffPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const person = await cabinetPerson(DEV_VIEWER);
  const t = await getTranslations("admin.settings");
  const tabs = [{ segment: null, href: "/dev/staff", label: t("tabs.staff") }];
  return (
    <AdminShell viewer={DEV_VIEWER}>
      <AdminPage topbar={<AdminTopbar title={t("title")} subtitle="Сотрудники · DEMO · служебная страница" person={person} />}>
        <AdminTabs label={t("tabsLabel")} tabs={tabs} />
        <StaffList members={DEMO_STAFF} viewerId={DEMO_VIEWER_ID} />
      </AdminPage>
    </AdminShell>
  );
}
