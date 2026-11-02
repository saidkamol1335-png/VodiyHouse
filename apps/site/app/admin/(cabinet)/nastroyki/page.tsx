import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { StaffCreateForm } from "@/components/StaffCreateForm";
import { StaffList } from "@/components/StaffList";
import { StaffRowActions } from "@/components/StaffRowActions";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import {
  createStaffAction,
  resetStaffPasswordAction,
  setStaffActiveAction,
} from "@/lib/admin/actions/staff";
import { readStaffDirectory } from "@/lib/admin/server/deps";
import { requireSection } from "@/lib/admin/session";
import { staffState } from "@/lib/admin/staff/directory";
import type { StaffRowActionSet } from "@/lib/admin/staff/types";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

const ROW_ACTIONS: StaffRowActionSet = {
  setActive: setStaffActiveAction,
  resetPassword: resetStaffPasswordAction,
};

/** «Настройки → Сотрудники»: список из базы сессией руководителя (staff_directory). */
export default async function SettingsStaffPage() {
  // Layout не перерисовывается при переходах — страница проверяет доступ сама.
  const { viewer, allowed } = await requireSection("settings");
  if (!allowed) return null;
  if (isCabinetOpenWithoutLogin || !hasSupabaseAdminEnv()) {
    const t = await getTranslations("admin.staff");
    return <AdminPanel title={t("title")}>{t("notConfigured")}</AdminPanel>;
  }
  const members = await readStaffDirectory(await createSupabaseServerClient());
  return (
    <>
      <StaffCreateForm action={createStaffAction} />
      <StaffList
        members={members}
        viewerId={viewer.id}
        actionsFor={(member) => (
          <StaffRowActions
            id={member.id}
            name={member.fullName}
            email={member.email}
            state={staffState(member)}
            actions={ROW_ACTIONS}
          />
        )}
      />
    </>
  );
}
