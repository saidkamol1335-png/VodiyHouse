import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { StaffCreateForm } from "@/components/StaffCreateForm";
import { StaffList } from "@/components/StaffList";
import { StaffRowActions } from "@/components/StaffRowActions";
import { DEV_VIEWER } from "@/lib/admin/access";
import { cabinetPerson } from "@/lib/admin/person";
import { DEMO_STAFF, DEMO_VIEWER_ID } from "@/lib/admin/staff/demoStaff";
import type { StaffRowActionSet } from "@/lib/admin/staff/types";
import { demoCreateStaffAction, demoResetStaffPasswordAction, demoSetStaffActiveAction } from "./actions";

const DEMO_ROW_ACTIONS: StaffRowActionSet = {
  setActive: demoSetStaffActiveAction,
  resetPassword: demoResetStaffPasswordAction,
};

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
        <StaffCreateForm action={demoCreateStaffAction} />
        <StaffList
          members={DEMO_STAFF}
          viewerId={DEMO_VIEWER_ID}
          actionsFor={(member) => (
            <StaffRowActions
              id={member.id}
              name={member.fullName}
              email={member.email}
              isActive={member.isActive}
              actions={DEMO_ROW_ACTIONS}
            />
          )}
        />
      </AdminPage>
    </AdminShell>
  );
}
